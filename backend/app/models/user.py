"""LOTPLOT 28 — Module transitionnel.

Avant : modèle SQLAlchemy `User` qui mappait `public.users` (avec
hashed_password, sessions custom).

Après LOTPLOT 28 : Supabase Auth gère les credentials. Le modèle métier
est `Profile` (cf. `app/models/profile.py`), qui mappe `public.profiles`
avec id = auth.users.id.

Ce fichier ré-exporte `Profile as User` + `UserRole` pour que les
~30 imports existants `from app.models.user import User, UserRole`
continuent de fonctionner sans modification de masse. Une fois la
migration validée et un sed appliqué, ce fichier peut être supprimé.

Commande sed pour finaliser le rename :

    grep -rl "from app.models.user import" backend/app | \\
      xargs sed -i 's|from app.models.user import|from app.models.profile import|g'

Puis :

    grep -rl "import User" backend/app | \\
      xargs sed -i 's|import User|import Profile as User|g'

(Le second sed est optionnel — on peut conserver l'alias User=Profile
côté code, c'est juste pour la cohérence sémantique.)
"""
from app.models.profile import Profile, UserRole

# Alias rétrocompat
User = Profile

__all__ = ["User", "UserRole", "Profile"]
