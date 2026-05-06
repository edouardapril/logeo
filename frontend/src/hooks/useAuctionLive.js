import { useEffect, useRef, useState, useCallback } from 'react'

/**
 * Build l'URL WebSocket à partir de VITE_API_URL.
 * http://host:8000 → ws://host:8000/ws/...
 * https://host    → wss://host/ws/...
 */
function buildWsUrl(dealId, token) {
  const apiUrl = import.meta.env.VITE_API_URL || ''
  let base
  try {
    base = new URL(apiUrl)
  } catch {
    base = new URL(window.location.origin)
  }
  const proto = base.protocol === 'https:' ? 'wss:' : 'ws:'
  const url = `${proto}//${base.host}/ws/deals/${dealId}`
  return token ? `${url}?token=${encodeURIComponent(token)}` : url
}

/**
 * Hook React qui maintient une connexion WS pour un deal et expose :
 *
 *   {
 *     connected: boolean,
 *     events: Array<event>,            // historique récent (le plus récent en tête, max 30)
 *     latest: event | null,             // dernier event reçu
 *     livePrice: number | null,         // displayed_price le plus récent
 *     liveBidders: number | null,       // bidders_count le plus récent
 *     liveCloseAt: string | null,       // bid_close_at après une éventuelle extension
 *     extendedFlash: { ts } | null,     // pour déclencher l'animation "+10 min"
 *     iAmLeading: bool | null,          // null = inconnu, true/false sinon
 *     auctionClosed: bool,
 *     iWonClosure: bool,                // true si on est le gagnant à la fermeture
 *   }
 *
 * Reconnexion auto avec backoff. Heartbeat ping/pong toutes les 30s.
 */
export default function useAuctionLive(dealId, { enabled = true } = {}) {
  const [state, setState] = useState({
    connected: false,
    events: [],
    latest: null,
    livePrice: null,
    liveBidders: null,
    liveCloseAt: null,
    extendedFlash: null,
    iAmLeading: null,
    auctionClosed: false,
    iWonClosure: false,
  })

  const wsRef = useRef(null)
  const reconnectTimer = useRef(null)
  const heartbeatTimer = useRef(null)
  const attemptsRef = useRef(0)

  const handleEvent = useCallback((evt) => {
    setState(prev => {
      const events = [evt, ...prev.events].slice(0, 30)
      const next = { ...prev, latest: evt, events }

      if (evt.type === 'new_bid') {
        if (evt.displayed_price != null) next.livePrice = evt.displayed_price
        if (evt.bidders_count != null) next.liveBidders = evt.bidders_count
        if (evt.extended && evt.new_close_at) {
          next.liveCloseAt = evt.new_close_at
          next.extendedFlash = { ts: Date.now() }
        }
      } else if (evt.type === 'timer_extended') {
        if (evt.bid_close_at) next.liveCloseAt = evt.bid_close_at
        next.extendedFlash = { ts: Date.now() }
      } else if (evt.type === 'auction_closed') {
        next.auctionClosed = true
      } else if (evt.type === 'auction_closed_winner') {
        next.iWonClosure = true
      } else if (evt.type === 'leading') {
        next.iAmLeading = true
      } else if (evt.type === 'outbid') {
        next.iAmLeading = false
      }
      return next
    })
  }, [])

  useEffect(() => {
    if (!enabled || !dealId) return

    let cancelled = false

    const connect = () => {
      if (cancelled) return
      const token = localStorage.getItem('logeo_token')
      const url = buildWsUrl(dealId, token)

      let ws
      try {
        ws = new WebSocket(url)
      } catch (e) {
        scheduleReconnect()
        return
      }
      wsRef.current = ws

      ws.onopen = () => {
        attemptsRef.current = 0
        setState(s => ({ ...s, connected: true }))
        // Heartbeat
        heartbeatTimer.current = setInterval(() => {
          if (ws.readyState === WebSocket.OPEN) ws.send('ping')
        }, 30_000)
      }

      ws.onmessage = (msg) => {
        try {
          const evt = JSON.parse(msg.data)
          if (evt.type === 'pong') return
          handleEvent(evt)
        } catch {
          // ignore non-JSON
        }
      }

      ws.onclose = () => {
        setState(s => ({ ...s, connected: false }))
        if (heartbeatTimer.current) {
          clearInterval(heartbeatTimer.current)
          heartbeatTimer.current = null
        }
        if (!cancelled) scheduleReconnect()
      }

      ws.onerror = () => {
        try { ws.close() } catch {}
      }
    }

    const scheduleReconnect = () => {
      if (cancelled) return
      attemptsRef.current = Math.min(attemptsRef.current + 1, 6)
      const delay = Math.min(1000 * 2 ** attemptsRef.current, 30_000)
      reconnectTimer.current = setTimeout(connect, delay)
    }

    connect()

    return () => {
      cancelled = true
      if (heartbeatTimer.current) clearInterval(heartbeatTimer.current)
      if (reconnectTimer.current) clearTimeout(reconnectTimer.current)
      if (wsRef.current) {
        try { wsRef.current.close() } catch {}
      }
    }
  }, [dealId, enabled, handleEvent])

  return state
}


/** Helper : déclenche une notification navigateur (best-effort, pas d'erreur si refusé). */
export async function browserNotify(title, body) {
  if (typeof window === 'undefined' || !('Notification' in window)) return
  try {
    if (Notification.permission === 'default') {
      await Notification.requestPermission()
    }
    if (Notification.permission === 'granted') {
      new Notification(title, { body, icon: '/favicon.svg' })
    }
  } catch {
    // ignore
  }
}
