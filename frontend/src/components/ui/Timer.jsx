import { useEffect, useState } from 'react'
import { Clock } from 'lucide-react'

function diff(target) {
  const ms = new Date(target).getTime() - Date.now()
  if (ms <= 0) return null
  const total = Math.floor(ms / 1000)
  return {
    days: Math.floor(total / 86400),
    hours: Math.floor((total % 86400) / 3600),
    minutes: Math.floor((total % 3600) / 60),
    seconds: total % 60,
    totalMinutes: Math.floor(total / 60),
  }
}

export default function Timer({ closeAt, size = 'md', onExpire }) {
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
      <span className="inline-flex items-center gap-1.5 text-sm font-medium text-red-600">
        <Clock className="h-4 w-4" />
        Enchère terminée
      </span>
    )
  }

  const isUrgent = t.totalMinutes < 60
  const isCritical = t.totalMinutes < 10

  const tone = isCritical ? 'text-red-600' : isUrgent ? 'text-amber-600' : 'text-gray-700'
  const sz = size === 'lg' ? 'text-2xl' : size === 'sm' ? 'text-xs' : 'text-sm'

  const fmt = (n) => String(n).padStart(2, '0')

  return (
    <span className={`inline-flex items-center gap-1.5 font-mono font-semibold tabular-nums ${tone} ${sz}`}>
      <Clock className={size === 'lg' ? 'h-5 w-5' : 'h-4 w-4'} />
      {t.days > 0 && <span>{t.days}j</span>}
      <span>{fmt(t.hours)}:{fmt(t.minutes)}:{fmt(t.seconds)}</span>
    </span>
  )
}
