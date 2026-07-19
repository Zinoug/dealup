import json
from typing import Any

import boto3
from botocore.exceptions import BotoCoreError, ClientError

from app.core.config import Settings
from app.core.errors import DealUpError


class AnalysisInvoker:
    def __init__(self, settings: Settings) -> None:
        self.settings = settings

    def invoke(self, analysis_id: str) -> None:
        if self.settings.analysis_invoke_mode == "disabled":
            return
        try:
            client = boto3.client("lambda", **_client_options(self.settings))
            response: dict[str, Any] = client.invoke(
                FunctionName=self.settings.analysis_lambda_name,
                InvocationType="Event",
                Payload=json.dumps({"analysis_id": analysis_id}).encode(),
            )
        except (BotoCoreError, ClientError) as exc:
            raise DealUpError(
                "ANALYSIS_DISPATCH_FAILED",
                "L’analyse n’a pas pu démarrer. Réessaie.",
                503,
            ) from exc
        if response.get("StatusCode") != 202:
            raise DealUpError(
                "ANALYSIS_DISPATCH_FAILED",
                "L’analyse n’a pas pu démarrer. Réessaie.",
                503,
            )


class MediaStorage:
    def __init__(self, settings: Settings) -> None:
        self.settings = settings

    def presign_upload(
        self, object_key: str, content_type: str, size_bytes: int
    ) -> dict[str, Any]:
        if not self.settings.media_bucket:
            raise DealUpError(
                "MEDIA_NOT_CONFIGURED",
                "Le stockage des images n’est pas configuré.",
                503,
            )
        try:
            client = boto3.client("s3", **_client_options(self.settings))
            return client.generate_presigned_post(
                Bucket=self.settings.media_bucket,
                Key=object_key,
                Fields={"Content-Type": content_type},
                Conditions=[
                    {"Content-Type": content_type},
                    ["content-length-range", 1, size_bytes],
                ],
                ExpiresIn=900,
            )
        except (BotoCoreError, ClientError) as exc:
            raise DealUpError(
                "MEDIA_PROVIDER_UNAVAILABLE",
                "L’envoi d’image est temporairement indisponible.",
                503,
            ) from exc

    def delete(self, object_key: str) -> None:
        if not self.settings.media_bucket:
            return
        try:
            boto3.client("s3", **_client_options(self.settings)).delete_object(
                Bucket=self.settings.media_bucket, Key=object_key
            )
        except (BotoCoreError, ClientError) as exc:
            raise DealUpError(
                "MEDIA_PROVIDER_UNAVAILABLE",
                "Le stockage d’images est temporairement indisponible.",
                503,
            ) from exc

    def inspect(self, object_key: str) -> dict[str, Any]:
        if not self.settings.media_bucket:
            raise DealUpError(
                "MEDIA_NOT_CONFIGURED",
                "Le stockage des images n’est pas configuré.",
                503,
            )
        try:
            return boto3.client("s3", **_client_options(self.settings)).head_object(
                Bucket=self.settings.media_bucket, Key=object_key
            )
        except (BotoCoreError, ClientError) as exc:
            raise DealUpError(
                "MEDIA_UPLOAD_INCOMPLETE", "L’image n’a pas été reçue.", 409
            ) from exc

    def presign_read(self, object_key: str, expires_in: int = 900) -> str:
        if not self.settings.media_bucket:
            raise DealUpError(
                "MEDIA_NOT_CONFIGURED",
                "Le stockage des images n’est pas configuré.",
                503,
            )
        try:
            return boto3.client(
                "s3", **_client_options(self.settings)
            ).generate_presigned_url(
                "get_object",
                Params={"Bucket": self.settings.media_bucket, "Key": object_key},
                ExpiresIn=expires_in,
            )
        except (BotoCoreError, ClientError) as exc:
            raise DealUpError(
                "MEDIA_PROVIDER_UNAVAILABLE",
                "L’image est temporairement indisponible.",
                503,
            ) from exc


def _client_options(settings: Settings) -> dict[str, str]:
    options = {"region_name": settings.aws_region}
    if settings.aws_access_key_id and settings.aws_secret_access_key:
        options.update(
            {
                "aws_access_key_id": settings.aws_access_key_id,
                "aws_secret_access_key": settings.aws_secret_access_key,
            }
        )
        if settings.aws_session_token:
            options["aws_session_token"] = settings.aws_session_token
    return options
