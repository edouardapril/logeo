import axios from 'axios'

const baseURL = `${import.meta.env.VITE_API_URL || ''}/api/v1`

if (typeof window !== 'undefined') {
  // Log au boot pour vérifier rapidement la config
  // eslint-disable-next-line no-console
  console.info('[logeo/api] baseURL =', baseURL)
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
    return Promise.reject(error)
  }
)

export default client
