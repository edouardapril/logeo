"""Alembic env.py — driver SYNC (psycopg2) pour les migrations.

LOTPLOT 28-DBFIX : avant ce fix, Alembic utilisait `async_engine_from_config`
avec le driver asyncpg. asyncpg refuse les multi-statement `execute()` ("cannot
insert multiple commands into a prepared statement"). Plusieurs migrations
LOTPLOT 28 utilisent `op.execute("CREATE TABLE ...; CREATE INDEX ...; ...")`.

Solution : Alembic passe en sync via psycopg2. Le runtime de l'app
(`app/database.py`) reste inchangé sur asyncpg pour les perfs.
"""
import os
from logging.config import fileConfig

from sqlalchemy import engine_from_config, pool
from alembic import context

from app.config import get_settings
from app.database import Base
import app.models  # noqa: F401 — importer tous les modèles pour Base.metadata


def get_sync_url() -> str:
    """Retourne une URL DB compatible psycopg2 pour Alembic.

    Normalise les 3 préfixes possibles :
      - `postgresql+asyncpg://`  (runtime app)
      - `postgresql://`          (Railway/Supabase standard)
      - `postgres://`            (Railway/Heroku legacy)

    Tous redirigés vers `postgresql+psycopg2://`.
    """
    settings = get_settings()
    url = os.environ.get("DATABASE_URL") or settings.database_url or ""
    if url.startswith("postgresql+asyncpg://"):
        return "postgresql+psycopg2://" + url[len("postgresql+asyncpg://"):]
    if url.startswith("postgresql://"):
        return "postgresql+psycopg2://" + url[len("postgresql://"):]
    if url.startswith("postgres://"):
        return "postgresql+psycopg2://" + url[len("postgres://"):]
    return url


config = context.config
config.set_main_option("sqlalchemy.url", get_sync_url())

if config.config_file_name is not None:
    fileConfig(config.config_file_name)

target_metadata = Base.metadata


def run_migrations_offline() -> None:
    url = config.get_main_option("sqlalchemy.url")
    context.configure(
        url=url,
        target_metadata=target_metadata,
        literal_binds=True,
        dialect_opts={"paramstyle": "named"},
    )
    with context.begin_transaction():
        context.run_migrations()


def run_migrations_online() -> None:
    """Engine SYNC psycopg2 — pas d'asyncio, pas d'asyncpg. Compatible avec
    les `op.execute()` multi-statement."""
    connectable = engine_from_config(
        config.get_section(config.config_ini_section, {}),
        prefix="sqlalchemy.",
        poolclass=pool.NullPool,
    )
    with connectable.connect() as connection:
        context.configure(connection=connection, target_metadata=target_metadata)
        with context.begin_transaction():
            context.run_migrations()
    connectable.dispose()


if context.is_offline_mode():
    run_migrations_offline()
else:
    run_migrations_online()
