import re
from datetime import datetime, timezone
from typing import Any
from urllib.parse import urlsplit, urlunsplit

from sqlalchemy.orm import Session

from app.core.errors import DealUpError
from app.domain import classify_listing, normalize_listing
from app.integrations import PiloterrClient
from app.models import ListingIdentification, User
from app.repositories import ListingRepository
from app.schemas.api import (
    ListingIdentificationResponse,
    ListingTeaser,
    PendingListingSummary,
    PendingListingsResponse,
)


TEASER_FACT_KEYS = {
    "condition",
    "phone_memory",
    "phone_color",
    "color",
    "storage",
    "memory",
    "ram",
    "processor",
    "chip",
    "screen_size",
    "keyboard",
}


def _canonical_url(url: str) -> str:
    parsed = urlsplit(url)
    return urlunsplit((parsed.scheme.lower(), parsed.netloc.lower(), parsed.path.rstrip("/"), "", ""))


def _listing_id_from_url(url: str) -> str | None:
    match = re.search(r"(?:/|^)(\d{8,})(?:/|$)", urlsplit(url).path)
    return match.group(1) if match else None


def _first_price_cents(payload: dict[str, Any]) -> int | None:
    cents = payload.get("price_cents")
    if isinstance(cents, list) and cents and isinstance(cents[0], (int, float)):
        return int(cents[0])
    if isinstance(cents, (int, float)):
        return int(cents)
    prices = payload.get("price")
    if isinstance(prices, list) and prices and isinstance(prices[0], (int, float)):
        return int(round(float(prices[0]) * 100))
    if isinstance(prices, (int, float)):
        return int(round(float(prices) * 100))
    return None


def _https_urls(value: Any, *, limit: int | None = None) -> list[str]:
    if not isinstance(value, list):
        return []
    urls = [
        item for item in value if isinstance(item, str) and item.startswith("https://")
    ]
    return urls[:limit] if limit is not None else urls


def _https_url(value: Any) -> str | None:
    return value if isinstance(value, str) and value.startswith("https://") else None


def _teaser_facts(payload: dict[str, Any]) -> list[str]:
    facts: list[str] = []
    for attribute in payload.get("attributes", []):
        if not isinstance(attribute, dict) or attribute.get("generic") is not True:
            continue
        key = str(attribute.get("key") or "").lower()
        if key not in TEASER_FACT_KEYS:
            continue
        label = attribute.get("value_label") or attribute.get("value")
        if not label:
            continue
        value = str(label).strip()
        if not value or value.startswith(("http://", "https://")) or value in facts:
            continue
        facts.append(value)
        if len(facts) == 5:
            break
    return facts


def build_teaser(payload: dict[str, Any]) -> dict[str, Any]:
    images = payload.get("images") if isinstance(payload.get("images"), dict) else {}
    standard_urls = _https_urls(images.get("urls"))
    large_urls = _https_urls(images.get("urls_large"))
    thumb_urls = _https_urls(images.get("urls_thumb"))
    gallery_urls = large_urls or standard_urls or thumb_urls
    preview_urls = gallery_urls[:6]
    thumbnail_url = next(
        (
            candidate
            for candidate in (
                large_urls[0] if large_urls else None,
                standard_urls[0] if standard_urls else None,
                _https_url(images.get("thumb_url")),
                _https_url(images.get("small_url")),
                thumb_urls[0] if thumb_urls else None,
            )
            if candidate
        ),
        None,
    )
    location = (
        payload.get("location") if isinstance(payload.get("location"), dict) else {}
    )
    location_label = ", ".join(
        str(value) for value in [location.get("city"), location.get("zipcode")] if value
    )
    return ListingTeaser(
        title=str(payload.get("subject") or "Annonce Leboncoin"),
        asking_price_cents=_first_price_cents(payload),
        thumbnail_url=thumbnail_url,
        preview_photo_urls=preview_urls,
        location=location_label or None,
        photo_count=len(gallery_urls),
        facts=_teaser_facts(payload),
    ).model_dump()


