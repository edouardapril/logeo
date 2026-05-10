import { createContext, useContext, useState, useCallback, useEffect } from 'react'

const AuthContext = createContext(null)

const readJson = (k) => {
  try { const v = localStorage.getItem(k); return v ? JSON.parse(v) : null } catch { return null }
}

export function AuthProvider({ children }) {
  const [user, setUser] = useState(() => readJson('logeo_user'))

  // Nettoyage one-shot des reliquats d'impersonation (LOTPLOT 17 : feature retirée).
  // Sans ça, les sessions existantes garderaient un token impersonation actif
  // pointant vers un endpoint backend qui n'existe plus → 404 silencieux.
  useEffect(() => {
    const stale = localStorage.getItem('logeo_impersonation')
    if (stale) localStorage.removeItem('logeo_impersonation')
  }, [])

  const login = useCallback((tokenResponse) => {
    localStorage.setItem('logeo_token', tokenResponse.access_token)
    const userData = {
      id: tokenResponse.user_id,
      role: tokenResponse.role,
    }
    localStorage.setItem('logeo_user', JSON.stringify(userData))
    setUser(userData)
  }, [])

  const logout = useCallback(() => {
    localStorage.removeItem('logeo_token')
    localStorage.removeItem('logeo_user')
    setUser(null)
  }, [])

  return (
    <AuthContext.Provider value={{ user, login, logout }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used inside AuthProvider')
  return ctx
}
