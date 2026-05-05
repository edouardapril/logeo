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

    frontend_url: str = "https://logeo.ca"
    backend_url: str = "https://api.logeo.ca"

    default_auction_hours: int = 48

    class Config:
        env_file = ".env"


@lru_cache
def get_settings() -> Settings:
    return Settings()
