from typing import Any


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


def normalize_listing(payload: dict[str, Any]) -> dict[str, Any]:
    attributes: list[dict[str, str]] = []
    for index, item in enumerate(payload.get("attributes") or []):
        if not isinstance(item, dict):
            continue
        value = item.get("value_label") or item.get("value")
        if value is not None:
            attributes.append(
                {
                    "ref": f"attribute_{index + 1}",
                    "key": str(item.get("key") or item.get("key_label") or index),
                    "value": str(value),
                }
            )
    images = payload.get("images") if isinstance(payload.get("images"), dict) else {}
    urls = images.get("urls") if isinstance(images, dict) else []
    urls = urls if isinstance(urls, list) else []
    location = (
        payload.get("location") if isinstance(payload.get("location"), dict) else {}
    )
    seller = payload.get("owner") if isinstance(payload.get("owner"), dict) else {}
    return {
        "title": str(payload.get("subject") or ""),
        "description": str(payload.get("body") or "")[:12_000],
        "asking_price_cents": _price_cents(payload),
        "currency": "EUR",
        "attributes": attributes,
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
            "rating_count": seller.get("rating_count"),
            "rating": seller.get("rating"),
        },
    }
