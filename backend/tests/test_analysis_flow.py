from datetime import datetime, timedelta, timezone

from app.api.v1.analyses import invoker_dependency
from app.api.v1.listings import piloterr_dependency
from app.core.errors import DealUpError
from app.db.session import session_factory
from app.models import (
    Analysis,
    AnalysisStatus,
    Subscription,
    SubscriptionPlan,
    SubscriptionStatus,
    User,
)


class FakePiloterr:
    def fetch_ad(self, url: str) -> dict:
        return {
            "url": url,
            "list_id": 3012186547,
            "subject": "iPhone 14 128 Go",
            "price": [420],
            "price_cents": [42000],
            "status": "active",
            "images": {"urls": ["https://img.example.test/iphone.jpg"]},
            "location": {"city": "Paris", "zipcode": "75011"},
            "attributes": [
                {"key": "brand", "value_label": "Apple"},
                {"key": "model", "value_label": "iPhone 14"},
            ],
        }


class FakeMacBookPiloterr:
    def fetch_ad(self, url: str) -> dict:
        return {
            "url": url,
            "list_id": 3012186548,
            "subject": "MacBook Air M2 16 Go 512 Go",
            "price_cents": [94000],
            "images": {"urls": []},
            "location": {"city": "Lyon", "zipcode": "69002"},
            "attributes": [
                {"key": "processor", "value_label": "Apple M2"},
                {"key": "memory", "value_label": "16 Go"},
            ],
        }


class FakeUnsupportedPiloterr:
    def fetch_ad(self, url: str) -> dict:
        return {
            "url": url,
            "list_id": 3012186549,
            "subject": "MacBook Pro Intel Core i7 2019",
            "price_cents": [40000],
            "images": {"urls": []},
            "attributes": [],
        }


class FailingInvoker:
    def invoke(self, analysis_id: str) -> None:
        raise DealUpError("ANALYSIS_DISPATCH_FAILED", "Dispatch impossible.", 503)


def activate_subscription(clerk_user_id: str = "user_local_dealup") -> None:
    with session_factory()() as session:
        user = session.query(User).filter_by(clerk_user_id=clerk_user_id).one()
        now = datetime.now(timezone.utc)
        session.add(
            Subscription(
                user_id=user.id,
                plan=SubscriptionPlan.WEEKLY,
                status=SubscriptionStatus.ACTIVE,
                product_id="dealup_premium_weekly",
                current_period_started_at=now - timedelta(days=1),
                current_period_ends_at=now + timedelta(days=6),
                will_renew=True,
            )
        )
        session.commit()


def test_create_analysis_is_idempotent_and_consumes_one_unit(client) -> None:
    from app.main import app

    app.dependency_overrides[piloterr_dependency] = lambda: FakePiloterr()
    try:
        assert client.get("/v1/me").status_code == 200
        activate_subscription()
        identified = client.post(
            "/v1/listings/identify",
            json={
                "url": "https://www.leboncoin.fr/ad/telephones_objets_connectes/3012186547"
            },
        )
        assert identified.status_code == 200, identified.text
        identification_id = identified.json()["identification_id"]
        body = {
            "identification_id": identification_id,
            "purchase_mode": "face_to_face",
            "seller_context": {"already_contacted": False},
        }
        headers = {"Idempotency-Key": "analysis-request-0001"}
        first = client.post("/v1/analyses", json=body, headers=headers)
        second = client.post("/v1/analyses", json=body, headers=headers)
        assert first.status_code == 202, first.text
        assert second.status_code == 202, second.text
        assert first.json()["analysis_id"] == second.json()["analysis_id"]
        usage = client.get("/v1/me/usage").json()
        assert usage["included"]["used"] == 1
        assert usage["included"]["remaining"] == 14

        mismatch = client.post(
            "/v1/analyses",
            json={**body, "purchase_mode": "delivery"},
            headers=headers,
        )
        assert mismatch.status_code == 409
        assert mismatch.json()["error"]["code"] == "IDEMPOTENCY_KEY_REUSED"

        reused_listing = client.post(
            "/v1/analyses",
            json=body,
            headers={"Idempotency-Key": "analysis-request-0003"},
        )
        assert reused_listing.status_code == 409
        assert reused_listing.json()["error"]["code"] == "LISTING_ALREADY_USED"
    finally:
        app.dependency_overrides.clear()


