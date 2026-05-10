# Alembic migrations différées

⚠️  **Ce dossier est volontairement HORS du scope d'alembic** (`script_location/versions`).
Les migrations qui s'y trouvent ne sont PAS découvertes ni appliquées par
`alembic upgrade head`. On les active manuellement quand on veut vraiment
les appliquer.

## Migrations actuellement différées

### `7a8b9c0d1e2f_lotplot28_restore_profiles_auth_fk.py`

**À appliquer après** `migrate_users_to_supabase.py` (qui peuple auth.users).
Restaure le FK `public.profiles.id → auth.users(id) ON DELETE CASCADE` qui
avait été droppé par la migration `6f708192a3b4` pour permettre de peupler
profiles avant que auth.users existe.

Garde-fou : la migration `upgrade()` raise une `RuntimeError` explicite si
`auth.users` est vide → impossible d'appliquer trop tôt.

**Activation** :
```bash
mv backend/alembic/versions_deferred/7a8b9c0d1e2f_lotplot28_restore_profiles_auth_fk.py \
   backend/alembic/versions/
# Vérifier que down_revision pointe sur le head actuel (8192a3b4c5d6 normalement)
alembic upgrade head
git add backend/alembic/versions/7a8b9c0d1e2f_lotplot28_restore_profiles_auth_fk.py
git commit -m "Apply LOTPLOT 28-SEQ restore_profiles_auth_fk"
git push
```

### `708192a3b4c5_lotplot28_drop_users_DEFERRED.py`

DROP de `public.users` après le cutover LOTPLOT 28. À appliquer **APRÈS
24-48 h** de validation en production que :
- Tous les users existants peuvent se logger via Supabase
- L'app fonctionne intégralement sur les nouvelles FK vers `profiles`
- Aucun code résiduel ne lit `public.users`

**Avant de déplacer dans versions/**, faire un dump SQL préventif :
```bash
pg_dump -t public.users $DATABASE_URL > backup_users_pre_drop_$(date +%Y%m%d).sql
```

Puis re-chaîner `down_revision` vers le head courant et appliquer.

### `9a8b7c6d5e4f_merge_lotplot28_branches.py`

Merge entre RLS et DROP DEFERRED. **N'est utile QUE si tu décides d'appliquer
DROP USERS** en même temps que les autres migrations LOTPLOT 28. Sans le
DEFERRED dans versions/, ce merge est inutile.

Si tu décides un jour de drop public.users :
1. Déplacer le DEFERRED dans versions/
2. Déplacer ce merge dans versions/
3. `alembic upgrade head` appliquera les deux

## Comment activer une migration différée — pattern général

1. Faire un **dump SQL préventif** si destructive
2. **Déplacer le fichier** vers `alembic/versions/`
3. **Re-chaîner si nécessaire** : si le `down_revision` du fichier pointe
   sur une révision qui n'est plus le HEAD actuel, mettre à jour
4. **Appliquer** :
   ```bash
   alembic upgrade head
   ```
5. Commit + push → Railway redéploie
