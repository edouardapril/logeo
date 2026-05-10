import { createContext, useContext, useEffect, useState, useCallback } from 'react'
import { supabase } from '../lib/supabase'
import client from '../api/client'

// LOTPLOT 28 — AuthContext basé sur Supabase Auth.
//
// Avant : login/signup côté backend custom, JWT custom stocké dans localStorage
//         logeo_token, user shape { id, role } stocké dans logeo_user.
// Après : Supabase gère credentials + sessions. On expose :
//   - session  : objet Supabase Session ou null (contient access_token)
//   - profile  : profile complet métier (role, full_name, etc.) depuis
//                GET /api/v1/auth/me, fetché après auth
//   - user     : { id, role } — shape de compat avec l'ancien code

const AuthContext = createContext(null)

export function AuthProvider({ children }) {
  const [session, setSession] = useState(null)
  const [profile, setProfile] = useState(null)
  const [loading, setLoading] = useState(true)

  // Récupère le profile métier depuis le backend (qui le lit dans
  // public.profiles via le JWT Supabase). Stocke `user` simple pour compat.
  const fetchProfile = useCallback(async () => {
    try {
      const r = await client.get('/auth/me')
      setProfile(r.data)
      return r.data
    } catch (e) {
      // Si le profile n'existe pas (race au signup ou compte supprimé),
      // on déconnecte proprement pour repartir d'un état clean.
      // eslint-disable-next-line no-console
      console.error('[auth] échec fetch profile', e?.response?.status)
      setProfile(null)
      return null
    }
  }, [])

  // Bootstrap : récupère la session existante au mount + abonne aux changements
  useEffect(() => {
    let mounted = true

    supabase.auth.getSession().then(async ({ data: { session: s } }) => {
      if (!mounted) return
      setSession(s)
      if (s) await fetchProfile()
      setLoading(false)
    })

    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (_event, s) => {
      if (!mounted) return
      setSession(s)
      if (s) {
        await fetchProfile()
      } else {
        setProfile(null)
      }
    })

    return () => {
      mounted = false
      subscription?.unsubscribe()
    }
  }, [fetchProfile])

  const signIn = useCallback(async (email, password) => {
    const { data, error } = await supabase.auth.signInWithPassword({ email, password })
    if (error) throw error
    // L'event listener au-dessus va fetcher le profile automatiquement.
    return data
  }, [])

  const signUp = useCallback(async (email, password, metadata = {}) => {
    // metadata.role/full_name/oaciq_number/agency_name → consommés par le
    // trigger handle_new_user pour créer la row dans public.profiles.
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: { data: metadata },
    })
    if (error) throw error
    return data
  }, [])

  const signOut = useCallback(async () => {
    await supabase.auth.signOut()
    setSession(null)
    setProfile(null)
  }, [])

  const resetPassword = useCallback(async (email) => {
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/reset-password`,
    })
    if (error) throw error
  }, [])

  // Shape de compat avec l'ancien code : `user` = { id, role }
  const user = profile
    ? { id: profile.id, role: profile.role }
    : null

  return (
    <AuthContext.Provider value={{
      session,
      profile,
      user,
      loading,
      signIn,
      signUp,
      signOut,
      resetPassword,
      // Compat avec ancien API utilisé dans Layout/AdminUsers/etc.
      logout: signOut,
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
