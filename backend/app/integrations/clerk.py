from dataclasses import dataclass
from datetime import datetime, timezone
from typing import Any
from urllib.parse import quote

import httpx

from app.core.config import Settings
from app.core.errors import DealUpError


@dataclass(frozen=True)
class ClerkUserProfile:
    clerk_user_id: str
    email: str | None
    display_name: str | None
    auth_provider: str | None
    clerk_created_at: datetime | None


def _timestamp(value: object) -> datetime | None:
    if isinstance(value, (int, float)):
        return datetime.fromtimestamp(value / 1000, tz=timezone.utc)
    if isinstance(value, str):
        try:
            return datetime.fromisoformat(value.replace("Z", "+00:00"))
        except ValueError:
            return None
    return None


def _profile(payload: dict[str, Any]) -> ClerkUserProfile:
    email_addresses = payload.get("email_addresses")
    emails = email_addresses if isinstance(email_addresses, list) else []
    primary_id = payload.get("primary_email_address_id")
    primary = next(
        (item for item in emails if isinstance(item, dict) and item.get("id") == primary_id),
        emails[0] if emails and isinstance(emails[0], dict) else None,
    )
    raw_email = primary.get("email_address") if primary else None
    email = raw_email.strip().lower() if isinstance(raw_email, str) else None
    name = " ".join(
        value.strip()
        for value in (payload.get("first_name"), payload.get("last_name"))
        if isinstance(value, str) and value.strip()
    ) or None
    raw_external_accounts = payload.get("external_accounts")
    external_accounts = (
        raw_external_accounts if isinstance(raw_external_accounts, list) else []
    )
    providers = {
        str(item.get("provider") or "").lower()
        for item in external_accounts
        if isinstance(item, dict)
    }
    if any("apple" in provider for provider in providers):
        auth_provider = "apple"
    elif any("google" in provider for provider in providers):
        auth_provider = "google"
    elif email:
        auth_provider = "email"
    else:
        auth_provider = None
    return ClerkUserProfile(
        clerk_user_id=str(payload.get("id") or ""),
        email=email,
        display_name=name,
        auth_provider=auth_provider,
        clerk_created_at=_timestamp(payload.get("created_at")),
    )


class ClerkClient:
    def __init__(self, settings: Settings) -> None:
        self.settings = settings

    def get_user(self, clerk_user_id: str) -> ClerkUserProfile | None:
        if not self.settings.clerk_secret_key:
            return None
        try:
            response = httpx.get(
                f"https://api.clerk.com/v1/users/{quote(clerk_user_id, safe='')}",
                headers={"Authorization": f"Bearer {self.settings.clerk_secret_key}"},
                timeout=15.0,
            )
        except httpx.HTTPError:
            return None
        if response.status_code != 200:
            return None
        try:
            payload = response.json()
        except ValueError:
            return None
        if not isinstance(payload, dict):
            return None
        profile = _profile(payload)
        return profile if profile.clerk_user_id else None

    @staticmethod
    def profile(payload: dict[str, Any]) -> ClerkUserProfile:
        return _profile(payload)

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
