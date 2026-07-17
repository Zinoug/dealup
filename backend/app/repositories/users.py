from sqlalchemy import delete, select
from sqlalchemy.orm import Session

from app.models import (
    Analysis,
    Device,
    ListingIdentification,
    Media,
    RevenueCatEvent,
    Subscription,
    UsageEvent,
    User,
)


class UserRepository:
    def __init__(self, session: Session) -> None:
        self.session = session

    def get_by_id(self, user_id: str) -> User | None:
        return self.session.get(User, user_id)

    def get_by_clerk_id(self, clerk_user_id: str) -> User | None:
        return self.session.scalar(
            select(User).where(
                User.clerk_user_id == clerk_user_id, User.deleted_at.is_(None)
            )
        )

    def get_or_create(self, clerk_user_id: str) -> tuple[User, bool]:
        user = self.get_by_clerk_id(clerk_user_id)
        if user:
            return user, False
        user = User(clerk_user_id=clerk_user_id)
        self.session.add(user)
        self.session.flush()
        return user, True

    def delete_private_data(self, user: User) -> None:
        self.session.execute(delete(Device).where(Device.user_id == user.id))
        self.session.execute(delete(Media).where(Media.user_id == user.id))
        self.session.execute(delete(Analysis).where(Analysis.user_id == user.id))
        self.session.execute(
            delete(ListingIdentification).where(
                ListingIdentification.user_id == user.id
            )
        )
        self.session.execute(delete(UsageEvent).where(UsageEvent.user_id == user.id))
        self.session.execute(
            delete(Subscription).where(Subscription.user_id == user.id)
        )
        self.session.execute(
            delete(RevenueCatEvent).where(
                RevenueCatEvent.app_user_id == user.clerk_user_id
            )
        )
