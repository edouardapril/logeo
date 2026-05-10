// LOTPLOT 23C — Toast manager pour le walkthrough.
//
// Wraps react-hot-toast pour ajouter :
//   - dedup par message (re-firing avec même texte → reset timer du toast
//     existant, pas de doublon empilé) ;
//   - max 2 toasts visibles simultanément, queue FIFO pour les autres ;
//   - durée fixe 4 s, animation slide gérée par react-hot-toast natif.
//
// Le bug originel (LOTPLOT 23C contexte) venait d'un effect avec `onPushEmail`
// dans ses deps, ré-exécuté à chaque render → cascade de 7+ toasts identiques.
// Ce manager couvre AUSSI ce cas si le bug réapparaît : tous les toasts avec
// même contenu sont collapsés sur un id stable.

import toast from 'react-hot-toast'

const MAX_VISIBLE = 2
const DURATION = 4000

const active = new Map() // id → setTimeout handle (auto-dismiss)
const queue = []         // [{ id, message, opts }]

function hashString(s) {
  let h = 0
  for (let i = 0; i < s.length; i++) {
    h = ((h << 5) - h + s.charCodeAt(i)) | 0
  }
  return Math.abs(h).toString(36)
}

function show(id, message, opts) {
  // Si ce toast est déjà visible, on ne ré-empile pas — on reset son timer
  // (effet "pulse" via react-hot-toast qui re-render avec le même id).
  if (active.has(id)) {
    clearTimeout(active.get(id))
    toast(message, { id, duration: DURATION, ...opts })
    active.set(id, setTimeout(() => onDismiss(id), DURATION))
    return
  }

  // Capacité max — file d'attente
  if (active.size >= MAX_VISIBLE) {
    // Si l'id est déjà en queue, ne pas dupliquer (juste mettre à jour le payload)
    const existingIdx = queue.findIndex(q => q.id === id)
    if (existingIdx >= 0) {
      queue[existingIdx] = { id, message, opts }
    } else {
      queue.push({ id, message, opts })
    }
    return
  }

  toast(message, { id, duration: DURATION, ...opts })
  active.set(id, setTimeout(() => onDismiss(id), DURATION))
}

function onDismiss(id) {
  active.delete(id)
  toast.dismiss(id)
  if (queue.length > 0 && active.size < MAX_VISIBLE) {
    const next = queue.shift()
    show(next.id, next.message, next.opts)
  }
}

/**
 * Affiche un toast walkthrough avec dedup + cap visible à 2.
 * @param {string} message  Texte affiché. Sert aussi de clé de dedup par défaut.
 * @param {object} opts     Options react-hot-toast (icon, style, etc.) + `dedupKey` optionnel.
 */
export function wkToast(message, opts = {}) {
  const id = opts.dedupKey
    ? `wk-${hashString(opts.dedupKey)}`
    : opts.id || `wk-${hashString(message)}`
  const { dedupKey, ...rest } = opts
  show(id, message, rest)
}

wkToast.success = (message, opts = {}) =>
  wkToast(message, { ...opts, icon: opts.icon || '✓', style: { background: '#10b981', color: 'white' } })

wkToast.error = (message, opts = {}) =>
  wkToast(message, { ...opts, icon: opts.icon || '✕', style: { background: '#ef4444', color: 'white' } })

/** Cleanup complet — utile au reset du walkthrough. */
export function clearWalkthroughToasts() {
  active.forEach((t) => clearTimeout(t))
  active.clear()
  queue.length = 0
  toast.dismiss()
}
