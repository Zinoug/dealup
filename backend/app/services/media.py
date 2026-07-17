import uuid
from pathlib import PurePosixPath

from sqlalchemy.orm import Session

from app.core.config import Settings
from app.core.errors import DealUpError
from app.integrations import MediaStorage
from app.models import Media, User
from app.repositories import DeviceRepository, MediaRepository
from app.schemas.api import DeviceCreate, DeviceResponse, UploadCreate, UploadResponse


EXTENSIONS = {
    "image/jpeg": ".jpg",
    "image/png": ".png",
    "image/heic": ".heic",
    "image/webp": ".webp",
}


class MediaService:
    def __init__(
        self, session: Session, storage: MediaStorage, settings: Settings
    ) -> None:
        self.session = session
        self.repo = MediaRepository(session)
        self.storage = storage
        self.settings = settings

    def create_upload(self, user: User, data: UploadCreate) -> UploadResponse:
        if data.size_bytes > self.settings.media_upload_max_bytes:
            raise DealUpError(
                "MEDIA_TOO_LARGE", "L’image dépasse la taille autorisée.", 422
            )
        media_id = str(uuid.uuid4())
        object_key = str(
            PurePosixPath(
                "private", user.id, f"{media_id}{EXTENSIONS[data.content_type]}"
            )
        )
        upload = self.storage.presign_upload(
            object_key, data.content_type, data.size_bytes
        )
        media = self.repo.add(
            Media(
                id=media_id,
                user_id=user.id,
                object_key=object_key,
                content_type=data.content_type,
                size_bytes=data.size_bytes,
            )
        )
        self.session.commit()
        return UploadResponse(
            media_id=media.id,
            object_key=object_key,
            upload=upload,
            expires_in_seconds=900,
        )

    def delete(self, user: User, media_id: str) -> None:
        user_id = user.id
        media = self.repo.get_owned(media_id, user_id)
        if not media:
            raise DealUpError("MEDIA_NOT_FOUND", "Image introuvable.", 404)
        object_key = media.object_key
        self.session.rollback()
        self.storage.delete(object_key)
        media = self.repo.get_owned(media_id, user_id)
        if not media:
            return
        self.repo.delete(media)
        self.session.commit()

    def complete(self, user: User, media_id: str) -> None:
        user_id = user.id
        media = self.repo.get_owned(media_id, user_id)
        if not media:
            raise DealUpError("MEDIA_NOT_FOUND", "Image introuvable.", 404)
        object_key = media.object_key
        expected_size = media.size_bytes
        expected_type = media.content_type
        self.session.rollback()
        metadata = self.storage.inspect(object_key)
        actual_size = int(metadata.get("ContentLength") or 0)
        actual_type = str(metadata.get("ContentType") or "")
        if (
            actual_size <= 0
            or actual_size > expected_size
            or actual_type != expected_type
        ):
            self.storage.delete(object_key)
            raise DealUpError(
                "MEDIA_UPLOAD_INVALID", "L’image reçue est invalide.", 422
            )
        media = self.repo.get_owned(media_id, user_id)
        if not media:
            raise DealUpError("MEDIA_NOT_FOUND", "Image introuvable.", 404)
        media.status = "ready"
        self.session.commit()


class DeviceService:
    def __init__(self, session: Session) -> None:
        self.session = session
        self.repo = DeviceRepository(session)

    def register(self, user: User, data: DeviceCreate) -> DeviceResponse:
        device = self.repo.upsert(user.id, data.push_token, data.platform)
        self.session.commit()
        return DeviceResponse(
            id=device.id, platform=device.platform, created_at=device.created_at
        )

    def delete(self, user: User, device_id: str) -> None:
        if not self.repo.delete_owned(device_id, user.id):
            raise DealUpError("DEVICE_NOT_FOUND", "Appareil introuvable.", 404)
        self.session.commit()
