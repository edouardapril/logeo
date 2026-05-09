import axios from 'axios'

const baseURL = `${import.meta.env.VITE_API_URL || ''}/api/v1`

if (typeof window !== 'undefined') {
  // Log au boot pour vérifier rapidement la config
  // eslint-disable-next-line no-console
  console.info('[logeo/api] baseURL =', baseURL)
}

// Timeout dédié aux uploads multipart (photos > 5 MB sur connexion résidentielle).
// Chaîne complète : axios → uvicorn → httpx → Supabase. httpx côté backend est
// à 120 s (storage._UPLOAD_TIMEOUT). On donne 180 s au client pour laisser ~60 s
// de marge au backend pour traiter la réponse + le scan watermark + le retour.
export const UPLOAD_TIMEOUT_MS = 180_000
export const uploadConfig = {
  headers: { 'Content-Type': 'multipart/form-data' },
  timeout: UPLOAD_TIMEOUT_MS,
}

const client = axios.create({
  baseURL,
  headers: { 'Content-Type': 'application/json' },
  timeout: 15000,
})

client.interceptors.request.use((config) => {
  const token = localStorage.getItem('logeo_token')
  if (token) config.headers.Authorization = `Bearer ${token}`
  return config
})

client.interceptors.response.use(
  (res) => res,
  (error) => {
    // Diagnostic riche dans la console — visible au lieu du toast générique
    const url = `${error.config?.baseURL || ''}${error.config?.url || ''}`
    const method = (error.config?.method || 'GET').toUpperCase()
    if (error.response) {
      // eslint-disable-next-line no-console
      console.error(
        `[logeo/api] ${method} ${url} → HTTP ${error.response.status}`,
        error.response.data,
      )
    } else if (error.request) {
      // eslint-disable-next-line no-console
      console.error(
        `[logeo/api] ${method} ${url} → NO RESPONSE`,
        { code: error.code, message: error.message },
      )
    } else {
      // eslint-disable-next-line no-console
      console.error('[logeo/api] setup error:', error.message)
    }

    if (error.response?.status === 401) {
      localStorage.removeItem('logeo_token')
      localStorage.removeItem('logeo_user')
      window.location.href = '/login'
    }

    // Timeout client (axios annule la requête après config.timeout ms). Sans ce
    // détail, les composants affichent "Erreur" générique parce qu'ils lisent
    // `error.response?.data?.detail`. On greffe un detail explicite pour les
    // uploads multipart, qui sont la source de presque tous les timeouts vus
    // (gros fichiers + connexion résidentielle saturée).
    if (
      (error.code === 'ECONNABORTED' || error.message?.includes('timeout'))
      && !error.response
    ) {
      const isUpload = error.config?.headers?.['Content-Type']?.includes('multipart')
      error.response = {
        status: 408,
        data: {
          detail: isUpload
            ? "Le téléversement prend plus de temps que prévu. Vérifiez votre connexion ou réessayez avec moins de photos."
            : "La requête a expiré. Vérifiez votre connexion et réessayez.",
        },
      }
    }

    return Promise.reject(error)
  }
)

export default client
