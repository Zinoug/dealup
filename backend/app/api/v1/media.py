from fastapi import APIRouter, Depends, Response, status

from app.api.dependencies import (
    CurrentUser,
    DbSession,
    settings_dependency,
    storage_dependency,
)
from app.core.config import Settings
from app.integrations import MediaStorage
from app.schemas.api import (
    DeviceCreate,
    DeviceResponse,
    MessageResponse,
    UploadCreate,
    UploadResponse,
)
from app.services import DeviceService, MediaService

router = APIRouter(tags=["media", "devices"])


@router.post("/v1/uploads/presign", response_model=UploadResponse)
def presign_upload(
    body: UploadCreate,
    user: CurrentUser,
    session: DbSession,
    storage: MediaStorage = Depends(storage_dependency),
    settings: Settings = Depends(settings_dependency),
) -> UploadResponse:
    return MediaService(session, storage, settings).create_upload(user, body)


@router.delete("/v1/uploads/{media_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_upload(media_id: str, user: CurrentUser, session: DbSession) -> Response:
    MediaService(
        session, MediaStorage(settings_dependency()), settings_dependency()
    ).delete(user, media_id)
    return Response(status_code=status.HTTP_204_NO_CONTENT)


@router.post("/v1/uploads/{media_id}/complete", response_model=MessageResponse)
def complete_upload(
    media_id: str,
    user: CurrentUser,
    session: DbSession,
    storage: MediaStorage = Depends(storage_dependency),
    settings: Settings = Depends(settings_dependency),
) -> MessageResponse:
    MediaService(session, storage, settings).complete(user, media_id)
    return MessageResponse(message="ready")


@router.post("/v1/devices", response_model=DeviceResponse)
def register_device(
    body: DeviceCreate, user: CurrentUser, session: DbSession
) -> DeviceResponse:
    return DeviceService(session).register(user, body)


@router.delete("/v1/devices/{device_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_device(device_id: str, user: CurrentUser, session: DbSession) -> Response:
    DeviceService(session).delete(user, device_id)
    return Response(status_code=status.HTTP_204_NO_CONTENT)
