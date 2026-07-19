import json
import os
from functools import lru_cache

import boto3
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=".env", env_file_encoding="utf-8", extra="ignore"
    )

    app_env: str = "local"
    database_url: str
    piloterr_api_key: str
    piloterr_base_url: str = "https://api.piloterr.com"
    gemini_api_key: str
    gemini_model: str
    gemini_thinking_level: str = "low"
    gemini_store_interactions: bool = False
    gemini_timeout_seconds: float = 60.0
    gemini_input_usd_per_million: float | None = None
    gemini_output_usd_per_million: float | None = None
    gemini_thought_usd_per_million: float | None = None
    gemini_search_usd_per_request: float | None = None
    piloterr_eur_per_request: float | None = None
    provider_pricing_version: str = "manual"
    max_listing_images: int = 10
    max_private_images: int = 10
    max_listing_image_bytes: int = 10_000_000
    aws_region: str = "eu-west-3"
    aws_access_key_id: str = ""
    aws_secret_access_key: str = ""
    aws_session_token: str = ""
    media_bucket: str = ""
    posthog_api_key: str = ""
    posthog_host: str = "https://eu.i.posthog.com"
    sentry_dsn: str = ""
    expo_push_endpoint: str = "https://exp.host/--/api/v2/push/send"


@lru_cache
def get_settings() -> Settings:
    secret_arn = os.getenv("DEALUP_SECRET_ARN", "").strip()
    if secret_arn:
        response = boto3.client(
            "secretsmanager", region_name=os.getenv("AWS_REGION", "eu-west-3")
        ).get_secret_value(SecretId=secret_arn)
        payload = json.loads(response["SecretString"])
        if not isinstance(payload, dict):
            raise ValueError("DEALUP_SECRET_ARN must contain a JSON object")
        allowed = {
            "DATABASE_URL",
            "PILOTERR_API_KEY",
            "GEMINI_API_KEY",
            "POSTHOG_API_KEY",
            "SENTRY_DSN",
        }
        for key, value in payload.items():
            if key in allowed and isinstance(value, str):
                os.environ.setdefault(key, value)
    return Settings()