class ListingService:
    def __init__(self, session: Session, piloterr: PiloterrClient) -> None:
        self.session = session
        self.repo = ListingRepository(session)
        self.piloterr = piloterr

    def identify(
        self, user: User, url: str, can_start: bool
    ) -> ListingIdentificationResponse:
        user_id = user.id
        canonical_url = _canonical_url(url)
        external_id = _listing_id_from_url(canonical_url)
        existing = self.repo.find_owned(
            user_id, external_id=external_id, source_url=canonical_url
        )
        if existing:
            return self._response(existing, can_start)

        claim_time: datetime | None = None
        if not can_start:
            claim_time = datetime.now(timezone.utc)
            if not self.repo.claim_free_identification(user_id, claim_time):
                self.session.rollback()
                raise DealUpError(
                    "FREE_IDENTIFICATION_LIMIT_REACHED",
                    "Active une formule pour identifier une nouvelle annonce.",
                    403,
                    {"paywall_required": True},
                )
            self.session.commit()

        # No database transaction remains open during the Piloterr request.
        self.session.rollback()
        try:
            payload = self.piloterr.fetch_ad(url)
        except Exception:
            if claim_time is not None:
                self.repo.release_free_identification(user_id, claim_time)
                self.session.commit()
            raise

        payload_url = _canonical_url(str(payload.get("url") or canonical_url))
        payload_external_id = (
            str(payload.get("list_id")) if payload.get("list_id") else external_id
        )
        duplicate = self.repo.find_owned(
            user_id,
            external_id=payload_external_id,
            source_url=payload_url,
        )
        if duplicate:
            self.session.rollback()
            return self._response(duplicate, can_start)
        teaser = build_teaser(payload)
        normalized_payload = normalize_listing(payload)
        compatibility = classify_listing(payload)
        identification = self.repo.add(
            ListingIdentification(
                user_id=user_id,
                source_url=payload_url,
                external_id=payload_external_id,
                payload=payload,
                normalized_payload=normalized_payload,
                teaser=teaser,
                compatibility_status=compatibility.status,
                device_category=compatibility.category,
                device_profile=(
                    compatibility.as_dict()["device"]
                    if compatibility.category
                    else None
                ),
                catalog_version=compatibility.catalog_version,
            )
        )
        self.session.commit()
        return self._response(identification, can_start)

    def _response(
        self, item: ListingIdentification, can_start: bool
    ) -> ListingIdentificationResponse:
        compatibility = classify_listing(item.payload)
        compatibility_payload = {
            "status": item.compatibility_status or compatibility.status,
            "reason": compatibility.reason,
            "device": item.device_profile or compatibility.as_dict()["device"],
        }
        return ListingIdentificationResponse(
            identification_id=item.id,
            external_id=item.external_id,
            teaser=ListingTeaser.model_validate(item.teaser),
            compatibility=compatibility_payload,
            access={
                "subscription_required": not can_start,
                "can_start_analysis": can_start
                and compatibility_payload["status"] == "SUPPORTED",
            },
            existing_analysis_id=self.repo.latest_analysis_id(item.id, item.user_id),
            created_at=item.created_at,
        )

    def get(
        self, user: User, identification_id: str, can_start: bool
    ) -> ListingIdentificationResponse:
        item = self.repo.get_owned(identification_id, user.id)
        if not item:
            raise DealUpError(
                "LISTING_NOT_FOUND", "Annonce identifiée introuvable.", 404
            )
        return self._response(item, can_start)

    def list_pending(self, user: User, limit: int = 50) -> PendingListingsResponse:
        items = []
        for item in self.repo.list_pending_owned(user.id, limit=limit):
            compatibility = classify_listing(item.payload)
            items.append(
                PendingListingSummary(
                    identification_id=item.id,
                    teaser=ListingTeaser.model_validate(item.teaser),
                    compatibility={
                        "status": item.compatibility_status or compatibility.status,
                        "reason": compatibility.reason,
                        "device": item.device_profile or compatibility.as_dict()["device"],
                    },
                    created_at=item.created_at,
                )
            )
        return PendingListingsResponse(items=items)
