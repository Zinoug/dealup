from typing import Any

from posthog import Posthog


class Analytics:
    def __init__(self, api_key: str, host: str) -> None:
        self.client = Posthog(api_key, host=host) if api_key else None

    def capture(self, user_id: str, event: str, properties: dict[str, Any]) -> None:
        if self.client:
            try:
                self.client.capture(
                    distinct_id=user_id, event=event, properties=properties
                )
                self.client.flush()
            except Exception:
                return
