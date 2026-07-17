import pytest

from app.domain import classify_listing


def payload(subject: str) -> dict:
    return {"subject": subject, "attributes": []}


@pytest.mark.parametrize(
    ("subject", "status", "category", "profile"),
    [
        ("iPhone 11 128 Go", "SUPPORTED", "IPHONE", "IPHONE_11"),
        ("iPhone SE 2020 64 Go", "SUPPORTED", "IPHONE", "IPHONE_SE_2"),
        ("iPhone SE 2022 128 Go", "SUPPORTED", "IPHONE", "IPHONE_SE_3"),
        ("MacBook Air M1 8 Go", "SUPPORTED", "MACBOOK", "MACBOOK_AIR_M1"),
        ("MacBook Pro M3 Pro", "SUPPORTED", "MACBOOK", "MACBOOK_PRO_M3_PRO"),
        ("iPhone X 64 Go", "UNKNOWN", "IPHONE", None),
        ("iPhone 8 64 Go", "UNSUPPORTED", "IPHONE", None),
        ("MacBook Pro Intel Core i7", "UNSUPPORTED", "MACBOOK", None),
        ("MacBook M2 16 Go", "UNKNOWN", "MACBOOK", None),
        ("iPad Pro M2", "UNSUPPORTED", None, None),
        ("Samsung Galaxy S26", "UNSUPPORTED", None, None),
    ],
)
def test_device_compatibility_matrix(subject, status, category, profile) -> None:
    result = classify_listing(payload(subject))

    assert result.status == status
    assert result.category == category
    assert result.profile_code == profile


def test_unknown_or_unsupported_profiles_are_not_exposed_as_supported_devices() -> None:
    result = classify_listing(payload("MacBook Pro Intel Core i7"))

    assert result.as_dict()["device"] is None
