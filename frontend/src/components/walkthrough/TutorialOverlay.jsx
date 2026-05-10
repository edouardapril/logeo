import { useEffect, useRef, useState, useLayoutEffect } from 'react'
import { ArrowRight, X } from 'lucide-react'

// LOTPLOT 23 / 23B — Overlay tutoriel.
//
// Approche : full-page dim + spotlight box-shadow autour du target. Tooltip
// positionnée en `position:fixed` à côté du target, avec :
//   - clamp vertical : ne dépasse jamais sous la stack sticky (bandeau MODE
//     EXEMPLE + ProgressTracker) → STICKY_TOP_OFFSET. (LOTPLOT 23B fix #1)
//   - flip auto top↔bottom si pas assez d'espace → ne masque jamais le target
//     qu'elle décrit. (fix #2)
//   - max-width 320px, word-break, transition CSS sur top/left/opacity 200ms
//     → mouvements smooth entre steps. (fix #2 + #4)

const TOOLTIP_WIDTH = 320
const TOOLTIP_MARGIN = 16
// Hauteur de la stack sticky (bandeau MODE EXEMPLE + ProgressTracker desktop) :
// bandeau ~38px (peut wrap sur mobile étroit → ~64px) + tracker ~50px.
// 116px de safety margin couvre les deux cas + un peu d'espace visuel.
const STICKY_TOP_OFFSET = 116

