from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models import RevenueCatEvent, Subscription


class BillingRepository:
    def __init__(self, session: Session) -> None:
        self.session = session

    def event_exists(self, event_id: str) -> bool:
        return self.session.get(RevenueCatEvent, event_id) is not None

    def add_event(self, event: RevenueCatEvent) -> None:
        self.session.add(event)
        self.session.flush()

    def get_subscription(self, user_id: str) -> Subscription | None:
        return self.session.scalar(
            select(Subscription).where(Subscription.user_id == user_id)
        )

    def get_or_create_subscription(self, user_id: str) -> Subscription:
        subscription = self.get_subscription(user_id)
        if subscription:
            return subscription
        subscription = Subscription(user_id=user_id)
        self.session.add(subscription)
        self.session.flush()
        return subscription
