from typing import Any
from urllib.parse import urlparse

import httpx

from app.core.config import Settings
from app.core.errors import DealUpError


class PiloterrClient:
    def __init__(self, settings: Settings) -> None:
        self.settings = settings

    @staticmethod
    def validate_leboncoin_url(url: str) -> str:
        parsed = urlparse(url)
        host = (parsed.hostname or "").lower()
        if parsed.scheme not in {"http", "https"} or not (
            host == "leboncoin.fr" or host.endswith(".leboncoin.fr")
        ):
            raise DealUpError(
                "INVALID_LISTING_URL",
                "Utilise un lien d’annonce Leboncoin valide.",
                422,
            )
        return url

    def fetch_ad(self, url: str) -> dict[str, Any]:
        self.validate_leboncoin_url(url)
        if not self.settings.piloterr_api_key:
            raise DealUpError(
                "PROVIDER_NOT_CONFIGURED", "Piloterr n’est pas configuré.", 503
            )
        try:
            response = httpx.get(
                f"{self.settings.piloterr_base_url.rstrip('/')}/v2/leboncoin/ad",
                params={"query": url, "return_page_source": "false"},
                headers={"x-api-key": self.settings.piloterr_api_key},
                timeout=20.0,
            )
        except httpx.HTTPError as exc:
            raise DealUpError(
                "PROVIDER_TEMPORARILY_UNAVAILABLE",
                "Leboncoin est temporairement indisponible.",
                502,
            ) from exc
        if response.status_code == 404:
            raise DealUpError(
                "LISTING_UNAVAILABLE", "Cette annonce n’est plus disponible.", 404
            )
        if response.status_code in {400, 422}:
            raise DealUpError(
                "INVALID_LISTING_URL",
                "Cette annonce Leboncoin n’est pas reconnue.",
                422,
            )
        if response.status_code == 429:
            raise DealUpError(
                "PROVIDER_RATE_LIMITED", "Réessaie dans quelques instants.", 503
            )
        if response.status_code != 200:
            raise DealUpError(
                "PROVIDER_TEMPORARILY_UNAVAILABLE",
                "Impossible de lire cette annonce pour le moment.",
                502,
            )
        payload = response.json()
        if not isinstance(payload, dict):
            raise DealUpError("PROVIDER_INVALID_RESPONSE", "Annonce illisible.", 502)
        return payload
