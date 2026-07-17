import re
from dataclasses import dataclass
from typing import Any, Literal

from app.domain.contracts import get_analysis_contract


CompatibilityStatus = Literal["SUPPORTED", "UNSUPPORTED", "UNKNOWN"]
DeviceCategory = Literal["IPHONE", "MACBOOK"]


@dataclass(frozen=True)
class DeviceCompatibility:
    status: CompatibilityStatus
    category: DeviceCategory | None
    profile_code: str | None
    display_name: str | None
    specs: dict[str, str | int]
    reason: str | None
    catalog_version: str

    def as_dict(self) -> dict[str, Any]:
        return {
            "status": self.status,
            "reason": self.reason,
            "device": (
                {
                    "category": self.category,
                    "profile_code": self.profile_code,
                    "display_name": self.display_name,
                    "specs": self.specs,
                    "catalog_version": self.catalog_version,
                }
                if self.category and self.profile_code and self.display_name
                else None
            ),
        }


def _attributes(payload: dict[str, Any]) -> list[dict[str, str]]:
    normalized: list[dict[str, str]] = []
    for index, item in enumerate(payload.get("attributes") or []):
        if not isinstance(item, dict):
            continue
        key = str(item.get("key") or item.get("key_label") or f"attribute_{index}")
        value = item.get("value_label") or item.get("value")
        if value is not None:
            normalized.append(
                {"ref": f"attribute_{index + 1}", "key": key, "value": str(value)}
            )
    return normalized


def _searchable_text(payload: dict[str, Any]) -> str:
    values = [str(payload.get("subject") or ""), str(payload.get("body") or "")]
    values.extend(f"{item['key']} {item['value']}" for item in _attributes(payload))
    return " ".join(values).lower()


def _specs(payload: dict[str, Any]) -> dict[str, str | int]:
    specs: dict[str, str | int] = {}
    for item in _attributes(payload):
        key = item["key"].lower()
        value = item["value"]
        if any(
            token in key for token in ("stockage", "storage", "capacité", "capacity")
        ):
            specs["storage"] = value
        elif any(token in key for token in ("mémoire", "memory", "ram")):
            specs["memory"] = value
        elif any(token in key for token in ("couleur", "color")):
            specs["color"] = value
        elif any(token in key for token in ("processeur", "processor", "puce", "chip")):
            specs["chip"] = value
    return specs


def classify_listing(payload: dict[str, Any]) -> DeviceCompatibility:
    catalog_version = get_analysis_contract().manifest["device_catalog_version"]
    text = _searchable_text(payload)
    specs = _specs(payload)

    if any(
        token in text
        for token in ("ipad", "apple watch", "imac", "mac mini", "mac studio")
    ):
        return DeviceCompatibility(
            "UNSUPPORTED",
            None,
            None,
            None,
            {},
            "CATEGORY_NOT_SUPPORTED",
            catalog_version,
        )

    if "iphone" in text:
        se_match = re.search(
            r"iphone\s*se(?:\s*\(?\s*(2020|2022|2(?:e|ème|nd)?|3(?:e|ème|rd)?)\s*\)?)?",
            text,
        )
        if se_match:
            generation = se_match.group(1)
            if generation in {"2020", "2", "2e", "2ème", "2nd"}:
                return DeviceCompatibility(
                    "SUPPORTED",
                    "IPHONE",
                    "IPHONE_SE_2",
                    "iPhone SE (2e génération)",
                    specs,
                    None,
                    catalog_version,
                )
            if generation in {"2022", "3", "3e", "3ème", "3rd"}:
                return DeviceCompatibility(
                    "SUPPORTED",
                    "IPHONE",
                    "IPHONE_SE_3",
                    "iPhone SE (3e génération)",
                    specs,
                    None,
                    catalog_version,
                )
            return DeviceCompatibility(
                "UNKNOWN",
                "IPHONE",
                None,
                "iPhone SE",
                specs,
                "IPHONE_SE_GENERATION_UNKNOWN",
                catalog_version,
            )
        model = re.search(
            r"iphone\s*(\d{1,2})\b(?:\s*(pro\s*max|pro|plus|mini))?", text
        )
        if not model:
            return DeviceCompatibility(
                "UNKNOWN",
                "IPHONE",
                None,
                "iPhone",
                specs,
                "IPHONE_MODEL_UNKNOWN",
                catalog_version,
            )
        generation = int(model.group(1))
        variant = (model.group(2) or "").replace(" ", "_").upper()
        display_variant = (model.group(2) or "").title()
        display_name = (
            f"iPhone {generation}{f' {display_variant}' if display_variant else ''}"
        )
        if generation < 11:
            return DeviceCompatibility(
                "UNSUPPORTED",
                "IPHONE",
                None,
                display_name,
                specs,
                "IPHONE_TOO_OLD",
                catalog_version,
            )
        profile = f"IPHONE_{generation}{f'_{variant}' if variant else ''}"
        return DeviceCompatibility(
            "SUPPORTED", "IPHONE", profile, display_name, specs, None, catalog_version
        )

    if "macbook" in text:
        family_match = re.search(r"macbook\s*(air|pro)", text)
        family = family_match.group(1).upper() if family_match else None
        if family is None:
            return DeviceCompatibility(
                "UNKNOWN",
                "MACBOOK",
                None,
                "MacBook",
                specs,
                "MACBOOK_FAMILY_UNKNOWN",
                catalog_version,
            )
        chip_match = re.search(r"\b(m[1-9])(?:\s*(pro|max|ultra))?\b", text)
        if not chip_match:
            if re.search(r"\b(intel|core\s*i[3579]|i[3579][\s-]\d{3,5})\b", text):
                return DeviceCompatibility(
                    "UNSUPPORTED",
                    "MACBOOK",
                    None,
                    "MacBook Intel",
                    specs,
                    "MACBOOK_INTEL",
                    catalog_version,
                )
            return DeviceCompatibility(
                "UNKNOWN",
                "MACBOOK",
                None,
                "MacBook",
                specs,
                "MACBOOK_CHIP_UNKNOWN",
                catalog_version,
            )
        chip = chip_match.group(1).upper()
        chip_variant = (chip_match.group(2) or "").upper()
        label_family = family.title() if family else ""
        label_chip = f"{chip}{f' {chip_variant.title()}' if chip_variant else ''}"
        display_name = f"MacBook {label_family} {label_chip}".replace("  ", " ")
        profile = f"MACBOOK_{family or 'UNKNOWN'}_{chip}{f'_{chip_variant}' if chip_variant else ''}"
        specs.setdefault("chip", label_chip)
        return DeviceCompatibility(
            "SUPPORTED", "MACBOOK", profile, display_name, specs, None, catalog_version
        )

    if any(
        token in text
        for token in ("samsung", "pixel", "xiaomi", "oneplus", "huawei", "oppo")
    ):
        return DeviceCompatibility(
            "UNSUPPORTED",
            None,
            None,
            None,
            {},
            "ANDROID_NOT_SUPPORTED",
            catalog_version,
        )
    return DeviceCompatibility(
        "UNKNOWN", None, None, None, {}, "DEVICE_NOT_IDENTIFIED", catalog_version
    )


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
            "rating_count": seller.get("rating_count"),
            "rating": seller.get("rating"),
        },
    }
