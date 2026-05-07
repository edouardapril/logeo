const API_BASE = (import.meta.env.VITE_API_URL || '').replace(/\/$/, '')
const SUPABASE_URL = (import.meta.env.VITE_SUPABASE_URL || '').replace(/\/$/, '')

const KNOWN_BUCKETS = new Set(['deals', 'documents', 'profiles'])

function isSupabasePath(p) {
  if (!p) return false
  const head = p.split('/')[0]
  return KNOWN_BUCKETS.has(head)
}

/**
 * URL utilisable telle quelle pour afficher un fichier.
 *
 *  Cas pris en charge :
 *   - "uploads/..."        → backend local (`${API}/uploads/...`)
 *   - "deals/..."          → bucket Supabase public ; URL publique directe
 *   - "documents/..."      → bucket privé ; renvoie l'endpoint `/storage/sign?path=...`
 *                            (le navigateur suivra la redirection 302 du backend
 *                            ou cette URL peut être appelée par fetch et résolue côté code)
 *   - "profiles/..."       → idem privé (signed URL)
 *
 *  Pour les fichiers privés, le helper retourne une URL pointant vers le backend
 *  qui résout la signed URL — le client doit être authentifié quand il appelle ce path.
 */
export function fileUrl(path) {
  if (!path) return '#'

  // Le backend renvoie désormais des URLs full (public_url / signed_url) directement
  // sur la plupart des endpoints (fix paths→URLs). On les laisse passer telles quelles ;
  // la logique ci-dessous reste utile pour les endpoints qui renvoient encore des paths
  // bruts (ex: POST /deals/{id}/photos retourne photo_paths brut pour le flux teaser-selection).
  if (/^https?:\/\//i.test(path)) return path

  let p = String(path).replace(/\\/g, '/').replace(/^\.?\/+/, '')

  if (p.startsWith('uploads/')) return `${API_BASE}/${p}`

  if (isSupabasePath(p)) {
    const head = p.split('/')[0]
    // Bucket "deals" est public → URL publique directe (pas besoin de signer)
    if (head === 'deals' && SUPABASE_URL) {
      return `${SUPABASE_URL}/storage/v1/object/public/${p}`
    }
    // Buckets privés → signer côté backend
    return `${API_BASE}/api/v1/storage/sign?path=${encodeURIComponent(p)}`
  }

  // Fallback : assume "uploads/" prefix manquant
  return `${API_BASE}/uploads/${p}`
}
