from fastapi import APIRouter, Depends, Response, status

from app.api.dependencies import (
    CurrentUser,
    DbSession,
    settings_dependency,
    storage_dependency,
)
from app.core.config import Settings
from app.integrations import ClerkClient, MediaStorage
from app.schemas.api import MeResponse, UsageResponse
from app.services import UsageService, UserService

router = APIRouter(prefix="/v1/me", tags=["user"])


@router.get("", response_model=MeResponse)
def get_me(user: CurrentUser, session: DbSession) -> MeResponse:
    return UserService(session).me(user)


@router.get("/usage", response_model=UsageResponse)
def get_usage(user: CurrentUser, session: DbSession) -> UsageResponse:
    return UsageService(session).snapshot(user)


@router.delete("", status_code=status.HTTP_204_NO_CONTENT)
def delete_me(
    user: CurrentUser,
    session: DbSession,
    settings: Settings = Depends(settings_dependency),
    storage: MediaStorage = Depends(storage_dependency),
) -> Response:
    UserService(session, storage).delete_account(user, ClerkClient(settings))
    return Response(status_code=status.HTTP_204_NO_CONTENT)
