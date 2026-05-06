"""
Bus WebSocket temps réel pour les enchères Logeo.

Architecture :
  - Une "room" par deal_id, contenant un set de WebSockets.
  - Chaque socket est associé soit à un user_id (acheteur authentifié) soit à None (anonyme).
  - Les événements broadcast vont à toute la room ; les événements personnalisés
    (`outbid`, `leading`) sont routés via send_to_user.

Événements émis :
  new_bid          → all   { displayed_price, bidders_count, floor_price, increment }
  timer_update     → all   { bid_close_at, total_seconds }
  timer_extended   → all   { bid_close_at, reason: "anti_snipe" }
  auction_closed   → all   { winner_id, has_winner }   (winner_id seulement pour le gagnant via per-user)
  outbid           → user  { displayed_price, deal_id, deal_city }
  leading          → user  { displayed_price, deal_id }

Le manager est in-memory — suffisant pour 1 worker uvicorn. Si tu scales sur
plusieurs workers/instances, il faudra un pub/sub Redis. Pas urgent pour l'instant.
"""
from __future__ import annotations

import asyncio
import logging
from typing import Any
from uuid import UUID
from fastapi import WebSocket

log = logging.getLogger("logeo.realtime")


class _Room:
    __slots__ = ("deal_id", "by_user", "anonymous")

    def __init__(self, deal_id: UUID):
        self.deal_id = deal_id
        # Multiple sockets possibles par user (multi-onglet)
        self.by_user: dict[str, set[WebSocket]] = {}
        self.anonymous: set[WebSocket] = set()

    def add(self, ws: WebSocket, user_id: str | None) -> None:
        if user_id:
            self.by_user.setdefault(user_id, set()).add(ws)
        else:
            self.anonymous.add(ws)

    def remove(self, ws: WebSocket, user_id: str | None) -> None:
        if user_id:
            sockets = self.by_user.get(user_id)
            if sockets:
                sockets.discard(ws)
                if not sockets:
                    self.by_user.pop(user_id, None)
        else:
            self.anonymous.discard(ws)

    def all_sockets(self) -> list[WebSocket]:
        out: list[WebSocket] = []
        for s in self.by_user.values():
            out.extend(s)
        out.extend(self.anonymous)
        return out

    def is_empty(self) -> bool:
        return not self.by_user and not self.anonymous


class ConnectionManager:
    def __init__(self):
        self._rooms: dict[UUID, _Room] = {}
        self._lock = asyncio.Lock()

    async def connect(self, deal_id: UUID, ws: WebSocket, user_id: str | None) -> None:
        async with self._lock:
            room = self._rooms.setdefault(deal_id, _Room(deal_id))
            room.add(ws, user_id)
        log.info("ws connect deal=%s user=%s rooms=%d", deal_id, user_id, len(self._rooms))

    async def disconnect(self, deal_id: UUID, ws: WebSocket, user_id: str | None) -> None:
        async with self._lock:
            room = self._rooms.get(deal_id)
            if not room:
                return
            room.remove(ws, user_id)
            if room.is_empty():
                self._rooms.pop(deal_id, None)
        log.info("ws disconnect deal=%s user=%s", deal_id, user_id)

    async def _safe_send(self, ws: WebSocket, payload: dict[str, Any]) -> bool:
        try:
            await ws.send_json(payload)
            return True
        except Exception as e:
            log.warning("ws send failed: %s", e)
            return False

    async def broadcast(self, deal_id: UUID, event: dict[str, Any]) -> None:
        room = self._rooms.get(deal_id)
        if not room:
            return
        sockets = list(room.all_sockets())
        await asyncio.gather(
            *(self._safe_send(ws, event) for ws in sockets),
            return_exceptions=True,
        )

    async def send_to_user(self, deal_id: UUID, user_id: str, event: dict[str, Any]) -> None:
        room = self._rooms.get(deal_id)
        if not room:
            return
        sockets = list(room.by_user.get(user_id, set()))
        await asyncio.gather(
            *(self._safe_send(ws, event) for ws in sockets),
            return_exceptions=True,
        )


# Singleton — importé par les routes et les services
manager = ConnectionManager()


# ── Helpers de publication (utilisés par place_bid, close_auction, anti-snipe) ─

async def publish_new_bid(deal_id: UUID, *, displayed_price: int | None, bidders_count: int,
                          floor_price: int | None = None, increment: int | None = None,
                          extended: bool = False, new_close_at: str | None = None) -> None:
    await manager.broadcast(deal_id, {
        "type": "new_bid",
        "displayed_price": displayed_price,
        "bidders_count": bidders_count,
        "floor_price": floor_price,
        "increment": increment,
        "ts": _now_iso(),
        # Si la même action a déclenché anti-snipe, on l'inclut pour économiser un round trip
        "extended": extended,
        "new_close_at": new_close_at,
    })


async def publish_timer_extended(deal_id: UUID, new_close_at: str) -> None:
    await manager.broadcast(deal_id, {
        "type": "timer_extended",
        "bid_close_at": new_close_at,
        "reason": "anti_snipe",
        "ts": _now_iso(),
    })


async def publish_auction_closed(deal_id: UUID, winner_user_id: str | None) -> None:
    # Broadcast public (sans id du gagnant)
    await manager.broadcast(deal_id, {
        "type": "auction_closed",
        "has_winner": winner_user_id is not None,
        "ts": _now_iso(),
    })
    # Per-user pour celui qui gagne, pour déclencher l'animation confettis
    if winner_user_id:
        await manager.send_to_user(deal_id, winner_user_id, {
            "type": "auction_closed_winner",
            "is_me_winner": True,
            "ts": _now_iso(),
        })


async def publish_outbid(deal_id: UUID, *, previous_winner_id: str,
                         displayed_price: int | None, deal_city: str | None = None) -> None:
    await manager.send_to_user(deal_id, previous_winner_id, {
        "type": "outbid",
        "displayed_price": displayed_price,
        "deal_id": str(deal_id),
        "deal_city": deal_city,
        "ts": _now_iso(),
    })


async def publish_leading(deal_id: UUID, *, new_winner_id: str,
                          displayed_price: int | None) -> None:
    await manager.send_to_user(deal_id, new_winner_id, {
        "type": "leading",
        "displayed_price": displayed_price,
        "deal_id": str(deal_id),
        "ts": _now_iso(),
    })


def _now_iso() -> str:
    from datetime import datetime, timezone
    return datetime.now(timezone.utc).isoformat()
