from typing import Any
from urllib.parse import quote

import httpx

from app.core.config import Settings
from app.core.errors import DealUpError


class RevenueCatClient:
    def __init__(self, settings: Settings) -> None:
        self.settings = settings

    def get_subscriber(self, app_user_id: str) -> dict[str, Any]:
        if not self.settings.revenuecat_api_key:
            raise DealUpError(
                "BILLING_NOT_CONFIGURED", "RevenueCat n’est pas configuré.", 503
            )
        try:
            response = httpx.get(
                f"https://api.revenuecat.com/v1/subscribers/{quote(app_user_id, safe='')}",
                headers={
                    "Authorization": f"Bearer {self.settings.revenuecat_api_key}",
                    "Content-Type": "application/json",
                },
                timeout=15.0,
            )
            response.raise_for_status()
        except httpx.HTTPError as exc:
            raise DealUpError(
                "BILLING_SYNC_FAILED",
                "Impossible de synchroniser les achats pour le moment.",
                502,
            ) from exc
        payload = response.json()
        if not isinstance(payload, dict):
            raise DealUpError(
                "BILLING_SYNC_FAILED", "Réponse RevenueCat invalide.", 502
            )
        return payload
