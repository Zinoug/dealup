from app.db.session import session_factory
from app.api.dependencies import revenuecat_dependency
from app.core.config import get_settings
from app.models import UsageEvent, UsageEventKind


class FakeRevenueCat:
    def get_subscriber(self, app_user_id: str) -> dict:
        return {
            "subscriber": {
                "entitlements": {},
                "non_subscriptions": {
                    get_settings().revenuecat_topup_15_product_id: [
                        {
                            "id": "store-transaction-1",
                            "purchase_date": "2026-07-17T12:00:00Z",
                        }
                    ],
                    get_settings().revenuecat_topup_40_product_id: [
                        {
                            "id": "store-transaction-40",
                            "purchase_date": "2026-07-17T13:00:00Z",
                        }
                    ],
                },
            }
        }


class FakeActiveWeeklyRevenueCat:
    def get_subscriber(self, app_user_id: str) -> dict:
        return {
            "subscriber": {
                "entitlements": {
                    get_settings().revenuecat_entitlement_id: {
                        "product_identifier": get_settings().revenuecat_weekly_product_id,
                        "purchase_date": "2026-07-20T12:00:00Z",
                        "expires_date": "2099-07-27T12:00:00Z",
                    }
                },
                "non_subscriptions": {},
            }
        }


def test_revenuecat_topup_webhook_is_idempotent(client) -> None:
    client.get("/v1/me")
    payload = {
        "api_version": "1.0",
        "event": {
            "id": "event-topup-1",
            "type": "NON_RENEWING_PURCHASE",
            "app_user_id": "user_local_dealup",
            "product_id": get_settings().revenuecat_topup_15_product_id,
            "event_timestamp_ms": 1,
        },
    }
    first = client.post("/v1/webhooks/revenuecat", json=payload)
    second = client.post("/v1/webhooks/revenuecat", json=payload)
    assert first.status_code == 200
    assert second.status_code == 200
    with session_factory()() as session:
        credits = (
            session.query(UsageEvent).filter_by(kind=UsageEventKind.TOPUP_CREDIT).all()
        )
        assert len(credits) == 1
        assert credits[0].amount == 15


def test_revenuecat_sync_reconciles_topup_once(client) -> None:
    from app.main import app

    app.dependency_overrides[revenuecat_dependency] = lambda: FakeRevenueCat()
    try:
        client.get("/v1/me")
        first = client.post("/v1/billing/sync")
        second = client.post("/v1/billing/sync")
        assert first.status_code == 200, first.text
        assert second.status_code == 200, second.text
        with session_factory()() as session:
            credits = (
                session.query(UsageEvent)
                .filter_by(source_event_id="revenuecat-transaction:store-transaction-1")
                .all()
            )
            assert len(credits) == 1
            assert credits[0].amount == 15
            large_pack = (
                session.query(UsageEvent)
                .filter_by(source_event_id="revenuecat-transaction:store-transaction-40")
                .one()
            )
            assert large_pack.amount == 40
    finally:
        app.dependency_overrides.clear()


def test_revenuecat_sync_grants_current_subscription_period_once(client) -> None:
    from app.main import app

    app.dependency_overrides[revenuecat_dependency] = lambda: FakeActiveWeeklyRevenueCat()
    try:
        client.get("/v1/me")
        first = client.post("/v1/billing/sync")
        second = client.post("/v1/billing/sync")
        assert first.status_code == 200, first.text
        assert second.status_code == 200, second.text
        usage = client.get("/v1/me/usage")
        assert usage.status_code == 200, usage.text
        assert usage.json()["included"]["remaining"] == 15
        with session_factory()() as session:
            credits = (
                session.query(UsageEvent)
                .filter_by(kind=UsageEventKind.INCLUDED_CREDIT)
                .all()
            )
            assert len(credits) == 1
            assert credits[0].amount == 15
    finally:
        app.dependency_overrides.clear()
