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
// LOTPLOT 23D : padding strict 32px entre tooltip et target (avant 16px,
// trop serré visuellement, le bas du tooltip touchait le haut du bouton).
const TOOLTIP_MARGIN = 32
// Padding sécurité contre les bords du viewport
const VIEWPORT_PADDING = 16
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

  // LOTPLOT 23D : track le selector qu'on a déjà scrollé pour ne pas re-scroller
  // en boucle (sinon l'event listener `scroll` recalculait, voyait que le target
  // n'était plus en center-zone, et re-scrollait).
  const scrolledForSelectorRef = useRef(null)

  // Recompute rect du target sur scroll/resize/timer.
  useLayoutEffect(() => {
    if (!targetSelector) {
      setRect(null)
      scrolledForSelectorRef.current = null
      return
    }
    // Reset le flag de scroll dès que le selector change → on re-centrera
    if (scrolledForSelectorRef.current !== targetSelector) {
      scrolledForSelectorRef.current = null
    }

    const compute = () => {
      const el = document.querySelector(targetSelector)
      if (!el) {
        setRect(null)
        return
      }
      const r = el.getBoundingClientRect()

      // LOTPLOT 23D fix #3 : auto-scroll-into-center.
      // On vise le tiers central du viewport. Si le target n'y est pas et
      // qu'on n'a pas encore scrollé pour ce selector, on lance un
      // scrollIntoView({block:'center'}) puis on re-mesure après 350ms.
      const targetCenterY = r.top + r.height / 2
      const viewportCenterY = window.innerHeight / 2
      const inCenterZone = Math.abs(targetCenterY - viewportCenterY) <= window.innerHeight / 6

      if (!inCenterZone && scrolledForSelectorRef.current !== targetSelector) {
        scrolledForSelectorRef.current = targetSelector
        el.scrollIntoView({ behavior: 'smooth', block: 'center' })
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
    const interval = setInterval(compute, 500)
    return () => {
      window.removeEventListener('resize', compute)
      window.removeEventListener('scroll', compute, true)
      clearInterval(interval)
    }
  }, [targetSelector])

  // ── Détecte si le target est dans un modal ouvert (LOTPLOT 23C fix #4) ────
  // On remonte les ancêtres jusqu'à trouver un élément en `position: fixed`
  // OU portant la classe `walkthrough-modal`. Si oui → mode floating bottom.
  const isInModal = (() => {
    if (!targetSelector) return false
    const el = document.querySelector(targetSelector)
    if (!el) return false
    let p = el.parentElement
    while (p) {
      const cs = window.getComputedStyle(p)
      if (cs.position === 'fixed') return true
      if (p.classList.contains('walkthrough-modal')) return true
      p = p.parentElement
    }
    return false
  })()

  // ── Position de la tooltip ──────────────────────────────────────────────────
  // LOTPLOT 23D : algorithme robuste à fallback 4 côtés + détection de
  // débordement. On essaie le côté préféré ; s'il déborde du viewport ou
  // chevauche le target, on essaie l'opposé, puis perpendiculaires, puis on
  // tombe en mode floating bottom (notification persistante).
  const tooltipStyle = (() => {
    const tooltipEl = tooltipRef.current
    const tooltipH = tooltipEl ? tooltipEl.offsetHeight : 160
    const viewportH = window.innerHeight
    const viewportW = window.innerWidth
    const W = Math.min(TOOLTIP_WIDTH, viewportW - 2 * VIEWPORT_PADDING)

    const floatingStyle = {
      position: 'fixed',
      bottom: 24,
      left: '50%',
      transform: 'translateX(-50%)',
      maxWidth: TOOLTIP_WIDTH,
      width: `min(calc(100vw - ${2 * VIEWPORT_PADDING}px), ${TOOLTIP_WIDTH}px)`,
    }

    // Mode floating forcé
    if (tooltipPosition === 'floating' || isInModal) return floatingStyle

    if (!rect) {
      return {
        position: 'fixed',
        left: '50%',
        top: '50%',
        transform: 'translate(-50%, -50%)',
        maxWidth: TOOLTIP_WIDTH,
        width: `min(calc(100vw - ${2 * VIEWPORT_PADDING}px), ${TOOLTIP_WIDTH}px)`,
      }
    }

    // ── Helpers locaux ────────────────────────────────────────────────────
    const computeFor = (pos) => {
      let top, left
      switch (pos) {
        case 'top':
          top = rect.top - TOOLTIP_MARGIN - tooltipH
          left = rect.left + rect.width / 2 - W / 2
          break
        case 'bottom':
          top = rect.bottom + TOOLTIP_MARGIN
          left = rect.left + rect.width / 2 - W / 2
          break
        case 'left':
          top = rect.top + rect.height / 2 - tooltipH / 2
          left = rect.left - TOOLTIP_MARGIN - W
          break
        case 'right':
        default:
          top = rect.top + rect.height / 2 - tooltipH / 2
          left = rect.right + TOOLTIP_MARGIN
          break
      }
      // clamp horizontal mais SANS écraser dans la zone du target — on revérifie
      // juste après avec fitsAndDoesNotOverlap.
      left = Math.max(VIEWPORT_PADDING, Math.min(left, viewportW - W - VIEWPORT_PADDING))
      return { top, left, width: W, height: tooltipH }
    }

    const fitsViewport = (b) =>
      b.top >= STICKY_TOP_OFFSET &&
      b.left >= VIEWPORT_PADDING &&
      b.left + b.width <= viewportW - VIEWPORT_PADDING &&
      b.top + b.height <= viewportH - VIEWPORT_PADDING

    // Strict non-overlap : les 4 conditions de séparation des rectangles.
    const noOverlap = (a, b) =>
      a.left + a.width <= b.left ||
      a.left >= b.left + b.width ||
      a.top + a.height <= b.top ||
      a.top >= b.top + b.height

    // ── Ordre d'essai : préférée → opposée → perpendiculaires ────────────
    const opposite = { top: 'bottom', bottom: 'top', left: 'right', right: 'left' }
    const order = [
      tooltipPosition,
      opposite[tooltipPosition],
      ...(['top', 'bottom'].includes(tooltipPosition) ? ['right', 'left'] : ['bottom', 'top']),
    ]

    for (const pos of order) {
      const candidate = computeFor(pos)
      if (fitsViewport(candidate) && noOverlap(candidate, rect)) {
        return {
          position: 'fixed',
          top: candidate.top,
          left: candidate.left,
          maxWidth: TOOLTIP_WIDTH,
          width: `min(calc(100vw - ${2 * VIEWPORT_PADDING}px), ${TOOLTIP_WIDTH}px)`,
        }
      }
    }

    // Aucun côté ne tient sans déborder ou chevaucher le target → floating.
    // Le spotlight pulse continue de pointer le target ; le tooltip reste lisible
    // au bas du viewport sans jamais masquer le contenu.
    return floatingStyle
  })()

  // ── LOTPLOT 24 : highlight DIRECT du target (Option B) ──────────────────────
  // Plus de "spotlight" via box-shadow inversé (cause de désalignement perçu —
  // le rect de getBoundingClientRect pouvait être stale entre setInterval et
  // repaint). À la place, on ajoute une classe au VRAI bouton du DOM, qui
  // gagne :
  //   - outline 3px solid orange
  //   - glow box-shadow 6px + pulse 2s
  //   - position: relative + z-index: 40 (lift au-dessus du dim z-30)
  //   - pointer-events: auto (reste cliquable)
  // Pattern standard Intercom/Pendo. Aucun risque d'offset entre highlight et
  // bouton réel : c'est le même élément.
  useEffect(() => {
    if (!targetSelector) return
    const el = document.querySelector(targetSelector)
    if (!el) return
    el.classList.add('walkthrough-highlight')
    return () => {
      el.classList.remove('walkthrough-highlight')
    }
  }, [targetSelector])

  return (
    <>
      <style>{`
        @keyframes walkthrough-tooltip-fade {
          from { opacity: 0; transform: translateY(4px); }
          to   { opacity: 1; transform: translateY(0); }
        }
        @keyframes walkthrough-button-pulse {
          0%, 100% { box-shadow: 0 0 0 4px rgba(234, 88, 12, 0.30); }
          50%      { box-shadow: 0 0 0 8px rgba(234, 88, 12, 0.45); }
        }
        .walkthrough-highlight {
          position: relative !important;
          z-index: 40 !important;
          outline: 3px solid #EA580C !important;
          outline-offset: 2px !important;
          border-radius: 8px;
          animation: walkthrough-button-pulse 2s ease-in-out infinite;
          pointer-events: auto !important;
        }
      `}</style>
      {/* Dim full-screen. pointer-events: auto absorbe les clics partout sauf
          sur le target (qui est au z-40, donc au-dessus du dim z-30). */}
      <div
        aria-hidden="true"
        style={{
          position: 'fixed',
          inset: 0,
          background: 'rgba(15, 23, 42, 0.55)',
          pointerEvents: 'auto',
          zIndex: 30,
        }}
      />

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
