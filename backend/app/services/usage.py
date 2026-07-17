from dataclasses import dataclass
from datetime import datetime, timedelta, timezone

from sqlalchemy.orm import Session

from app.core.errors import DealUpError
from app.models import (
    Subscription,
    SubscriptionPlan,
    SubscriptionStatus,
    UsageEvent,
    UsageEventKind,
    User,
)
from app.repositories import UsageRepository
from app.schemas.api import TopUpBucket, UsageBucket, UsageResponse


PLAN_LIMITS = {SubscriptionPlan.WEEKLY: 15, SubscriptionPlan.MONTHLY: 60}


def _aware(value: datetime | None) -> datetime | None:
    if value is None:
        return None
    return value if value.tzinfo else value.replace(tzinfo=timezone.utc)


@dataclass(frozen=True)
class QuotaReservation:
    source: str
    event: UsageEvent


class UsageService:
    def __init__(self, session: Session) -> None:
        self.session = session
        self.repo = UsageRepository(session)

    def _period(self, subscription: Subscription) -> tuple[datetime, datetime]:
        now = datetime.now(timezone.utc)
        end = _aware(subscription.current_period_ends_at)
        start = _aware(subscription.current_period_started_at)
        if end is None:
            raise DealUpError(
                "SUBSCRIPTION_SYNC_REQUIRED",
                "Synchronise ton abonnement pour continuer.",
                409,
            )
        if start is None:
            days = 7 if subscription.plan == SubscriptionPlan.WEEKLY else 31
            start = end - timedelta(days=days)
        if end <= now:
            raise DealUpError(
                "SUBSCRIPTION_REQUIRED", "Un abonnement actif est nécessaire.", 403
            )
        return start, end

    def _active_subscription(self, user_id: str, *, lock: bool = False) -> Subscription:
        subscription = self.repo.get_subscription(user_id, for_update=lock)
        if not subscription or subscription.status not in {
            SubscriptionStatus.ACTIVE,
            SubscriptionStatus.GRACE_PERIOD,
        }:
            raise DealUpError(
                "SUBSCRIPTION_REQUIRED", "Un abonnement actif est nécessaire.", 403
            )
        if subscription.plan not in PLAN_LIMITS:
            raise DealUpError(
                "SUBSCRIPTION_REQUIRED", "Un abonnement actif est nécessaire.", 403
            )
        self._period(subscription)
        return subscription

    def snapshot(self, user: User) -> UsageResponse:
        subscription = self.repo.get_subscription(user.id)
        topup = self.repo.topup_balance(user.id)
        if not subscription:
            return UsageResponse(
                plan="none",
                entitlement="inactive",
                included=UsageBucket(limit=0, used=0, remaining=0, period_ends_at=None),
                top_up=TopUpBucket(remaining=topup),
                available_upsells=[],
            )
        try:
            start, end = self._period(subscription)
            active = subscription.status in {
                SubscriptionStatus.ACTIVE,
                SubscriptionStatus.GRACE_PERIOD,
            }
        except DealUpError:
            start = end = None
            active = False
        limit = PLAN_LIMITS.get(subscription.plan, 0)
        used = self.repo.included_used(user.id, start, end) if start and end else 0
        remaining = max(0, limit - used) if active else 0
        upsells: list[str] = []
        if active and remaining == 0:
            if subscription.plan == SubscriptionPlan.WEEKLY:
                upsells.append("upgrade_monthly")
            upsells.append("top_up_10")
        return UsageResponse(
            plan=subscription.plan.value,
            entitlement="active" if active else "inactive",
            included=UsageBucket(
                limit=limit, used=used, remaining=remaining, period_ends_at=end
            ),
            top_up=TopUpBucket(remaining=topup),
            available_upsells=upsells,
        )

    def reserve(self, user: User, analysis_id: str) -> QuotaReservation:
        subscription = self._active_subscription(user.id, lock=True)
        start, end = self._period(subscription)
        limit = PLAN_LIMITS[subscription.plan]
        used = self.repo.included_used(user.id, start, end)
        if used < limit:
            event = self.repo.add_event(
                UsageEvent(
                    user_id=user.id,
                    analysis_id=analysis_id,
                    kind=UsageEventKind.INCLUDED_DEBIT,
                    amount=-1,
                    period_started_at=start,
                    period_ends_at=end,
                )
            )
            return QuotaReservation("included", event)
        if self.repo.topup_balance(user.id) > 0:
            event = self.repo.add_event(
                UsageEvent(
                    user_id=user.id,
                    analysis_id=analysis_id,
                    kind=UsageEventKind.TOPUP_DEBIT,
                    amount=-1,
                )
            )
            return QuotaReservation("top_up", event)
        upsells = ["top_up_10"]
        if subscription.plan == SubscriptionPlan.WEEKLY:
            upsells.insert(0, "upgrade_monthly")
        raise DealUpError(
            "QUOTA_EXHAUSTED",
            "Ton quota est épuisé.",
            409,
            {"available_upsells": upsells},
        )

    def reverse(self, analysis_id: str) -> None:
        if self.repo.has_reversal(analysis_id):
            return
        debit = self.repo.debit_for_analysis(analysis_id)
        if not debit:
            return
        self.repo.add_event(
            UsageEvent(
                user_id=debit.user_id,
                analysis_id=analysis_id,
                kind=UsageEventKind.FAILURE_REVERSAL,
                amount=1,
                period_started_at=debit.period_started_at,
                period_ends_at=debit.period_ends_at,
                source_event_id=f"analysis-failure:{analysis_id}",
            )
        )
