from typing import Any

from sqlalchemy.orm import Session

from app.core.errors import DealUpError
from app.domain import classify_listing, normalize_listing
from app.integrations import PiloterrClient
from app.models import ListingIdentification, User
from app.repositories import ListingRepository
from app.schemas.api import ListingIdentificationResponse, ListingTeaser


def _first_price_cents(payload: dict[str, Any]) -> int | None:
    cents = payload.get("price_cents")
    if isinstance(cents, list) and cents and isinstance(cents[0], (int, float)):
        return int(cents[0])
    prices = payload.get("price")
    if isinstance(prices, list) and prices and isinstance(prices[0], (int, float)):
        return int(round(float(prices[0]) * 100))
    if isinstance(prices, (int, float)):
        return int(round(float(prices) * 100))
    return None


def build_teaser(payload: dict[str, Any]) -> dict[str, Any]:
    images = payload.get("images") if isinstance(payload.get("images"), dict) else {}
    image_urls = images.get("urls") if isinstance(images, dict) else []
    image_urls = image_urls if isinstance(image_urls, list) else []
    location = (
        payload.get("location") if isinstance(payload.get("location"), dict) else {}
    )
    location_label = ", ".join(
        str(value) for value in [location.get("city"), location.get("zipcode")] if value
    )
    facts: list[str] = []
    for attribute in payload.get("attributes", []):
        if not isinstance(attribute, dict):
            continue
        label = attribute.get("value_label") or attribute.get("value")
        if label and len(facts) < 5:
            facts.append(str(label))
    return ListingTeaser(
        title=str(payload.get("subject") or "Annonce Leboncoin"),
        asking_price_cents=_first_price_cents(payload),
        thumbnail_url=str(image_urls[0]) if image_urls else None,
        location=location_label or None,
        photo_count=len(image_urls),
        facts=facts,
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
        # Usage reads may have opened an implicit transaction. Close it before Piloterr.
        self.session.rollback()
        payload = self.piloterr.fetch_ad(url)
        teaser = build_teaser(payload)
        normalized_payload = normalize_listing(payload)
        compatibility = classify_listing(payload)
        identification = self.repo.add(
            ListingIdentification(
                user_id=user_id,
                source_url=str(payload.get("url") or url),
                external_id=str(payload.get("list_id"))
                if payload.get("list_id")
                else None,
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
        return ListingIdentificationResponse(
            identification_id=identification.id,
            external_id=identification.external_id,
            teaser=ListingTeaser.model_validate(teaser),
            compatibility=compatibility.as_dict(),
            access={
                "subscription_required": not can_start,
                "can_start_analysis": can_start and compatibility.status == "SUPPORTED",
            },
            created_at=identification.created_at,
        )

    def get(
        self, user: User, identification_id: str, can_start: bool
    ) -> ListingIdentificationResponse:
        item = self.repo.get_owned(identification_id, user.id)
        if not item:
            raise DealUpError(
                "LISTING_NOT_FOUND", "Annonce identifiée introuvable.", 404
            )
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
            created_at=item.created_at,
        )
