from typing import Any

from posthog import Posthog

from app.core.config import Settings


class Analytics:
    def __init__(self, settings: Settings) -> None:
        self.client = (
            Posthog(settings.posthog_api_key, host=settings.posthog_host)
            if settings.posthog_api_key
            else None
        )

    def capture(self, distinct_id: str, event: str, properties: dict[str, Any]) -> None:
        if self.client:
            try:
                self.client.capture(
                    distinct_id=distinct_id, event=event, properties=properties
                )
            except Exception:
                return
