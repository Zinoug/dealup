from urllib.parse import quote

import httpx

from app.core.config import Settings
from app.core.errors import DealUpError


class ClerkClient:
    def __init__(self, settings: Settings) -> None:
        self.settings = settings

    def delete_user(self, clerk_user_id: str) -> None:
        if not self.settings.clerk_secret_key:
            if self.settings.app_env in {"local", "test"}:
                return
            raise DealUpError("AUTH_NOT_CONFIGURED", "Clerk n’est pas configuré.", 503)
        try:
            response = httpx.delete(
                f"https://api.clerk.com/v1/users/{quote(clerk_user_id, safe='')}",
                headers={"Authorization": f"Bearer {self.settings.clerk_secret_key}"},
                timeout=15.0,
            )
        except httpx.HTTPError as exc:
            raise DealUpError(
                "ACCOUNT_DELETION_FAILED",
                "Le compte n’a pas pu être supprimé pour le moment.",
                502,
            ) from exc
        if response.status_code not in {200, 204, 404}:
            raise DealUpError(
                "ACCOUNT_DELETION_FAILED",
                "Le compte n’a pas pu être supprimé pour le moment.",
                502,
            )
