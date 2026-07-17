from datetime import datetime

from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.models import Subscription, UsageEvent, UsageEventKind


class UsageRepository:
    def __init__(self, session: Session) -> None:
        self.session = session

    def get_subscription(
        self, user_id: str, *, for_update: bool = False
    ) -> Subscription | None:
        query = select(Subscription).where(Subscription.user_id == user_id)
        if for_update:
            query = query.with_for_update()
        return self.session.scalar(query)

    def included_used(
        self, user_id: str, period_start: datetime, period_end: datetime
    ) -> int:
        value = self.session.scalar(
            select(func.coalesce(func.sum(UsageEvent.amount), 0)).where(
                UsageEvent.user_id == user_id,
                UsageEvent.kind.in_(
                    [UsageEventKind.INCLUDED_DEBIT, UsageEventKind.FAILURE_REVERSAL]
                ),
                UsageEvent.period_started_at == period_start,
                UsageEvent.period_ends_at == period_end,
            )
        )
        return abs(int(value or 0))

    def topup_balance(self, user_id: str) -> int:
        value = self.session.scalar(
            select(func.coalesce(func.sum(UsageEvent.amount), 0)).where(
                UsageEvent.user_id == user_id,
                (
                    UsageEvent.kind.in_(
                        [
                            UsageEventKind.TOPUP_CREDIT,
                            UsageEventKind.TOPUP_DEBIT,
                            UsageEventKind.MANUAL_ADJUSTMENT,
                        ]
                    )
                    | (
                        (UsageEvent.kind == UsageEventKind.FAILURE_REVERSAL)
                        & UsageEvent.period_started_at.is_(None)
                    )
                ),
            )
        )
        return max(0, int(value or 0))

    def add_event(self, event: UsageEvent) -> UsageEvent:
        self.session.add(event)
        self.session.flush()
        return event

    def has_source_event(self, source_event_id: str) -> bool:
        return (
            self.session.scalar(
                select(UsageEvent.id).where(
                    UsageEvent.source_event_id == source_event_id
                )
            )
            is not None
        )

    def has_reversal(self, analysis_id: str) -> bool:
        return (
            self.session.scalar(
                select(UsageEvent.id).where(
                    UsageEvent.analysis_id == analysis_id,
                    UsageEvent.kind == UsageEventKind.FAILURE_REVERSAL,
                )
            )
            is not None
        )

    def debit_for_analysis(self, analysis_id: str) -> UsageEvent | None:
        return self.session.scalar(
            select(UsageEvent).where(
                UsageEvent.analysis_id == analysis_id,
                UsageEvent.kind.in_(
                    [UsageEventKind.INCLUDED_DEBIT, UsageEventKind.TOPUP_DEBIT]
                ),
            )
        )
