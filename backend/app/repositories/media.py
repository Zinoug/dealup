from sqlalchemy import delete, select
from sqlalchemy.orm import Session

from app.models import Device, Media


class MediaRepository:
    def __init__(self, session: Session) -> None:
        self.session = session

    def add(self, media: Media) -> Media:
        self.session.add(media)
        self.session.flush()
        return media

    def get_owned_many(self, media_ids: list[str], user_id: str) -> list[Media]:
        if not media_ids:
            return []
        return list(
            self.session.scalars(
                select(Media).where(Media.id.in_(media_ids), Media.user_id == user_id)
            )
        )

    def get_owned(self, media_id: str, user_id: str) -> Media | None:
        return self.session.scalar(
            select(Media).where(Media.id == media_id, Media.user_id == user_id)
        )

    def attach_to_analysis(
        self, media_ids: list[str], user_id: str, analysis_id: str
    ) -> None:
        if not media_ids:
            return
        items = self.get_owned_many(media_ids, user_id)
        for ordinal, item in enumerate(items):
            item.analysis_id = analysis_id
            item.role = "seller_media"
            item.ordinal = ordinal

    def list_for_analyses(self, analysis_ids: list[str], user_id: str) -> list[Media]:
        if not analysis_ids:
            return []
        return list(
            self.session.scalars(
                select(Media).where(
                    Media.analysis_id.in_(analysis_ids), Media.user_id == user_id
                )
            )
        )

    def list_owned_all(self, user_id: str) -> list[Media]:
        return list(self.session.scalars(select(Media).where(Media.user_id == user_id)))

    def delete(self, media: Media) -> None:
        self.session.delete(media)


class DeviceRepository:
    def __init__(self, session: Session) -> None:
        self.session = session

    def upsert(self, user_id: str, push_token: str, platform: str) -> Device:
        device = self.session.scalar(
            select(Device).where(
                Device.user_id == user_id, Device.push_token == push_token
            )
        )
        if device:
            device.platform = platform
            return device
        device = Device(user_id=user_id, push_token=push_token, platform=platform)
        self.session.add(device)
        self.session.flush()
        return device

    def delete_owned(self, device_id: str, user_id: str) -> bool:
        result = self.session.execute(
            delete(Device).where(Device.id == device_id, Device.user_id == user_id)
        )
        return bool(result.rowcount)
