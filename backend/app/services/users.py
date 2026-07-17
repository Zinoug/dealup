import uuid
from datetime import datetime, timezone

from sqlalchemy.orm import Session

from app.integrations import ClerkClient, MediaStorage
from app.models import User
from app.repositories import DeletionRepository, MediaRepository, UserRepository
from app.schemas.api import MeResponse
from app.services.usage import UsageService


class UserService:
    def __init__(self, session: Session, storage: MediaStorage | None = None) -> None:
        self.session = session
        self.repo = UserRepository(session)
        self.media = MediaRepository(session)
        self.deletions = DeletionRepository(session)
        self.storage = storage

    def get_or_create(self, clerk_user_id: str) -> User:
        user, _ = self.repo.get_or_create(clerk_user_id)
        # Close the authentication read transaction before downstream provider calls.
        self.session.commit()
        return user

    def me(self, user: User) -> MeResponse:
        return MeResponse(
            id=user.id,
            clerk_user_id=user.clerk_user_id,
            created_at=user.created_at,
            usage=UsageService(self.session).snapshot(user),
        )

    def delete_account(self, user: User, clerk: ClerkClient) -> None:
        media = self.media.list_owned_all(user.id)
        deletion = self.deletions.add(
            user_id=user.id,
            kind="account",
            object_keys=[item.object_key for item in media],
        )
        self.session.commit()
        storage_failed = False
        if self.storage:
            try:
                for item in media:
                    self.storage.delete(item.object_key)
            except Exception as exc:
                self.deletions.fail(deletion, type(exc).__name__)
                self.session.commit()
                storage_failed = True
        clerk.delete_user(user.clerk_user_id)
        self.repo.delete_private_data(user)
        user.clerk_user_id = f"deleted:{uuid.uuid4()}"
        user.deleted_at = datetime.now(timezone.utc)
        if not storage_failed:
            self.deletions.complete(deletion)
        self.session.commit()
