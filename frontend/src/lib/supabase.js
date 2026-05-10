// LOTPLOT 28 — Client Supabase initialisé une fois pour toute la SPA.
// Toute l'auth (login/signup/reset/refresh) passe par cette instance.
import { createClient } from '@supabase/supabase-js'

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY

if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
  // eslint-disable-next-line no-console
  console.error(
    '[supabase] VITE_SUPABASE_URL et/ou VITE_SUPABASE_ANON_KEY manquantes. '
    + 'L\'auth ne fonctionnera pas. Ajoute-les dans frontend/.env.local.'
  )
}

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: {
    // Persiste la session dans localStorage et auto-refresh les tokens
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true,
  },
})
