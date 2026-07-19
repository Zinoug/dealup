import uuid
from datetime import datetime, timedelta, timezone

from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.integrations import ClerkClient, ClerkUserProfile, MediaStorage
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
        try:
            user, _ = self.repo.get_or_create(clerk_user_id)
            self.repo.touch(user)
            self.session.commit()
            return user
        except IntegrityError:
            # Two authenticated requests may race on a user's very first session.
            # The unique Clerk ID remains authoritative; after rolling back the
            # losing insert, return the row committed by the winning request.
            self.session.rollback()
            user = self.repo.get_by_clerk_id(clerk_user_id)
            if user is None:
                raise
        # Close the authentication read transaction before downstream provider calls.
        self.repo.touch(user)
        self.session.commit()
        return user

    def sync_profile(self, profile: ClerkUserProfile) -> User:
        if not profile.clerk_user_id:
            raise ValueError("Clerk profile has no user id")
        user, _ = self.repo.get_or_create(profile.clerk_user_id)
        user.email = profile.email
        user.display_name = profile.display_name
        user.auth_provider = profile.auth_provider
        user.clerk_created_at = profile.clerk_created_at
        user.clerk_synced_at = datetime.now(timezone.utc)
        self.repo.touch(user)
        self.session.commit()
        return user

    def hydrate_profile(self, user: User, clerk: ClerkClient) -> User:
        if user.clerk_synced_at:
            synced_at = user.clerk_synced_at
            if synced_at.tzinfo is None:
                synced_at = synced_at.replace(tzinfo=timezone.utc)
            if synced_at >= datetime.now(timezone.utc) - timedelta(hours=24):
                return user
        profile = clerk.get_user(user.clerk_user_id)
        return self.sync_profile(profile) if profile else user

    def me(self, user: User) -> MeResponse:
        return MeResponse(
            id=user.id,
            clerk_user_id=user.clerk_user_id,
            email=user.email,
            display_name=user.display_name,
            auth_provider=user.auth_provider,
            created_at=user.created_at,
            usage=UsageService(self.session).snapshot(user),
        )

    def delete_account(
        self, user: User, clerk: ClerkClient | None = None
    ) -> None:
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
        if clerk is not None:
            clerk.delete_user(user.clerk_user_id)
        self.repo.delete_private_data(user)
        user.clerk_user_id = f"deleted:{uuid.uuid4()}"
        user.email = None
        user.display_name = None
        user.auth_provider = None
        user.deleted_at = datetime.now(timezone.utc)
        if not storage_failed:
            self.deletions.complete(deletion)
        self.session.commit()
