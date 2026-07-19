from __future__ import annotations

from typing import Any

import httpx


class PushNotifier:
    """Best-effort Expo Push delivery for registered iOS devices."""

    def __init__(self, endpoint: str, timeout_seconds: float = 8.0) -> None:
        self.endpoint = endpoint
        self.timeout_seconds = timeout_seconds

    def send(
        self,
        tokens: list[str],
        *,
        title: str,
        body: str,
        data: dict[str, Any],
    ) -> None:
        messages = [
            {
                "to": token,
                "title": title,
                "body": body,
                "data": data,
                "sound": "default",
                "priority": "high",
            }
            for token in dict.fromkeys(tokens)
            if token.startswith(("ExponentPushToken[", "ExpoPushToken["))
        ]
        if not messages:
            return
        with httpx.Client(timeout=self.timeout_seconds) as client:
            response = client.post(
                self.endpoint,
                json=messages,
                headers={
                    "Accept": "application/json",
                    "Accept-Encoding": "gzip, deflate",
                    "Content-Type": "application/json",
                },
            )
            response.raise_for_status()
