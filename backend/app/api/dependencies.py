from typing import Annotated

from fastapi import Depends
from sqlalchemy.orm import Session

from app.core.config import Settings, get_settings
from app.core.security import AuthenticatedIdentity, get_identity
from app.db.session import get_db
from app.integrations import AnalysisInvoker, Analytics, MediaStorage, PiloterrClient
from app.models import User
from app.services.users import UserService

DbSession = Annotated[Session, Depends(get_db)]
Identity = Annotated[AuthenticatedIdentity, Depends(get_identity)]


def current_user(identity: Identity, session: DbSession) -> User:
    return UserService(session).get_or_create(identity.clerk_user_id)


CurrentUser = Annotated[User, Depends(current_user)]


def settings_dependency() -> Settings:
    return get_settings()


def piloterr_dependency(
    settings: Annotated[Settings, Depends(settings_dependency)],
) -> PiloterrClient:
    return PiloterrClient(settings)


def invoker_dependency(
    settings: Annotated[Settings, Depends(settings_dependency)],
) -> AnalysisInvoker:
    return AnalysisInvoker(settings)


def analytics_dependency(
    settings: Annotated[Settings, Depends(settings_dependency)],
) -> Analytics:
    return Analytics(settings)


def storage_dependency(
    settings: Annotated[Settings, Depends(settings_dependency)],
) -> MediaStorage:
    return MediaStorage(settings)
