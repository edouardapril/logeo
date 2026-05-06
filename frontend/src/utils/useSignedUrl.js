import { useState, useEffect } from 'react'
import client from '../api/client'
import { fileUrl } from './url'

const KNOWN_PRIVATE_BUCKETS = new Set(['documents', 'profiles'])

function isPrivateSupabasePath(p) {
  if (!p) return false
  const head = String(p).split('/')[0]
  return KNOWN_PRIVATE_BUCKETS.has(head)
}

/**
 * Hook qui retourne une URL prête à être mise dans <img> ou <a>.
 * - Pour les paths locaux ou les buckets publics → retourne immédiatement fileUrl(path)
 * - Pour les buckets privés Supabase (documents, profiles) → fetch /storage/sign avec
 *   le token Bearer puis renvoie l'URL signée, mise en cache côté composant.
 */
export function useSignedUrl(path) {
  const [url, setUrl] = useState(() => isPrivateSupabasePath(path) ? null : fileUrl(path))

  useEffect(() => {
    if (!path) { setUrl('#'); return }
    if (!isPrivateSupabasePath(path)) {
      setUrl(fileUrl(path))
      return
    }
    let cancelled = false
    client
      .get('/storage/sign', { params: { path } })
      .then(r => { if (!cancelled) setUrl(r.data?.url || '#') })
      .catch(() => { if (!cancelled) setUrl('#') })
    return () => { cancelled = true }
  }, [path])

  return url
}
