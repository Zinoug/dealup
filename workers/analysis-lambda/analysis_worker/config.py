from functools import lru_cache

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=".env", env_file_encoding="utf-8", extra="ignore"
    )

    database_url: str
    piloterr_api_key: str
    piloterr_base_url: str = "https://api.piloterr.com"
    gemini_api_key: str
    gemini_model: str = "gemini-3.5-flash"
    gemini_thinking_level: str = "medium"
    gemini_temperature: float = 0.2
    gemini_store_interactions: bool = False
    gemini_input_usd_per_million: float | None = None
    gemini_output_usd_per_million: float | None = None
    gemini_thought_usd_per_million: float | None = None
    gemini_search_usd_per_request: float | None = None
    piloterr_eur_per_request: float | None = None
    provider_pricing_version: str = "manual"
    max_listing_images: int = 10
    max_private_images: int = 10
    max_listing_image_bytes: int = 10_000_000
    push_after_seconds: float = 20.0
    aws_region: str = "eu-west-3"
    media_bucket: str = ""
    posthog_api_key: str = ""
    posthog_host: str = "https://eu.i.posthog.com"
    sentry_dsn: str = ""


@lru_cache
def get_settings() -> Settings:
    return Settings()