def test_analysis_requires_an_active_subscription(client) -> None:
    from app.main import app

    app.dependency_overrides[piloterr_dependency] = lambda: FakePiloterr()
    try:
        client.get("/v1/me")
        identified = client.post(
            "/v1/listings/identify",
            json={
                "url": "https://www.leboncoin.fr/ad/telephones_objets_connectes/3012186547"
            },
        )
        response = client.post(
            "/v1/analyses",
            headers={"Idempotency-Key": "analysis-request-0002"},
            json={
                "identification_id": identified.json()["identification_id"],
                "purchase_mode": "delivery",
            },
        )
        assert response.status_code == 403
        assert response.json()["error"]["code"] == "SUBSCRIPTION_REQUIRED"
    finally:
        app.dependency_overrides.clear()


def test_dispatch_failure_reverses_quota_once(client) -> None:
    from app.main import app

    app.dependency_overrides[piloterr_dependency] = lambda: FakePiloterr()
    app.dependency_overrides[invoker_dependency] = lambda: FailingInvoker()
    try:
        client.get("/v1/me")
        activate_subscription()
        identified = client.post(
            "/v1/listings/identify",
            json={
                "url": "https://www.leboncoin.fr/ad/telephones_objets_connectes/3012186547"
            },
        ).json()
        response = client.post(
            "/v1/analyses",
            headers={"Idempotency-Key": "analysis-dispatch-failure"},
            json={
                "identification_id": identified["identification_id"],
                "purchase_mode": "face_to_face",
            },
        )
        assert response.status_code == 503
        assert client.get("/v1/me/usage").json()["included"]["used"] == 0
        with session_factory()() as session:
            analysis = session.query(Analysis).one()
            assert analysis.status == AnalysisStatus.FAILED
    finally:
        app.dependency_overrides.clear()


def test_catalog_is_public_and_lists_both_v1_categories(client) -> None:
    response = client.get("/v1/catalog/compatible-devices")

    assert response.status_code == 200
    assert response.json()["version"] == "1.0"
    assert {item["code"] for item in response.json()["categories"]} == {
        "IPHONE",
        "MACBOOK",
    }


def test_macbook_is_supported_and_intel_is_rejected_before_quota(client) -> None:
    from app.main import app

    client.get("/v1/me")
    activate_subscription()
    app.dependency_overrides[piloterr_dependency] = lambda: FakeMacBookPiloterr()
    supported = client.post(
        "/v1/listings/identify",
        json={"url": "https://www.leboncoin.fr/ad/ordinateurs/3012186548"},
    )
    assert supported.status_code == 200, supported.text
    assert supported.json()["compatibility"]["device"]["category"] == "MACBOOK"
    assert supported.json()["access"]["can_start_analysis"] is True

    app.dependency_overrides[piloterr_dependency] = lambda: FakeUnsupportedPiloterr()
    unsupported = client.post(
        "/v1/listings/identify",
        json={"url": "https://www.leboncoin.fr/ad/ordinateurs/3012186549"},
    )
    assert unsupported.status_code == 200, unsupported.text
    assert unsupported.json()["compatibility"]["status"] == "UNSUPPORTED"
    assert unsupported.json()["compatibility"]["device"] is None
    response = client.post(
        "/v1/analyses",
        headers={"Idempotency-Key": "unsupported-intel-0001"},
        json={
            "identification_id": unsupported.json()["identification_id"],
            "purchase_mode": "face_to_face",
        },
    )
    assert response.status_code == 422
    assert response.json()["error"]["code"] == "UNSUPPORTED_DEVICE"
    assert client.get("/v1/me/usage").json()["included"]["used"] == 0
    app.dependency_overrides.clear()
