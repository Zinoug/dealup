from typing import Any


EXCLUDED_ATTRIBUTE_KEYS = {
    "profile_picture_url",
    "rating_score",
    "rating_count",
    "estimated_parcel_weight",
    "estimated_parcel_size",
    "purchase_cta_visible",
    "country_isocode3166",
}


def _price_cents(payload: dict[str, Any]) -> int | None:
    value = payload.get("price_cents")
    if isinstance(value, list) and value:
        value = value[0]
    if isinstance(value, (int, float)):
        return int(value)
    value = payload.get("price")
    if isinstance(value, list) and value:
        value = value[0]
    if isinstance(value, (int, float)):
        return int(round(float(value) * 100))
    return None


def _attributes(payload: dict[str, Any]) -> list[dict[str, str]]:
    attributes: list[dict[str, str]] = []
    for index, item in enumerate(payload.get("attributes") or []):
        if not isinstance(item, dict):
            continue
        key = str(item.get("key") or item.get("key_label") or index)
        if key.lower() in EXCLUDED_ATTRIBUTE_KEYS:
            continue
        value = item.get("value_label") or item.get("value")
        if value is None or str(value).startswith(("http://", "https://")):
            continue
        attributes.append(
            {
                "ref": f"attribute_{index + 1}",
                "key": key,
                "value": str(value),
            }
        )
    return attributes


def _attribute_values(payload: dict[str, Any]) -> dict[str, str]:
    values: dict[str, str] = {}
    for item in payload.get("attributes") or []:
        if not isinstance(item, dict) or not item.get("key"):
            continue
        value = item.get("value") or item.get("value_label")
        if value is not None:
            values[str(item["key"]).lower()] = str(value)
    return values


def _integer(value: Any) -> int | None:
    try:
        return int(value) if value is not None else None
    except (TypeError, ValueError):
        return None


def _rating_out_of_five(value: Any) -> float | None:
    try:
        score = float(value)
    except (TypeError, ValueError):
        return None
    if not 0 <= score <= 1:
        return None
    return round(score * 5, 1)


def _https_urls(value: Any) -> list[str]:
    if not isinstance(value, list):
        return []
    return [
        item for item in value if isinstance(item, str) and item.startswith("https://")
    ]


def normalize_listing(payload: dict[str, Any]) -> dict[str, Any]:
    images = payload.get("images") if isinstance(payload.get("images"), dict) else {}
    large_urls = _https_urls(images.get("urls_large"))
    standard_urls = _https_urls(images.get("urls"))
    urls = large_urls or standard_urls
    location = (
        payload.get("location") if isinstance(payload.get("location"), dict) else {}
    )
    seller = payload.get("owner") if isinstance(payload.get("owner"), dict) else {}
    attribute_values = _attribute_values(payload)
    counters = (
        payload.get("counters") if isinstance(payload.get("counters"), dict) else {}
    )
    return {
        "title": str(payload.get("subject") or ""),
        "description": str(payload.get("body") or "")[:12_000],
        "asking_price_cents": _price_cents(payload),
        "currency": "EUR",
        "attributes": _attributes(payload),
        "photos": [
            {
                "ref": f"listing_photo_{index + 1:02d}",
                "url": url,
                "media_id": None,
            }
            for index, url in enumerate(urls[:10])
            if isinstance(url, str) and url.startswith("https://")
        ],
        "location": {
            "city": location.get("city"),
            "postal_code": location.get("zipcode"),
        },
        "seller_public": {
            "account_age": seller.get("account_age"),
            "account_type": (
                seller.get("type")
                or seller.get("account_type")
                or ("professionnel" if seller.get("is_pro") else None)
            ),
            "rating_out_of_five": _rating_out_of_five(
                attribute_values.get("rating_score") or seller.get("rating_score")
            ),
            "rating_count": _integer(
                attribute_values.get("rating_count") or seller.get("rating_count")
            ),
        },
        "publication": {
            "status": payload.get("status"),
            "first_published_at": payload.get("first_publication_date"),
            "indexed_at": payload.get("index_date"),
            "favorite_count": _integer(counters.get("favorites")),
            "is_boosted": bool(payload.get("is_boosted")),
        },
    }
