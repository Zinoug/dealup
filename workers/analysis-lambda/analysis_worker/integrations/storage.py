import hashlib
import uuid
from dataclasses import dataclass
from typing import Any

import boto3
import httpx


@dataclass(frozen=True)
class ArchivedImage:
    media_id: str
    object_key: str
    content_type: str
    size_bytes: int
    sha256: str
    ordinal: int
    input_url: str


class MediaStorage:
    def __init__(
        self,
        bucket: str,
        region: str,
        access_key_id: str = "",
        secret_access_key: str = "",
        session_token: str = "",
    ) -> None:
        self.bucket = bucket
        self.region = region
        self.client_options = {"region_name": region}
        if access_key_id and secret_access_key:
            self.client_options.update(
                {
                    "aws_access_key_id": access_key_id,
                    "aws_secret_access_key": secret_access_key,
                }
            )
            if session_token:
                self.client_options["aws_session_token"] = session_token

    def build_inputs(
        self, media: list[dict[str, Any]], limit: int
    ) -> list[dict[str, str]]:
        if not media or not self.bucket:
            return []
        client = boto3.client("s3", **self.client_options)
        inputs: list[dict[str, str]] = []
        for item in media[:limit]:
            object_key = item.get("object_key")
            if not isinstance(object_key, str):
                continue
            url = client.generate_presigned_url(
                "get_object",
                Params={"Bucket": self.bucket, "Key": object_key},
                ExpiresIn=900,
            )
            inputs.append(
                {
                    "type": "image",
                    "uri": url,
                    "mime_type": str(item.get("content_type") or "image/jpeg"),
                }
            )
        return inputs

    def archive_listing_images(
        self,
        *,
        user_id: str,
        analysis_id: str,
        photos: list[dict[str, Any]],
        limit: int,
        max_bytes: int,
    ) -> list[ArchivedImage]:
        if not self.bucket:
            return []
        client = boto3.client("s3", **self.client_options)
        archived: list[ArchivedImage] = []
        extensions = {
            "image/jpeg": ".jpg",
            "image/png": ".png",
            "image/webp": ".webp",
            "image/heic": ".heic",
        }
        for ordinal, photo in enumerate(photos[:limit]):
            url = photo.get("url") if isinstance(photo, dict) else None
            if not isinstance(url, str) or not url.startswith("https://"):
                continue
            try:
                response = httpx.get(url, timeout=15.0, follow_redirects=True)
                response.raise_for_status()
            except httpx.HTTPError:
                continue
            content = response.content
            content_type = response.headers.get("content-type", "").split(";", 1)[0]
            if (
                content_type not in extensions
                or not content
                or len(content) > max_bytes
            ):
                continue
            digest = hashlib.sha256(content).hexdigest()
            object_key = (
                f"private/{user_id}/analyses/{analysis_id}/listing/"
                f"{ordinal + 1:02d}{extensions[content_type]}"
            )
            client.put_object(
                Bucket=self.bucket,
                Key=object_key,
                Body=content,
                ContentType=content_type,
                Metadata={"sha256": digest},
            )
            input_url = client.generate_presigned_url(
                "get_object",
                Params={"Bucket": self.bucket, "Key": object_key},
                ExpiresIn=900,
            )
            archived.append(
                ArchivedImage(
                    media_id=str(uuid.uuid5(uuid.NAMESPACE_URL, object_key)),
                    object_key=object_key,
                    content_type=content_type,
                    size_bytes=len(content),
                    sha256=digest,
                    ordinal=ordinal,
                    input_url=input_url,
                )
            )
        return archived
