from pydantic_settings import BaseSettings, SettingsConfigDict
from pydantic import model_validator
from functools import lru_cache


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    # Anthropic
    anthropic_api_key: str
    anthropic_model: str = "claude-haiku-4-5-20251001"

    # Database
    database_url: str

    # Redis
    redis_url: str = "redis://localhost:6379"

    # Auth
    jwt_secret: str
    jwt_algorithm: str = "HS256"
    access_token_expire_minutes: int = 30

    # App
    environment: str = "development"
    frontend_url: str = "http://localhost:5173"
    sentry_dsn: str = ""

    # Email (Gmail SMTP) — set via env, never hardcode addresses in source
    smtp_user: str = ""
    smtp_password: str = ""
    contact_email: str = ""

    @model_validator(mode="after")
    def enforce_production_secrets(self):
        # A weak JWT secret makes HS256 tokens forgeable offline. Enforced in
        # EVERY environment: gating this on ENVIRONMENT=production proved
        # fragile — the live service was found running as "development",
        # which would have silently waived the check.
        if len(self.jwt_secret) < 32:
            raise ValueError(
                "JWT_SECRET must be at least 32 characters "
                "(generate one: python -c \"import secrets; print(secrets.token_urlsafe(32))\")"
            )
        return self


@lru_cache
def get_settings() -> Settings:
    return Settings()


settings = get_settings()
