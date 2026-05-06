import { useEffect, useState } from 'react'
import { Clock, AlertTriangle } from 'lucide-react'

function diff(target) {
  const ms = new Date(target).getTime() - Date.now()
  if (ms <= 0) return null
  const total = Math.floor(ms / 1000)
  return {
    days:    Math.floor(total / 86400),
    hours:   Math.floor((total % 86400) / 3600),
    minutes: Math.floor((total % 3600) / 60),
    seconds: total % 60,
    totalSeconds: total,
    totalMinutes: Math.floor(total / 60),
    totalHours: total / 3600,
  }
}

const fmt = (n) => String(n).padStart(2, '0')

const SIZES = {
  sm: { text: 'text-xs',  icon: 'h-3.5 w-3.5' },
  md: { text: 'text-sm',  icon: 'h-4 w-4' },
  lg: { text: 'text-2xl', icon: 'h-5 w-5' },
}

/**
 * Paliers visuels (durée standard Logeo = 10 jours = 240h) :
 *  > 5 j    : vert calme
 *  2-5 j    : orange "L'enchère se termine bientôt"
 *  24h-2 j  : rouge pulsant
 *  < 24h    : rouge vif urgent (pulse)
 *  < 1h     : rouge "DERNIÈRES MINUTES !" (pulse)
 */
function tierFor(t) {
  const h = t.totalHours
  if (h < 1)        return { key: 'critical', label: 'DERNIÈRES MINUTES !', cls: 'bg-red-200 text-red-900 ring-red-400', pulse: true }
  if (h < 24)       return { key: 'urgent',   label: 'Urgent',              cls: 'bg-red-100 text-red-900 ring-red-300', pulse: true }
  if (h < 48)       return { key: 'soon',     label: 'Moins de 2 jours',    cls: 'bg-red-50 text-red-700 ring-red-200',  pulse: true }
  if (h < 120)      return { key: 'mid',      label: "L'enchère se termine bientôt", cls: 'bg-amber-50 text-amber-700 ring-amber-200', pulse: false }
  return                  { key: 'calm',     label: null,                  cls: 'bg-emerald-50 text-emerald-700 ring-emerald-200', pulse: false }
}

export default function Timer({ closeAt, size = 'md', showLabel = false, onExpire }) {
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

  if (!t) {
    return (
      <span className="inline-flex items-center gap-1.5 text-sm font-medium text-gray-500">
        <Clock className="h-4 w-4" />
        Enchère terminée
      </span>
    )
  }

  const tier = tierFor(t)
  const sz = SIZES[size] || SIZES.md
  const pulseClass = tier.pulse ? 'animate-pulse' : ''
  const Icon = tier.key === 'critical' ? AlertTriangle : Clock

  return (
    <span className="inline-flex flex-col items-start gap-1">
      <span
        className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 font-mono font-semibold tabular-nums ring-1 ring-inset ${tier.cls} ${sz.text} ${pulseClass}`}
        aria-live="polite"
      >
        <Icon className={sz.icon} />
        {t.days > 0 && <span>{t.days}j</span>}
        <span>{fmt(t.hours)}:{fmt(t.minutes)}:{fmt(t.seconds)}</span>
      </span>
      {showLabel && tier.label && (
        <span className={`text-xs font-medium ${
          tier.key === 'critical' ? 'text-red-700' :
          tier.key === 'urgent'   ? 'text-red-700' :
          tier.key === 'soon'     ? 'text-red-600' :
                                    'text-amber-700'
        }`}>
          {tier.label}
        </span>
      )}
    </span>
  )
}
