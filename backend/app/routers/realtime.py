"""Endpoint WebSocket public-ish pour les enchères temps réel."""
import uuid
import logging
from fastapi import APIRouter, WebSocket, WebSocketDisconnect, Query
from jose import jwt, JWTError

from app.config import get_settings
from app.services.realtime import manager

settings = get_settings()
log = logging.getLogger("logeo.realtime.ws")
router = APIRouter()


def _decode_user_id(token: str | None) -> str | None:
    """Décode un JWT court (passé en query param), renvoie le user_id ou None."""
    if not token:
        return None
    try:
        payload = jwt.decode(token, settings.secret_key, algorithms=[settings.algorithm])
        return payload.get("sub")
    except JWTError:
        return None


@router.websocket("/ws/deals/{deal_id}")
async def deal_realtime(
    websocket: WebSocket,
    deal_id: uuid.UUID,
    token: str | None = Query(default=None),
):
    """
    Connexion temps réel pour un deal.

    URL : ws://host/ws/deals/<uuid>?token=<jwt-optionnel>
    Si le token est valide, l'acheteur reçoit aussi les events `outbid` / `leading`.
    Si pas de token, le client reçoit uniquement le broadcast public
    (`new_bid`, `timer_extended`, `auction_closed`).
    """
    await websocket.accept()
    user_id = _decode_user_id(token)
    await manager.connect(deal_id, websocket, user_id)
    await websocket.send_json({"type": "hello", "user_authenticated": bool(user_id)})

    try:
        # On ne s'attend pas à recevoir de message du client (canal sortant).
        # Mais on consomme pour détecter la déconnexion proprement.
        while True:
            msg = await websocket.receive_text()
            # Heartbeat client-side : si le client envoie "ping", on répond.
            if msg == "ping":
                await websocket.send_json({"type": "pong"})
    except WebSocketDisconnect:
        pass
    except Exception as e:
        log.warning("ws loop error: %s", e)
    finally:
        await manager.disconnect(deal_id, websocket, user_id)
