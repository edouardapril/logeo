# LOTPLOT 28 — Migration auth custom → Supabase Auth

## Vue d'ensemble

Migration de l'auth maison (bcrypt + JWT custom dans `public.users`) vers
**Supabase Auth** + table métier `public.profiles`.

- `auth.users` (managé par Supabase) → credentials, sessions, MFA, reset
- `public.profiles` → données métier (id = auth.users.id, FK CASCADE)
- Backend FastAPI vérifie les JWT Supabase via HS256 + JWT secret
- Frontend utilise `@supabase/supabase-js` pour login/signup/reset

**UUIDs préservés** durant la migration → aucune FK ne casse.

---

## Pré-requis

1. **Projet Supabase** créé (free tier OK pour MVP).
2. Récupère 4 valeurs depuis `Settings → API` :
   - `SUPABASE_URL` (https://xxxx.supabase.co)
   - `SUPABASE_ANON_KEY` (public, frontend + lecture serveur)
   - `SUPABASE_SERVICE_ROLE_KEY` (admin, script de migration **uniquement**)
   - `SUPABASE_JWT_SECRET` (HS256 secret pour vérifier les JWT côté backend)
3. Ajoute-les dans :
   - `backend/.env`
   - `frontend/.env.local` (les `VITE_*`)
4. Installe la nouvelle dep frontend :
   ```bash
   cd frontend && npm install
   # ajoute @supabase/supabase-js (déjà dans package.json après ce LOTPLOT)
   ```

---

## Exécution séquentielle (les phases sont indépendantes mais ordonnées)

### Phase 1 — Migration schema (sans toucher aux users)

```bash
cd backend
alembic upgrade 5e6f708192a3   # crée public.profiles + triggers
```

**Smoke test** :
```sql
SELECT count(*) FROM public.profiles;             -- 0 attendu
SELECT count(*) FROM public.users;                -- nb users actuels
SELECT proname FROM pg_proc WHERE proname='handle_new_user';   -- 1 row
```

### Phase 2 — Migration des users existants vers Supabase Auth

```bash
cd backend
python -m scripts.migrate_users_to_supabase
```

Le script :
- itère sur `public.users`
- crée chaque user dans `auth.users` via `POST /auth/v1/admin/users` avec
  `id` (UUID préservé) + `password_hash` (bcrypt $2b$ accepté tel quel)
- UPSERT le profile dans `public.profiles`
- log toutes les opérations, exit code 2 si erreurs

**Smoke test** :
```sql
-- Égalité des comptes
SELECT (SELECT count(*) FROM auth.users) AS auth_users,
       (SELECT count(*) FROM public.users) AS legacy_users,
       (SELECT count(*) FROM public.profiles) AS profiles;
-- Les 3 valeurs doivent être égales

-- Vérifier qu'aucun UUID ne diverge
SELECT u.id AS legacy, au.id AS auth, p.id AS profile
FROM public.users u
FULL OUTER JOIN auth.users au ON au.id = u.id
FULL OUTER JOIN public.profiles p ON p.id = u.id
WHERE u.id IS NULL OR au.id IS NULL OR p.id IS NULL;
-- 0 rows attendu (zéro divergence)
```

**Test de login** : se connecter sur `/login` avec un user existant
(ex. `edouard@auctor.ca` + son mot de passe actuel). Doit fonctionner via
supabase-js.

### Phase 3 — Bascule des FK vers profiles

```bash
alembic upgrade 6f708192a3b4
```

Cette migration drop les FK pointant vers `public.users(id)` et les
re-crée vers `public.profiles(id)`. Sémantiquement équivalent (les UUIDs
sont les mêmes). À ce stade, `public.users` n'est plus référencée par
aucune FK active.

**Smoke test** :
```sql
SELECT tc.table_name, kcu.column_name, ccu.table_name AS refs
FROM information_schema.table_constraints tc
JOIN information_schema.key_column_usage kcu USING (constraint_schema, constraint_name)
JOIN information_schema.constraint_column_usage ccu USING (constraint_schema, constraint_name)
WHERE tc.constraint_type='FOREIGN KEY' AND ccu.table_name IN ('users','profiles');
-- Toutes les rows doivent référencer 'profiles', plus aucune 'users'
```

### Phase 4 — RLS policies

```bash
alembic upgrade 8192a3b4c5d6
```

Active RLS sur 12 tables sensibles + crée les policies permissives
(admin sees all + own rows). Le helper `public.get_user_role()` lit
le role du user courant depuis `profiles`.

**Smoke test** :
```sql
-- En tant qu'admin (via Supabase SQL editor avec une session admin) :
SELECT * FROM public.deals LIMIT 5;  -- OK

-- En tant qu'acheteur (via supabase-js connecté) :
SELECT * FROM public.bids;  -- ne renvoie que ses propres bids
SELECT * FROM public.email_logs;  -- 0 rows (admin only)
```

### Phase 5 — Cutover backend (déjà fait par le code de ce LOTPLOT)

- `app/services/auth.py` ré-exporte `supabase_auth.get_current_user`
- `app/routers/auth.py` retourne 410 sur tous les endpoints credentials
  legacy (login/register/verify/resend). Reste `/auth/me` et `/me/session`
- `app/models/user.py` ré-exporte `Profile as User` pour rétrocompat

**Pour finaliser le rename `User → Profile` (optionnel, propreté) :**

```bash
# Linux/WSL
grep -rl "from app.models.user import" backend/app | \
  xargs sed -i 's|from app.models.user import|from app.models.profile import|g'

# macOS
grep -rl "from app.models.user import" backend/app | \
  xargs sed -i '' 's|from app.models.user import|from app.models.profile import|g'

# Tester
python -c "from app.main import app; print('OK')"
```

Puis supprime `backend/app/models/user.py` quand tout passe.

### Phase 6 — DROP public.users (à exécuter APRÈS 24-48h de validation prod)

```bash
alembic upgrade 708192a3b4c5
```

⚠️  Cette migration drop `public.users` définitivement. Faire un dump
SQL avant pour pouvoir restaurer si problème :

```bash
pg_dump -t public.users $DATABASE_URL > backup_users_pre_drop.sql
```

---

## Configuration Supabase (à faire dans le dashboard)

1. **Authentication → Email Templates** : adapter les templates FR/QC
   (confirm signup, magic link, reset password). Logo Logeo orange.
2. **Authentication → URL Configuration** :
   - Site URL : `https://logeo.ca`
   - Redirect URLs : `https://logeo.ca`, `https://logeo.ca/reset-password`
3. **Authentication → Providers → Email** :
   - "Confirm email" : activé (les imports passent en
     `email_confirm: true` donc bypass)
4. **Database → Functions** : vérifier que `handle_new_user` et
   `get_user_role` sont bien listées (créées par les migrations).

---

## Variables d'env récap

| Variable | Backend `.env` | Frontend `.env.local` |
|---|---|---|
| `SUPABASE_URL` | ✓ | (via `VITE_SUPABASE_URL`) |
| `SUPABASE_ANON_KEY` | ✓ (optionnel) | ✓ (`VITE_SUPABASE_ANON_KEY`) |
| `SUPABASE_SERVICE_ROLE_KEY` | ✓ (script migration only) | ✗ jamais |
| `SUPABASE_JWT_SECRET` | ✓ | ✗ |

---

## Rollback d'urgence

Si problème en production :

1. **Phase 4 (RLS) → revenir** :
   ```bash
   alembic downgrade 6f708192a3b4
   ```
2. **Phase 3 (FK switch) → revenir** :
   ```bash
   alembic downgrade 5e6f708192a3
   ```
3. **Phase 1+2 (profiles + auth.users) → revenir** :
   ```bash
   alembic downgrade 4d5e6f708192   # drop profiles + triggers
   ```
   Les rows dans `auth.users` restent — pour les nettoyer, utiliser
   `supabase.auth.admin.deleteUser(id)` pour chacun.

**Le frontend devra retourner sur un commit pré-LOTPLOT 28** (l'AuthContext
nouveau ne fonctionne pas sans Supabase). Pas de "rollback partiel" possible
au-delà de la Phase 3 — le backend FastAPI ne sait plus émettre de tokens.

---

## Smoke tests post-cutover

- [ ] Login : 3 users existants se connectent avec leur mot de passe actuel
- [ ] Signup acheteur : crée un compte → email confirmation reçu → confirme →
      login → atterrit sur `/acheteur/deals`
- [ ] Signup courtier : idem → atterrit sur `/courtier`
- [ ] Reset password : `supabase.auth.resetPasswordForEmail` → email reçu →
      lien fonctionne → nouveau password fonctionne
- [ ] Admin accède aux pages admin (`/admin/*`)
- [ ] Courtier accède à `/courtier/*`, refuse `/admin/*` (401/403)
- [ ] Acheteur accède à `/acheteur/*`, refuse `/admin/*`
- [ ] API protégée sans token → 401
- [ ] API protégée avec token Supabase invalide → 401
- [ ] Soft delete user (LOTPLOT 20E) → user ne peut plus se logger
      (`auth.users` reste, mais `profiles.deleted_at` non null → 401)

---

## Fichiers livrés par ce LOTPLOT

**Migrations Alembic** :
- `5e6f708192a3_lotplot28_create_profiles.py`
- `6f708192a3b4_lotplot28_fk_users_to_profiles.py`
- `8192a3b4c5d6_lotplot28_rls_policies.py`
- `708192a3b4c5_lotplot28_drop_users_DEFERRED.py` (à appliquer après validation)

**Script** :
- `backend/scripts/migrate_users_to_supabase.py`

**Backend** :
- `app/models/profile.py` (nouveau, Profile + UserRole)
- `app/models/user.py` (re-export transitionnel User = Profile)
- `app/services/supabase_auth.py` (nouveau, vérification JWT HS256)
- `app/services/auth.py` (re-export des dépendances Supabase + garde-fous)
- `app/routers/auth.py` (endpoints legacy → 410, `/me` conservé)
- `app/config.py` (env vars SUPABASE_*)
- `.env.example` (mise à jour)

**Frontend** :
- `src/lib/supabase.js` (nouveau, client supabase-js)
- `src/contexts/AuthContext.jsx` (rewrite complet)
- `src/pages/auth/Login.jsx` (utilise `useAuth().signIn`)
- `src/pages/auth/RegisterAcheteur.jsx` (utilise `useAuth().signUp`)
- `src/pages/auth/RegisterCourtier.jsx` (idem)
- `src/api/client.js` (interceptor → Bearer access_token Supabase)
- `package.json` (ajout `@supabase/supabase-js`)
- `.env.example` (mise à jour)

---

## Notes de design

- **Pourquoi HS256 et pas JWKS** : Supabase emit des JWT HS256 par défaut.
  La rotation des keys est plus simple, le secret est court à transmettre.
  JWKS endpoint n'est pas exposé par Supabase actuellement (sauf "Asymmetric
  JWT" beta).
- **Pourquoi pas de `password_verify` côté backend** : redondant avec
  Supabase. Si on le garde, on risque de drifter avec le hash dans auth.users.
- **Pourquoi un trigger `handle_new_user` plutôt que créer le profile
  manuellement à chaque signup** : robuste contre les signups via Magic Link,
  OAuth providers, ou Supabase Studio admin manuel. Single source of truth.
- **Pourquoi `User = Profile` plutôt qu'un sed global immédiat** : éviter
  un PR de 30 fichiers où le seul changement est un import. Le sed peut
  être lancé une fois la migration validée.
- **RLS permissif vs strict** : permissif évite les blocages MVP.
  Si un endpoint sensible passe la barre admin par erreur, le backend
  FastAPI gardera ses propres gates `require_admin` en complément (defense
  in depth).
