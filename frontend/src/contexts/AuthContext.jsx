import { createContext, useContext, useState, useCallback } from 'react'

const AuthContext = createContext(null)

const readJson = (k) => {
  try { const v = localStorage.getItem(k); return v ? JSON.parse(v) : null } catch { return null }
}

export function AuthProvider({ children }) {
  const [user, setUser] = useState(() => readJson('logeo_user'))
  // Mode impersonation : token de l'admin original sauvegardé pour pouvoir
  // sortir et restaurer la session normale.
  const [impersonation, setImpersonation] = useState(() => readJson('logeo_impersonation'))

  const login = useCallback((tokenResponse) => {
    localStorage.setItem('logeo_token', tokenResponse.access_token)
    const userData = {
      id: tokenResponse.user_id,
      role: tokenResponse.role,
    }
    localStorage.setItem('logeo_user', JSON.stringify(userData))
    setUser(userData)
    // Login standard = on sort de l'impersonation s'il y en avait une
    localStorage.removeItem('logeo_impersonation')
    setImpersonation(null)
  }, [])

  const logout = useCallback(() => {
    localStorage.removeItem('logeo_token')
    localStorage.removeItem('logeo_user')
    localStorage.removeItem('logeo_impersonation')
    setUser(null)
    setImpersonation(null)
  }, [])

  /**
   * Active une session impersonation.
   * - Sauvegarde le token admin actuel + son user dans `logeo_impersonation`.
   * - Remplace le token courant par celui de l'impersonation et l'user effectif.
   */
  const startImpersonation = useCallback((tokenResponse, targetMeta) => {
    const adminToken = localStorage.getItem('logeo_token')
    const adminUser = readJson('logeo_user')
    const session = {
      admin_token: adminToken,
      admin_user: adminUser,
      target: targetMeta,  // { id, full_name, email, role }
    }
    localStorage.setItem('logeo_impersonation', JSON.stringify(session))
    localStorage.setItem('logeo_token', tokenResponse.access_token)
    const newUser = { id: tokenResponse.user_id, role: tokenResponse.role }
    localStorage.setItem('logeo_user', JSON.stringify(newUser))
    setImpersonation(session)
    setUser(newUser)
  }, [])

  /** Restaure le token admin original. */
  const exitImpersonation = useCallback((tokenResponse) => {
    if (tokenResponse) {
      localStorage.setItem('logeo_token', tokenResponse.access_token)
      const adminUser = { id: tokenResponse.user_id, role: tokenResponse.role }
      localStorage.setItem('logeo_user', JSON.stringify(adminUser))
      setUser(adminUser)
    } else {
      // Fallback : restaure depuis le snapshot local
      const snap = readJson('logeo_impersonation')
      if (snap?.admin_token) {
        localStorage.setItem('logeo_token', snap.admin_token)
        localStorage.setItem('logeo_user', JSON.stringify(snap.admin_user))
        setUser(snap.admin_user)
      }
    }
    localStorage.removeItem('logeo_impersonation')
    setImpersonation(null)
  }, [])

  return (
    <AuthContext.Provider value={{
      user, login, logout,
      impersonation,
      isImpersonating: !!impersonation,
      startImpersonation, exitImpersonation,
    }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used inside AuthProvider')
  return ctx
}
