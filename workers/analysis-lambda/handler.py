import logging
from typing import Any

import sentry_sdk

from analysis_worker.config import get_settings
from analysis_worker.integrations import (
    Analytics,
    GeminiClient,
    MediaStorage,
    PiloterrClient,
    PushNotifier,
)
from analysis_worker.repositories import AnalysisRepository
from analysis_worker.services import AnalysisProcessor


def handler(event: dict[str, Any], context: Any) -> dict[str, str | int]:
    """Run one idempotent DealUp analysis."""
    del context
    analysis_id = event.get("analysis_id")
    if not isinstance(analysis_id, str) or not analysis_id:
        return {"status": "invalid_event"}
    settings = get_settings()
    logging.getLogger("analysis_worker").setLevel(logging.INFO)
    if settings.sentry_dsn:
        sentry_sdk.init(
            dsn=settings.sentry_dsn,
            environment=f"analysis-lambda-{settings.app_env}",
            send_default_pii=False,
        )
    processor = AnalysisProcessor(
        settings=settings,
        repository=AnalysisRepository(settings.database_url),
        piloterr=PiloterrClient(settings.piloterr_api_key, settings.piloterr_base_url),
        gemini=GeminiClient(settings),
        storage=MediaStorage(
            settings.media_bucket,
            settings.aws_region,
            settings.aws_access_key_id,
            settings.aws_secret_access_key,
            settings.aws_session_token,
        ),
        analytics=Analytics(settings.posthog_api_key, settings.posthog_host),
        notifier=PushNotifier(settings.expo_push_endpoint),
    )
    return processor.process(analysis_id)
