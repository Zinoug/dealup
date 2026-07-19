from datetime import datetime, timedelta, timezone

import pytest

from app.core.errors import DealUpError
from app.db.session import session_factory
from app.models import (
    Analysis,
    AnalysisKind,
    PurchaseMode,
    Subscription,
    SubscriptionPlan,
    SubscriptionStatus,
    UsageEvent,
    UsageEventKind,
    User,
)
from app.services import UsageService


def test_topup_is_used_only_after_included_quota() -> None:
    now = datetime.now(timezone.utc)
    period_end = now + timedelta(days=6)
    with session_factory()() as session:
        user = User(clerk_user_id="user_quota_test")
        session.add(user)
        session.flush()
        session.add(
            Subscription(
                user_id=user.id,
                plan=SubscriptionPlan.WEEKLY,
                status=SubscriptionStatus.ACTIVE,
                current_period_started_at=now,
                current_period_ends_at=period_end,
            )
        )
        for index in range(15):
            session.add(
                UsageEvent(
                    user_id=user.id,
                    kind=UsageEventKind.INCLUDED_DEBIT,
                    amount=-1,
                    period_started_at=now,
                    period_ends_at=period_end,
                    source_event_id=f"included-{index}",
                )
            )
        session.add(
            UsageEvent(
                user_id=user.id,
                kind=UsageEventKind.TOPUP_CREDIT,
                amount=1,
                source_event_id="topup-1",
            )
        )
        first = Analysis(
            user_id=user.id,
            kind=AnalysisKind.INITIAL,
            idempotency_key="quota-first",
            request_fingerprint="a" * 64,
            purchase_mode=PurchaseMode.FACE_TO_FACE,
            input_snapshot={
                "source_url": "https://www.leboncoin.fr/ad/telephones_objets_connectes/1"
            },
        )
        second = Analysis(
            user_id=user.id,
            kind=AnalysisKind.INITIAL,
            idempotency_key="quota-second",
            request_fingerprint="b" * 64,
            purchase_mode=PurchaseMode.FACE_TO_FACE,
            input_snapshot={
                "source_url": "https://www.leboncoin.fr/ad/telephones_objets_connectes/2"
            },
        )
        session.add_all([first, second])
        session.flush()

        assert UsageService(session).reserve(user, first.id).source == "top_up"
        with pytest.raises(DealUpError) as error:
            UsageService(session).reserve(user, second.id)
        assert error.value.code == "QUOTA_EXHAUSTED"
        assert error.value.details["available_upsells"] == [
            "upgrade_monthly",
            "top_up_10",
        ]
