from typing import Any

import httpx


class PiloterrError(RuntimeError):
    pass


class PiloterrClient:
    def __init__(self, api_key: str, base_url: str) -> None:
        self.api_key = api_key
        self.base_url = base_url.rstrip("/")

    def fetch_ad(self, url: str) -> dict[str, Any]:
        try:
            response = httpx.get(
                f"{self.base_url}/v2/leboncoin/ad",
                params={"query": url, "return_page_source": "false"},
                headers={"x-api-key": self.api_key},
                timeout=20.0,
            )
        except httpx.HTTPError as exc:
            raise PiloterrError("Piloterr is temporarily unavailable") from exc
        if response.status_code == 404:
            raise PiloterrError("The listing is no longer available")
        if response.status_code != 200:
            raise PiloterrError(f"Piloterr returned status {response.status_code}")
        payload = response.json()
        if not isinstance(payload, dict):
            raise PiloterrError("Piloterr returned an invalid payload")
        return payload
