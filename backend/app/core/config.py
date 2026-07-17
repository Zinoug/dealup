from functools import lru_cache
from typing import Literal

from pydantic import field_validator, model_validator
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=".env", env_file_encoding="utf-8", extra="ignore"
    )

    app_name: str = "DealUp API"
    app_env: Literal["local", "test", "staging", "production"] = "local"
    debug: bool = False
    database_url: str = "sqlite:///./dealup.db"
    auto_create_tables: bool = True

    clerk_secret_key: str = ""
    clerk_jwks_url: str = ""
    clerk_issuer: str = ""
    clerk_audience: str = ""
    clerk_authorized_parties: list[str] = []
    auth_disabled: bool = False

    aws_region: str = "eu-west-3"
    analysis_lambda_name: str = "dealup-analysis"
    analysis_invoke_mode: Literal["aws", "disabled"] = "disabled"
    media_bucket: str = ""
    media_upload_max_bytes: int = 10_000_000

    piloterr_api_key: str = ""
    piloterr_base_url: str = "https://api.piloterr.com"

    revenuecat_api_key: str = ""
    revenuecat_entitlement_id: str = "premium"
    revenuecat_webhook_authorization: str = ""
    revenuecat_webhook_hmac_secret: str = ""
    revenuecat_weekly_product_id: str = "dealup_premium_weekly"
    revenuecat_monthly_product_id: str = "dealup_premium_monthly"
    revenuecat_topup_product_id: str = "dealup_analysis_topup_10"

    posthog_api_key: str = ""
    posthog_host: str = "https://eu.i.posthog.com"
    sentry_dsn: str = ""
    cors_origins: list[str] = []

    @field_validator("clerk_authorized_parties", "cors_origins", mode="before")
    @classmethod
    def parse_csv(cls, value: object) -> object:
        if isinstance(value, str) and not value.lstrip().startswith("["):
            return [item.strip() for item in value.split(",") if item.strip()]
        return value

    @model_validator(mode="after")
    def validate_production(self) -> "Settings":
        if self.app_env != "production":
            return self
        required = {
            "CLERK_JWKS_URL": self.clerk_jwks_url,
            "PILOTERR_API_KEY": self.piloterr_api_key,
            "REVENUECAT_API_KEY": self.revenuecat_api_key,
            "REVENUECAT_WEBHOOK_AUTHORIZATION": self.revenuecat_webhook_authorization,
            "MEDIA_BUCKET": self.media_bucket,
        }
        missing = [name for name, value in required.items() if not value]
        if missing:
            raise ValueError(f"Missing production settings: {', '.join(missing)}")
        if self.database_url.startswith("sqlite"):
            raise ValueError("Production requires PostgreSQL")
        if self.auto_create_tables:
            raise ValueError("AUTO_CREATE_TABLES must be false in production")
        if self.analysis_invoke_mode != "aws":
            raise ValueError("ANALYSIS_INVOKE_MODE must be aws in production")
        return self


@lru_cache
def get_settings() -> Settings:
    return Settings()
