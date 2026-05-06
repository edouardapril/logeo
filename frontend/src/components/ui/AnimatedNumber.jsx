import { useEffect, useRef, useState } from 'react'

/**
 * Affiche un nombre qui s'anime quand `value` change.
 * - Tween d'environ 600ms easing easeOutQuart
 * - `format(n)` pour formater (ex: monnaie)
 */
export default function AnimatedNumber({ value, format = (n) => String(n), duration = 600, className = '' }) {
  const [display, setDisplay] = useState(value ?? 0)
  const fromRef = useRef(value ?? 0)
  const startRef = useRef(0)
  const rafRef = useRef(null)

  useEffect(() => {
    if (value == null) {
      setDisplay(0)
      return
    }
    cancelAnimationFrame(rafRef.current)
    fromRef.current = display
    startRef.current = performance.now()

    const target = Number(value)
    const from = Number(fromRef.current)
    const tick = (now) => {
      const t = Math.min(1, (now - startRef.current) / duration)
      // easeOutQuart
      const e = 1 - Math.pow(1 - t, 4)
      const next = from + (target - from) * e
      setDisplay(Math.round(next))
      if (t < 1) rafRef.current = requestAnimationFrame(tick)
    }
    rafRef.current = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(rafRef.current)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value])

  return <span className={className}>{format(display)}</span>
}
