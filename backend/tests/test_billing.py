from datetime import timezone

from app.db.session import session_factory
from app.api.dependencies import revenuecat_dependency
from app.core.config import get_settings
from app.models import Subscription, SubscriptionStatus, UsageEvent, UsageEventKind


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


class FakePromotionalRevenueCat:
    def get_subscriber(self, app_user_id: str) -> dict:
        return {
            "subscriber": {
                "entitlements": {
                    get_settings().revenuecat_entitlement_id: {
                        "product_identifier": "rc_promo_DealUp AI Pro_daily",
                        "purchase_date": "2026-07-22T17:31:23Z",
                        "expires_date": "2099-07-23T17:31:23Z",
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


def test_revenuecat_promotional_entitlement_grants_15_credits_once(client) -> None:
    from app.main import app

    app.dependency_overrides[revenuecat_dependency] = lambda: FakePromotionalRevenueCat()
    try:
        client.get("/v1/me")
        first = client.post("/v1/billing/sync")
        second = client.post("/v1/billing/sync")
        assert first.status_code == 200, first.text
        assert second.status_code == 200, second.text
        usage = client.get("/v1/me/usage").json()
        assert usage["plan"] == "promotional"
        assert usage["included"]["remaining"] == 15
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


def test_revenuecat_promotional_webhook_grants_15_credits(client) -> None:
    client.get("/v1/me")
    payload = {
        "api_version": "1.0",
        "event": {
            "id": "promo-event-1",
            "type": "NON_RENEWING_PURCHASE",
            "store": "PROMOTIONAL",
            "period_type": "PROMOTIONAL",
            "app_user_id": "user_local_dealup",
            "product_id": "rc_promo_DealUp AI Pro_daily",
            "entitlement_id": get_settings().revenuecat_entitlement_id,
            "entitlement_ids": [get_settings().revenuecat_entitlement_id],
            "purchased_at_ms": 1784734283249,
            "expiration_at_ms": 1784820683249,
        },
    }
    response = client.post("/v1/webhooks/revenuecat", json=payload)
    assert response.status_code == 200, response.text
    usage = client.get("/v1/me/usage").json()
    assert usage["plan"] == "promotional"
    assert usage["included"]["remaining"] == 15


def test_revenuecat_cancellation_keeps_access_without_extra_credit(client) -> None:
    client.get("/v1/me")
    initial = {
        "api_version": "1.0",
        "event": {
            "id": "subscription-initial-1",
            "type": "INITIAL_PURCHASE",
            "app_user_id": "user_local_dealup",
            "product_id": get_settings().revenuecat_weekly_product_id,
            "entitlement_ids": [get_settings().revenuecat_entitlement_id],
            "purchased_at_ms": 1784734283249,
            "expiration_at_ms": 1785339083249,
        },
    }
    cancellation = {
        "api_version": "1.0",
        "event": {
            **initial["event"],
            "id": "subscription-cancel-1",
            "type": "CANCELLATION",
        },
    }

    assert client.post("/v1/webhooks/revenuecat", json=initial).status_code == 200
    assert client.post("/v1/webhooks/revenuecat", json=cancellation).status_code == 200
    usage = client.get("/v1/me/usage").json()
    assert usage["entitlement"] == "active"
    assert usage["included"]["remaining"] == 15
    with session_factory()() as session:
        credits = (
            session.query(UsageEvent)
            .filter_by(kind=UsageEventKind.INCLUDED_CREDIT)
            .all()
        )
        subscription = session.query(Subscription).one()
        assert len(credits) == 1
        assert subscription.status == SubscriptionStatus.ACTIVE
        assert subscription.will_renew is False


def test_revenuecat_uncancellation_restores_renewal_without_extra_credit(client) -> None:
    client.get("/v1/me")
    base_event = {
        "app_user_id": "user_local_dealup",
        "product_id": get_settings().revenuecat_weekly_product_id,
        "entitlement_ids": [get_settings().revenuecat_entitlement_id],
        "purchased_at_ms": 1784734283249,
        "expiration_at_ms": 1785339083249,
    }
    for event_id, event_type in [
        ("subscription-initial-2", "INITIAL_PURCHASE"),
        ("subscription-cancel-2", "CANCELLATION"),
        ("subscription-uncancel-2", "UNCANCELLATION"),
    ]:
        response = client.post(
            "/v1/webhooks/revenuecat",
            json={"api_version": "1.0", "event": {**base_event, "id": event_id, "type": event_type}},
        )
        assert response.status_code == 200, response.text

    with session_factory()() as session:
        credits = (
            session.query(UsageEvent)
            .filter_by(kind=UsageEventKind.INCLUDED_CREDIT)
            .all()
        )
        subscription = session.query(Subscription).one()
        assert len(credits) == 1
        assert subscription.status == SubscriptionStatus.ACTIVE
        assert subscription.will_renew is True


def test_revenuecat_subscription_extension_updates_period_without_credit(client) -> None:
    client.get("/v1/me")
    initial = {
        "api_version": "1.0",
        "event": {
            "id": "subscription-initial-3",
            "type": "INITIAL_PURCHASE",
            "app_user_id": "user_local_dealup",
            "product_id": get_settings().revenuecat_weekly_product_id,
            "entitlement_ids": [get_settings().revenuecat_entitlement_id],
            "purchased_at_ms": 1784734283249,
            "expiration_at_ms": 1785339083249,
        },
    }
    extended = {
        "api_version": "1.0",
        "event": {
            **initial["event"],
            "id": "subscription-extended-3",
            "type": "SUBSCRIPTION_EXTENDED",
            "expiration_at_ms": 1785943883249,
        },
    }

    assert client.post("/v1/webhooks/revenuecat", json=initial).status_code == 200
    assert client.post("/v1/webhooks/revenuecat", json=extended).status_code == 200
    with session_factory()() as session:
        credits = (
            session.query(UsageEvent)
            .filter_by(kind=UsageEventKind.INCLUDED_CREDIT)
            .all()
        )
        subscription = session.query(Subscription).one()
        assert len(credits) == 1
        ends_at = subscription.current_period_ends_at
        if ends_at.tzinfo is None:
            ends_at = ends_at.replace(tzinfo=timezone.utc)
        assert int(ends_at.timestamp()) == 1785943883


def test_revenuecat_product_change_does_not_grant_ambiguous_extra_credit(client) -> None:
    client.get("/v1/me")
    initial = {
        "api_version": "1.0",
        "event": {
            "id": "subscription-initial-4",
            "type": "INITIAL_PURCHASE",
            "app_user_id": "user_local_dealup",
            "product_id": get_settings().revenuecat_weekly_product_id,
            "entitlement_ids": [get_settings().revenuecat_entitlement_id],
            "purchased_at_ms": 1784734283249,
            "expiration_at_ms": 1785339083249,
        },
    }
    product_change = {
        "api_version": "1.0",
        "event": {
            **initial["event"],
            "id": "subscription-product-change-4",
            "type": "PRODUCT_CHANGE",
            "product_id": get_settings().revenuecat_monthly_product_id,
            "purchased_at_ms": 1784740000000,
            "expiration_at_ms": 1787418400000,
        },
    }

    assert client.post("/v1/webhooks/revenuecat", json=initial).status_code == 200
    assert client.post("/v1/webhooks/revenuecat", json=product_change).status_code == 200
    usage = client.get("/v1/me/usage").json()
    assert usage["plan"] == "monthly"
    assert usage["included"]["remaining"] == 15
    with session_factory()() as session:
        credits = (
            session.query(UsageEvent)
            .filter_by(kind=UsageEventKind.INCLUDED_CREDIT)
            .all()
        )
        assert len(credits) == 1


def test_revenuecat_temporary_entitlement_grant_credits_once(client) -> None:
    client.get("/v1/me")
    payload = {
        "api_version": "1.0",
        "event": {
            "id": "temporary-entitlement-1",
            "type": "TEMPORARY_ENTITLEMENT_GRANT",
            "store": "PROMOTIONAL",
            "period_type": "PROMOTIONAL",
            "app_user_id": "$RCAnonymousID:anonymous",
            "aliases": ["$RCAnonymousID:anonymous", "user_local_dealup"],
            "product_id": "rc_promo_DealUp AI Pro_temporary",
            "entitlement_ids": [get_settings().revenuecat_entitlement_id],
            "purchased_at_ms": 1784734283249,
            "expiration_at_ms": 1784820683249,
        },
    }

    first = client.post("/v1/webhooks/revenuecat", json=payload)
    second = client.post("/v1/webhooks/revenuecat", json=payload)
    assert first.status_code == 200, first.text
    assert second.status_code == 200, second.text
    usage = client.get("/v1/me/usage").json()
    assert usage["plan"] == "promotional"
    assert usage["included"]["remaining"] == 15
    with session_factory()() as session:
        credits = (
            session.query(UsageEvent)
            .filter_by(kind=UsageEventKind.INCLUDED_CREDIT)
            .all()
        )
        assert len(credits) == 1
