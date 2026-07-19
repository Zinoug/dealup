from analysis_worker.integrations.gemini import build_natural_prompt
from analysis_worker.services.normalizer import normalize_listing


def test_real_piloterr_shape_prefers_large_photos_and_filters_private_attributes() -> (
    None
):
    payload = {
        "subject": "iPhone 14 128 Go",
        "body": "Batterie annoncée à 80 %.",
        "price": [300],
        "price_cents": 30000,
        "status": "active",
        "images": {
            "urls": [
                "https://img.example.test/phone-1.jpg?rule=ad-image",
                "https://img.example.test/phone-2.jpg?rule=ad-image",
            ],
            "urls_large": [
                "https://img.example.test/phone-1.jpg?rule=ad-large",
                "https://img.example.test/phone-2.jpg?rule=ad-large",
            ],
        },
        "owner": {"name": "Private seller", "user_id": "private-id"},
        "location": {
            "city": "Toulouse",
            "zipcode": "31000",
            "lat": 43.0,
            "lng": 1.0,
        },
        "attributes": [
            {
                "key": "profile_picture_url",
                "value": "https://img.example.test/private-profile.jpg",
            },
            {"key": "rating_score", "value": "0.68"},
            {"key": "rating_count", "value": "4"},
            {"key": "condition", "value_label": "Très bon état"},
            {"key": "phone_memory", "value_label": "128 Go"},
        ],
        "counters": {"favorites": 12},
        "first_publication_date": "2026-06-01 20:33:44",
        "index_date": "2026-06-10 20:00:35",
        "is_boosted": True,
    }

    result = normalize_listing(payload)

    assert result["asking_price_cents"] == 30000
    assert [photo["url"] for photo in result["photos"]] == [
        "https://img.example.test/phone-1.jpg?rule=ad-large",
        "https://img.example.test/phone-2.jpg?rule=ad-large",
    ]
    assert result["location"] == {"city": "Toulouse", "postal_code": "31000"}
    assert result["seller_public"] == {
        "account_age": None,
        "account_type": None,
        "rating_out_of_five": 3.4,
        "rating_count": 4,
    }
    assert result["publication"] == {
        "status": "active",
        "first_published_at": "2026-06-01 20:33:44",
        "indexed_at": "2026-06-10 20:00:35",
        "favorite_count": 12,
        "is_boosted": True,
    }
    assert {item["key"] for item in result["attributes"]} == {
        "condition",
        "phone_memory",
    }
    assert "name" not in result["seller_public"]
    assert "lat" not in result["location"]


def test_gemini_prompt_is_natural_and_omits_empty_noise() -> None:
    normalized = normalize_listing(
        {
            "subject": "iPhone 13 bleu 128 Go",
            "body": "Très bon état.",
            "price_cents": 18000,
            "images": {"urls": []},
            "attributes": [
                {"key": "rating_score", "value": "0.68"},
                {"key": "rating_count", "value": "4"},
                {"key": "phone_memory", "value_label": "128 Go"},
            ],
        }
    )
    prompt = build_natural_prompt(
        normalized_listing=normalized,
        device_profile={
            "category": "IPHONE",
            "display_name": "iPhone 13",
            "specs": {"storage": "128 Go", "color": "bleu"},
        },
        purchase_mode="delivery",
        seller_reply_text=None,
        parent_result=None,
        listing_image_count=0,
        private_image_count=0,
    )

    assert "Modèle détecté : iPhone 13" in prompt
    assert "Prix demandé : 180 €" in prompt
    assert "Réputation vendeur : 3,4/5 sur 4 avis" in prompt
    assert "location" not in prompt.lower()
    assert "null" not in prompt.lower()
