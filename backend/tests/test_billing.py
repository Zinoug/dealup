from app.db.session import session_factory
from app.models import UsageEvent, UsageEventKind


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
