import { useEffect, useState } from 'react'
import { AlertTriangle, Zap } from 'lucide-react'

/**
 * Timer ultra-esthétique 4 blocs (JOUR / HR / MIN / SEC).
 *
 * Tier visuel :
 *   > 5 j           : vert  #22C55E        — calme
 *   2-5 j           : bleu  #3B82F6        — "Bientôt"
 *   24h-2 j         : orange #F97316       — pulsation douce
 *   6-24 h          : rouge orangé #EF4444 — pulsation rapide
 *   < 6 h           : rouge vif            — "DERNIÈRES HEURES !"
 *   < 1 h           : rouge critique       — "DERNIÈRES MINUTES !"
 *
 *  Variants:
 *    size="lg"       4 boîtes premium centrées (page deal)
 *    size="md"       4 boîtes plus petites (sidebar)
 *    size="compact"  pill mini "🟢 9j 14h" (cards / tableaux)
 *
 *  Props:
 *    closeAt: ISO string
 *    size: 'lg' | 'md' | 'compact'
 *    showLabel: bool         — affiche la phrase tier sous les boîtes (lg/md uniquement)
 *    extendedFlash: { ts }   — déclenche un banner "+10 min" pendant 600ms
 *    onExpire: () => void
 */

function diff(target) {
  const ms = new Date(target).getTime() - Date.now()
  if (ms <= 0) return null
  const total = Math.floor(ms / 1000)
  return {
    days:    Math.floor(total / 86400),
    hours:   Math.floor((total % 86400) / 3600),
    minutes: Math.floor((total % 3600) / 60),
    seconds: total % 60,
    totalHours: total / 3600,
  }
}
const fmt = (n) => String(n).padStart(2, '0')

function tierFor(t) {
  const h = t.totalHours
  if (h < 1)  return { key: 'critical',  label: 'DERNIÈRES MINUTES !', color: '#DC2626', bg: 'bg-red-50',     ring: 'ring-red-400',   text: 'text-red-700',     pulse: 'animate-[pulseFast_1.2s_infinite]', emoji: '🔴' }
  if (h < 6)  return { key: 'final_h',   label: 'DERNIÈRES HEURES !',  color: '#DC2626', bg: 'bg-red-50',     ring: 'ring-red-300',   text: 'text-red-700',     pulse: 'animate-[pulseFast_1.5s_infinite]', emoji: '🔴' }
  if (h < 24) return { key: 'urgent',    label: 'Urgent',              color: '#EF4444', bg: 'bg-red-50',     ring: 'ring-red-200',   text: 'text-red-700',     pulse: 'animate-[pulseFast_2s_infinite]',   emoji: '🔴' }
  if (h < 48) return { key: 'soon',      label: 'Moins de 2 jours',    color: '#F97316', bg: 'bg-orange-50',  ring: 'ring-orange-200',text: 'text-orange-700',  pulse: 'animate-[pulseSoft_2.5s_infinite]', emoji: '🟠' }
  if (h < 120)return { key: 'mid',       label: 'Bientôt',             color: '#3B82F6', bg: 'bg-blue-50',    ring: 'ring-blue-200',  text: 'text-blue-700',    pulse: '', emoji: '🔵' }
  return                { key: 'calm',      label: 'Enchère en cours',    color: '#22C55E', bg: 'bg-emerald-50', ring: 'ring-emerald-200',text: 'text-emerald-700',pulse: '', emoji: '🟢' }
}

function Box({ value, label, sizeClass, valueClass, color }) {
  return (
    <div className={`flex flex-col items-center justify-center rounded-xl ${sizeClass} bg-white shadow-sm`}>
      <span
        className={`font-bold tabular-nums leading-none ${valueClass}`}
        style={{ color }}
      >
        {value}
      </span>
      <span className="text-[10px] uppercase tracking-wider text-gray-500 mt-1">
        {label}
      </span>
    </div>
  )
}

export default function CountdownBoxes({
  closeAt, size = 'lg', showLabel = false, extendedFlash = null, onExpire,
}) {
  const [t, setT] = useState(() => diff(closeAt))

  useEffect(() => {
    const tick = () => {
      const next = diff(closeAt)
      setT(next)
      if (!next && onExpire) onExpire()
    }
    tick()
    const id = setInterval(tick, 1000)
    return () => clearInterval(id)
  }, [closeAt, onExpire])

  // ── Compact pill (cards) ─────────────────────────────────────────────────
  if (size === 'compact') {
    if (!t) return (
      <span className="text-xs text-gray-500 inline-flex items-center gap-1">
        ⏸ Terminée
      </span>
    )
    const tier = tierFor(t)
    const compactStr = t.days > 0
      ? `${t.days}j ${t.hours}h`
      : t.hours > 0
        ? `${t.hours}h ${fmt(t.minutes)}min`
        : `${t.minutes}min ${fmt(t.seconds)}s`
    return (
      <span className={`inline-flex items-center gap-1 text-xs font-semibold tabular-nums px-2 py-0.5 rounded-full ring-1 ring-inset ${tier.bg} ${tier.ring} ${tier.text} ${tier.pulse}`}>
        <span aria-hidden="true">{tier.emoji}</span> {compactStr}
      </span>
    )
  }

  // ── lg / md : 4 boîtes ──────────────────────────────────────────────────
  if (!t) {
    return (
      <div className="flex items-center gap-2 text-gray-600">
        <span className="text-lg">⏸ Enchère terminée</span>
      </div>
    )
  }
  const tier = tierFor(t)
  const isLg = size === 'lg'
  const sizeClass = isLg ? 'h-20 w-20 px-2' : 'h-14 w-14 px-2'
  const valueClass = isLg ? 'text-3xl' : 'text-xl'
  // Couleur du chiffre selon tier
  const colorStyle = { color: tier.color }

  return (
    <div className={`inline-flex flex-col items-center gap-2 ${tier.pulse}`}>
      {extendedFlash && (
        <div
          key={extendedFlash.ts}
          className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-amber-50 border border-amber-300 text-amber-900 text-xs font-medium animate-[flash_0.6s_ease-out]"
        >
          <Zap className="h-3.5 w-3.5" /> Timer prolongé +10 min
        </div>
      )}
      <div className={`inline-flex items-center gap-2 p-3 rounded-2xl ${tier.bg} ring-1 ring-inset ${tier.ring}`}>
        <Box value={fmt(t.days)}    label="JOUR" sizeClass={sizeClass} valueClass={valueClass} color={tier.color} />
        <Box value={fmt(t.hours)}   label="HR"   sizeClass={sizeClass} valueClass={valueClass} color={tier.color} />
        <Box value={fmt(t.minutes)} label="MIN"  sizeClass={sizeClass} valueClass={valueClass} color={tier.color} />
        <Box value={fmt(t.seconds)} label="SEC"  sizeClass={sizeClass} valueClass={valueClass} color={tier.color} />
      </div>
      <style>{`
        @keyframes flash {
          0%   { transform: scale(0.95); }
          50%  { transform: scale(1.05); }
          100% { transform: scale(1); }
        }
        @keyframes pulseSoft {
          0%, 100% { opacity: 1; }
          50%      { opacity: 0.78; }
        }
        @keyframes pulseFast {
          0%, 100% { opacity: 1; }
          50%      { opacity: 0.6; }
        }
      `}</style>
      {showLabel && (
        <p className={`text-sm font-semibold ${tier.text} flex items-center gap-1`}>
          {tier.key === 'critical' && <AlertTriangle className="h-4 w-4" />}
          {tier.label}
        </p>
      )}
    </div>
  )
}
