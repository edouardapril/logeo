import { useEffect, useRef, useState, useLayoutEffect } from 'react'
import { ArrowRight, X } from 'lucide-react'

// LOTPLOT 23 — Overlay tutoriel.
//
// Approche : full-page dim avec un "spotlight" sur l'élément ciblé via un
// boxShadow inversé (un `<div>` absolu positionné autour du target avec
// box-shadow géant qui assombrit le reste de l'écran). Plus simple et fiable
// qu'un cutout SVG, et fonctionne bien sur scroll/resize.
//
// La tooltip est positionnée en fixed à côté du target. Si le target n'est
// pas trouvé, on affiche la tooltip centrée plutôt que rien (fail-safe).

export default function TutorialOverlay({
  targetSelector,
  tooltipText,
  tooltipPosition = 'bottom',
  showNextButton = true,
  onNext,
  onSkip,
  step,            // optionnel — affiché en small "Étape X / Y"
}) {
  const [rect, setRect] = useState(null)
  const tooltipRef = useRef(null)

  // Recalcule le rect du target à chaque render + sur scroll/resize.
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
      // Scroll into view si masqué
      const r = el.getBoundingClientRect()
      const fullyVisible = r.top >= 0 && r.bottom <= window.innerHeight
      if (!fullyVisible) {
        el.scrollIntoView({ behavior: 'smooth', block: 'center' })
        // Re-compute after scroll
        setTimeout(() => {
          const el2 = document.querySelector(targetSelector)
          if (el2) setRect(el2.getBoundingClientRect())
        }, 350)
        return
      }
      setRect(r)
    }
    compute()
    window.addEventListener('resize', compute)
    window.addEventListener('scroll', compute, true)
    const interval = setInterval(compute, 500) // recalcul périodique pour les UIs dynamiques
    return () => {
      window.removeEventListener('resize', compute)
      window.removeEventListener('scroll', compute, true)
      clearInterval(interval)
    }
  }, [targetSelector])

  // Position de la tooltip
  const tooltipStyle = (() => {
    const W = 320
    if (!rect) {
      return {
        position: 'fixed',
        left: '50%', top: '50%',
        transform: 'translate(-50%, -50%)',
        width: W,
      }
    }
    const margin = 16
    let top, left
    switch (tooltipPosition) {
      case 'top':
        top = rect.top - margin
        left = rect.left + rect.width / 2 - W / 2
        return { position: 'fixed', top, left, width: W, transform: 'translateY(-100%)' }
      case 'left':
        top = rect.top + rect.height / 2
        left = rect.left - margin
        return { position: 'fixed', top, left, width: W, transform: 'translate(-100%, -50%)' }
      case 'right':
        top = rect.top + rect.height / 2
        left = rect.right + margin
        return { position: 'fixed', top, left, width: W, transform: 'translateY(-50%)' }
      case 'bottom':
      default:
        top = rect.bottom + margin
        left = rect.left + rect.width / 2 - W / 2
        // Clamp horizontalement à la viewport
        const maxLeft = window.innerWidth - W - 12
        left = Math.max(12, Math.min(left, maxLeft))
        return { position: 'fixed', top, left, width: W }
    }
  })()

  // Spotlight = un div absolu de la taille du rect, avec box-shadow géant en
  // semi-transparent qui dim tout le reste de l'écran. Pointer-events: none
  // pour que le clic passe à travers et atteigne le target.
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
        zIndex: 40,
        animation: 'walkthrough-pulse 1.6s ease-in-out infinite',
      }
    : {
        position: 'fixed',
        inset: 0,
        background: 'rgba(15, 23, 42, 0.55)',
        pointerEvents: 'none',
        zIndex: 40,
      }

  return (
    <>
      <style>{`
        @keyframes walkthrough-pulse {
          0%, 100% { box-shadow: 0 0 0 9999px rgba(15,23,42,0.55), 0 0 0 0 rgba(234,88,12,0); }
          50% { box-shadow: 0 0 0 9999px rgba(15,23,42,0.55), 0 0 0 6px rgba(234,88,12,0.6); }
        }
      `}</style>
      <div style={spotlightStyle} aria-hidden="true" />

      <div
        ref={tooltipRef}
        style={{ ...tooltipStyle, zIndex: 50 }}
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