export default function TutorialOverlay({
  targetSelector,
  tooltipText,
  tooltipPosition = 'bottom',
  showNextButton = true,
  onNext,
  onSkip,
  step,
}) {
  const [rect, setRect] = useState(null)
  // Tooltip key change déclenche fade-in à chaque step. Utilise tooltipText
  // comme proxy pour "step a changé".
  const [fadeKey, setFadeKey] = useState(0)
  const tooltipRef = useRef(null)
  const prevTextRef = useRef(tooltipText)

  // Bump fadeKey quand le texte change (= nouveau step)
  useEffect(() => {
    if (prevTextRef.current !== tooltipText) {
      prevTextRef.current = tooltipText
      setFadeKey(k => k + 1)
    }
  }, [tooltipText])

  // Recompute rect du target sur scroll/resize/timer
  useLayoutEffect(() => {
    if (!targetSelector) {
      setRect(null)
      return
    }
    const compute = () => {
      const el = document.querySelector(targetSelector)
      if (!el) {
        setRect(null)
        return
      }
      const r = el.getBoundingClientRect()
      const fullyVisible = r.top >= STICKY_TOP_OFFSET && r.bottom <= window.innerHeight
      if (!fullyVisible) {
        // scroll into view AVEC offset pour ne pas se cacher derrière la stack sticky
        const target_y = window.scrollY + r.top - STICKY_TOP_OFFSET - 16
        window.scrollTo({ top: Math.max(0, target_y), behavior: 'smooth' })
        setTimeout(() => {
          const el2 = document.querySelector(targetSelector)
          if (el2) setRect(el2.getBoundingClientRect())
        }, 400)
        return
      }
      setRect(r)
    }
    compute()
    window.addEventListener('resize', compute)
    window.addEventListener('scroll', compute, true)
    const interval = setInterval(compute, 500)
    return () => {
      window.removeEventListener('resize', compute)
      window.removeEventListener('scroll', compute, true)
      clearInterval(interval)
    }
  }, [targetSelector])

  // ── Position de la tooltip ──────────────────────────────────────────────────
  // On calcule d'abord la position désirée selon `tooltipPosition`, puis on
  // applique des contraintes : clamp horizontal, clamp vertical (STICKY_TOP_OFFSET)
  // et flip auto top↔bottom si pas assez d'espace pour éviter de masquer le target.
  const tooltipStyle = (() => {
    if (!rect) {
      return {
        position: 'fixed',
        left: '50%',
        top: '50%',
        transform: 'translate(-50%, -50%)',
        maxWidth: TOOLTIP_WIDTH,
        width: 'min(90vw, 320px)',
      }
    }

    const tooltipEl = tooltipRef.current
    const tooltipH = tooltipEl ? tooltipEl.offsetHeight : 140  // estimation safe
    const viewportH = window.innerHeight
    const viewportW = window.innerWidth

    let pos = tooltipPosition

    // Flip auto top↔bottom si pas la place. Le target ne doit jamais être
    // recouvert par sa propre tooltip.
    if (pos === 'top' && rect.top - tooltipH - TOOLTIP_MARGIN < STICKY_TOP_OFFSET) {
      pos = 'bottom'
    }
    if (pos === 'bottom' && rect.bottom + TOOLTIP_MARGIN + tooltipH > viewportH - 16) {
      // Si le top a aussi pas la place, on garde bottom (la moins pire)
      // mais on clamp en bas du viewport
      if (rect.top - tooltipH - TOOLTIP_MARGIN >= STICKY_TOP_OFFSET) pos = 'top'
    }

    let top, left
    let transform

    switch (pos) {
      case 'top':
        top = rect.top - TOOLTIP_MARGIN - tooltipH
        left = rect.left + rect.width / 2 - TOOLTIP_WIDTH / 2
        transform = ''
        break
      case 'left':
        top = rect.top + rect.height / 2 - tooltipH / 2
        left = rect.left - TOOLTIP_MARGIN - TOOLTIP_WIDTH
        transform = ''
        break
      case 'right':
        top = rect.top + rect.height / 2 - tooltipH / 2
        left = rect.right + TOOLTIP_MARGIN
        transform = ''
        break
      case 'bottom':
      default:
        top = rect.bottom + TOOLTIP_MARGIN
        left = rect.left + rect.width / 2 - TOOLTIP_WIDTH / 2
        transform = ''
        break
    }

    // Clamp horizontal
    const maxLeft = viewportW - TOOLTIP_WIDTH - 12
    left = Math.max(12, Math.min(left, maxLeft))

    // Clamp vertical : pas dans la stack sticky, pas hors écran en bas
    top = Math.max(STICKY_TOP_OFFSET, Math.min(top, viewportH - tooltipH - 12))

    return {
      position: 'fixed',
      top,
      left,
      maxWidth: TOOLTIP_WIDTH,
      width: 'min(90vw, 320px)',
      transform,
    }
  })()

  const spotlightStyle = rect
    ? {
        position: 'fixed',
        top: rect.top - 6,
        left: rect.left - 6,
        width: rect.width + 12,
        height: rect.height + 12,
        borderRadius: 10,
        boxShadow: '0 0 0 9999px rgba(15, 23, 42, 0.55)',
        pointerEvents: 'none',
        zIndex: 30, // sous le ProgressTracker (z-40 du bandeau, le tracker n'a pas
                    // de z explicite mais reste au-dessus du dim parce qu'il est
                    // sticky avec un background opaque). On garde la tooltip à 50.
        transition: 'top 200ms ease, left 200ms ease, width 200ms ease, height 200ms ease',
        animation: 'walkthrough-pulse 1.6s ease-in-out infinite',
      }
    : {
        position: 'fixed',
        inset: 0,
        background: 'rgba(15, 23, 42, 0.55)',
        pointerEvents: 'none',
        zIndex: 30,
      }

  return (
    <>
      <style>{`
        @keyframes walkthrough-pulse {
          0%, 100% { box-shadow: 0 0 0 9999px rgba(15,23,42,0.55), 0 0 0 0 rgba(234,88,12,0); }
          50% { box-shadow: 0 0 0 9999px rgba(15,23,42,0.55), 0 0 0 6px rgba(234,88,12,0.6); }
        }
        @keyframes walkthrough-tooltip-fade {
          from { opacity: 0; transform: translateY(4px); }
          to   { opacity: 1; transform: translateY(0); }
        }
      `}</style>
      <div style={spotlightStyle} aria-hidden="true" />

      <div
        key={fadeKey}
        ref={tooltipRef}
        style={{
          ...tooltipStyle,
          zIndex: 50,
          // Smooth movement entre steps + fade-in à l'arrivée du nouveau step
          transition: 'top 200ms ease, left 200ms ease',
          animation: 'walkthrough-tooltip-fade 200ms ease-out',
          wordBreak: 'break-word',
          overflowWrap: 'anywhere',
        }}
        className="bg-white rounded-xl shadow-2xl p-4 border border-[#FDBA74]"
        role="dialog"
        aria-live="polite"
      >
        {step && (
          <div className="flex items-center justify-between mb-2">
            <span className="text-[10px] font-bold uppercase tracking-wider text-[#EA580C]">
              Étape {step.index + 1} / {step.total}
            </span>
            {onSkip && (
              <button
                onClick={onSkip}
                title="Passer cette étape"
                className="text-gray-400 hover:text-gray-700"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            )}
          </div>
        )}
        <p className="text-sm text-gray-800 leading-relaxed">{tooltipText}</p>
        {showNextButton && onNext && (
          <button
            onClick={onNext}
            className="mt-3 inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#EA580C] text-white text-sm font-semibold hover:bg-[#C2410C]"
          >
            Suivant <ArrowRight className="h-3.5 w-3.5" />
          </button>
        )}
      </div>
    </>
  )
}
