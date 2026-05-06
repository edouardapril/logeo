import { useEffect, useState } from 'react'
import { Zap, Clock4 } from 'lucide-react'

const fmtRel = (iso) => {
  if (!iso) return ''
  const s = Math.max(1, Math.floor((Date.now() - new Date(iso).getTime()) / 1000))
  if (s < 60) return `il y a ${s}s`
  const m = Math.floor(s / 60)
  if (m < 60) return `il y a ${m} min`
  const h = Math.floor(m / 60)
  return `il y a ${h}h`
}

const LABEL = {
  new_bid:        '⚡ Un acheteur a surenchéri',
  timer_extended: '⏱ Timer prolongé +10 min — Nouvelle offre proche du buzzer',
  auction_closed: '🏁 Enchère fermée',
  outbid:         '🔴 Vous avez été dépassé',
  leading:        '🟢 Vous êtes en avance',
}

/**
 * Fil d'activité temps réel — slide-in pour chaque event reçu, max 10 items affichés.
 * Aucun nom ni montant n'est révélé — seulement l'événement.
 */
export default function ActivityFeed({ events }) {
  // Re-render périodique pour rafraîchir les "il y a Xs"
  const [, setTick] = useState(0)
  useEffect(() => {
    const id = setInterval(() => setTick(t => t + 1), 5_000)
    return () => clearInterval(id)
  }, [])

  const visible = (events || []).slice(0, 10)
  const filtered = visible.filter(e => LABEL[e.type])

  return (
    <div className="card p-4">
      <h3 className="font-semibold text-gray-900 mb-3 text-sm flex items-center gap-2">
        <Zap className="h-4 w-4 text-[#C2410C]" />
        Activité temps réel
      </h3>
      {filtered.length === 0 ? (
        <p className="text-xs text-gray-500 italic">Aucune activité pour le moment.</p>
      ) : (
        <ul className="space-y-2">
          {filtered.map((e, i) => (
            <li
              key={`${e.ts}-${i}`}
              className="flex items-center justify-between text-xs animate-[slideIn_0.3s_ease-out]"
              style={{ animationDelay: `${i * 30}ms` }}
            >
              <span className="text-gray-700">{LABEL[e.type]}</span>
              <span className="text-gray-400 inline-flex items-center gap-1">
                <Clock4 className="h-3 w-3" />
                {fmtRel(e.ts)}
              </span>
            </li>
          ))}
        </ul>
      )}
      <style>{`
        @keyframes slideIn {
          from { opacity: 0; transform: translateY(-8px); }
          to   { opacity: 1; transform: translateY(0); }
        }
      `}</style>
    </div>
  )
}
