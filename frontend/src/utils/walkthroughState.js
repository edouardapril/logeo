// LOTPLOT 23 — Persistance sessionStorage du walkthrough /exemple.
// Le state survit à un refresh ou à une nav vers une autre page de la même
// session, mais est purgé à la fermeture de l'onglet (cohérent avec une démo
// éphémère). En cas de corruption (JSON invalide, schéma incompatible) on
// auto-reset proprement plutôt que d'afficher une page cassée.

const KEY = 'logeo_walkthrough_state'

const DEFAULT_STATE = {
  role: null,                    // 'acheteur' | 'courtier' | null
  step_index: 0,
  step_id: 'intro',
  user_max_bid: null,
  current_price: 800_000,        // floor pour le sample (cohérent avec seed LOTPLOT 21)
  ranking_position: 1,
  competing_bids: [],
  emails_received: [],           // { id, type, subject, from, body_html, at, read }
  fake_buyers_signed: 0,         // courtier flow
  fake_buyers_bidding: 0,        // courtier flow
  started_at: null,
}

export function readState() {
  try {
    const raw = sessionStorage.getItem(KEY)
    if (!raw) return null
    const parsed = JSON.parse(raw)
    // Validation minimale du schéma — si un champ critique manque, reset.
    if (typeof parsed !== 'object' || parsed === null) return null
    if (!('role' in parsed) || !('step_index' in parsed)) return null
    return { ...DEFAULT_STATE, ...parsed }
  } catch {
    return null
  }
}

export function writeState(state) {
  try {
    sessionStorage.setItem(KEY, JSON.stringify(state))
  } catch {
    // Quota dépassé ou storage désactivé — on ne casse pas la démo, on
    // perd juste la persistance entre refresh.
  }
}

export function clearState() {
  try { sessionStorage.removeItem(KEY) } catch {}
}

export function initState(role) {
  const s = {
    ...DEFAULT_STATE,
    role,
    step_index: 0,
    step_id: 'intro',
    started_at: Date.now(),
  }
  writeState(s)
  return s
}

export function pushEmail(state, email) {
  // LOTPLOT 23C — dedup : si un email du même `type` existe déjà, on
  // incrémente son compteur + on remonte son horodatage à maintenant
  // (pour qu'il reste en haut). Sinon on ajoute une nouvelle entrée.
  const existing = state.emails_received.find(e => e.type === email.type)
  if (existing) {
    const next = {
      ...state,
      emails_received: state.emails_received.map(e =>
        e.id === existing.id
          ? {
              ...e,
              count: (e.count || 1) + 1,
              at: Date.now(),
              read: false,
              // Garde le subject/body du nouveau (potentiellement plus à jour)
              subject: email.subject ?? e.subject,
              body_html: email.body_html ?? e.body_html,
              from: email.from ?? e.from,
            }
          : e,
      ),
    }
    writeState(next)
    return next
  }
  const next = {
    ...state,
    emails_received: [
      ...state.emails_received,
      {
        id: `email-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
        at: Date.now(),
        read: false,
        count: 1,
        ...email,
      },
    ],
  }
  writeState(next)
  return next
}

export function markEmailRead(state, emailId) {
  const next = {
    ...state,
    emails_received: state.emails_received.map(e =>
      e.id === emailId ? { ...e, read: true } : e,
    ),
  }
  writeState(next)
  return next
}

export function patchState(state, patch) {
  const next = { ...state, ...patch }
  writeState(next)
  return next
}

export const DEFAULT_WALKTHROUGH_STATE = DEFAULT_STATE
