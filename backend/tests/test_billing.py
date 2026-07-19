from app.db.session import session_factory
from datetime import datetime, timedelta, timezone

from app.models import (
    Subscription,
    SubscriptionPlan,
    SubscriptionStatus,
    UsageEvent,
    UsageEventKind,
    User,
)
from app.api.dependencies import revenuecat_dependency


class FakeRevenueCat:
    def get_subscriber(self, app_user_id: str) -> dict:
        return {
            "subscriber": {
                "entitlements": {},
                "non_subscriptions": {
                    "dealup_analysis_topup_10": [
                        {
                            "id": "store-transaction-1",
                            "purchase_date": "2026-07-17T12:00:00Z",
                        }
                    ]
                },
            }
        }


class UnexpectedRevenueCat:
    def get_subscriber(self, app_user_id: str) -> dict:
        raise AssertionError("RevenueCat must not override internal non-production access")


def test_revenuecat_topup_webhook_is_idempotent(client) -> None:
    client.get("/v1/me")
    payload = {
        "api_version": "1.0",
        "event": {
            "id": "event-topup-1",
            "type": "NON_RENEWING_PURCHASE",
            "app_user_id": "user_local_dealup",
            "product_id": "dealup_analysis_topup_10",
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
        assert credits[0].amount == 10


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
            assert credits[0].amount == 10
    finally:
        app.dependency_overrides.clear()


def test_manual_non_production_access_survives_billing_sync(client) -> None:
    from app.main import app

    client.get("/v1/me")
    with session_factory()() as session:
        user = session.query(User).filter_by(clerk_user_id="user_local_dealup").one()
        session.add(
            Subscription(
                user_id=user.id,
                plan=SubscriptionPlan.MONTHLY,
                status=SubscriptionStatus.ACTIVE,
                product_id="manual_monthly",
                current_period_started_at=datetime.now(timezone.utc),
                current_period_ends_at=datetime.now(timezone.utc) + timedelta(days=30),
                will_renew=False,
                environment="manual",
            )
        )
        session.commit()

    app.dependency_overrides[revenuecat_dependency] = lambda: UnexpectedRevenueCat()
    try:
        response = client.post("/v1/billing/sync")
        assert response.status_code == 200, response.text
        assert response.json() == {
            "synced": True,
            "plan": "monthly",
            "entitlement": "active",
        }
    finally:
        app.dependency_overrides.clear()
