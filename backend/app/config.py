from pydantic_settings import BaseSettings
from functools import lru_cache


class Settings(BaseSettings):
    database_url: str
    secret_key: str
    algorithm: str = "HS256"
    access_token_expire_minutes: int = 1440

    resend_api_key: str
    from_email: str = "noreply@logeo.ca"
    admin_email: str = "admin@logeo.ca"
    # Adresse perso d'Edouard — Reply-To injecté sur tous les emails sortants.
    # Évite de monter un vrai mailbox sur logeo.ca : les replies des users
    # tombent directement dans sa boîte. Vide → header omis (envoi normal).
    reply_to_email: str = ""

    frontend_url: str = "https://logeo.ca"
    backend_url: str = "https://api.logeo.ca"

    # Durée par défaut d'une enchère Logeo : 10 jours
    default_auction_hours: int = 240

    # Stripe
    stripe_secret_key: str = ""
    stripe_publishable_key: str = ""
    stripe_webhook_secret: str = ""

    # Frais Logeo (1% du prix de vente, dépôt 25% des frais avec plancher 2 500$)
    fee_percent: float = 1.0
    deposit_percent_of_fee: float = 25.0
    deposit_minimum_cad: int = 2500

    # Délais (heures)
    deposit_retry_hours: int = 48
    due_diligence_hours: int = 24

    # Supabase Storage (optionnel — bascule vers cloud si configuré)
    storage_backend: str = "local"  # "local" ou "supabase"
    supabase_url: str = ""           # ex: https://xxx.supabase.co
    supabase_service_key: str = ""   # service_role key (jamais côté front)
    supabase_bucket_deals: str = "deals"
    supabase_bucket_documents: str = "documents"
    supabase_bucket_profiles: str = "profiles"
    signed_url_ttl_seconds: int = 3600

    # Enchère
    bid_min_increment: int = 5000            # CAD
    anti_snipe_window_minutes: int = 10
    anti_snipe_extension_minutes: int = 10

    # Convention courtier — version qui DOIT être signée pour publier
    courtier_convention_required_version: str = "v2-2026-05"

    class Config:
        env_file = ".env"


@lru_cache
def get_settings() -> Settings:
    return Settings()
