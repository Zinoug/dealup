import logging
import time
from dataclasses import asdict
from typing import Any

import sentry_sdk

from analysis_worker.config import Settings
from analysis_worker.integrations import (
    Analytics,
    GeminiClient,
    GeminiError,
    MediaStorage,
    PiloterrClient,
    PiloterrError,
    PushNotifier,
)
from analysis_worker.repositories import AnalysisRepository
from analysis_worker.rules import REPORT_SCHEMA_VERSION
from analysis_worker.services.normalizer import normalize_listing
from analysis_worker.services.postprocessor import build_report, sanitize_candidate


logger = logging.getLogger(__name__)


class AnalysisProcessor:
    def __init__(
        self,
        settings: Settings,
        repository: AnalysisRepository,
        piloterr: PiloterrClient,
        gemini: GeminiClient,
        storage: MediaStorage,
        analytics: Analytics,
        notifier: PushNotifier | None = None,
    ) -> None:
        self.settings = settings
        self.repository = repository
        self.piloterr = piloterr
        self.gemini = gemini
        self.storage = storage
        self.analytics = analytics
        self.notifier = notifier

    def _notify(self, user_id: str, analysis_id: str, *, completed: bool) -> None:
        if self.notifier is None:
            return
        try:
            tokens = self.repository.push_tokens(user_id)
            if completed:
                title = "Ton rapport DealUp est prêt"
                body = "Ouvre DealUp pour découvrir le verdict."
            else:
                title = "L’analyse n’a pas abouti"
                body = "Ouvre DealUp pour réessayer."
            self.notifier.send(
                tokens,
                title=title,
                body=body,
                data={"analysis_id": analysis_id, "status": "completed" if completed else "failed"},
            )
        except Exception as exc:
            logger.warning(
                "analysis=%s stage=push_failed detail=%s",
                analysis_id,
                type(exc).__name__,
            )

    def process(self, analysis_id: str) -> dict[str, str | int]:
        job = self.repository.reserve(analysis_id)
        if job is None:
            return {"status": "ignored", "analysis_id": analysis_id}
        started = time.monotonic()
        debug_detail = ""
        failure_stage = "reserved"
        piloterr_duration_ms = 0
        gemini_started: float | None = None
        logger.info(
            "analysis=%s stage=reserved kind=%s category=%s",
            analysis_id,
            job.kind,
            job.device_category,
        )
        try:
            failure_stage = "piloterr"
            piloterr_called = job.listing_payload is None
            piloterr_started = time.monotonic()
            listing_payload = job.listing_payload or self.piloterr.fetch_ad(
                job.source_url
            )
            piloterr_duration_ms = (
                round((time.monotonic() - piloterr_started) * 1000)
                if piloterr_called
                else 0
            )
            normalized_listing = (
                normalize_listing(listing_payload)
                if piloterr_called or not job.normalized_listing
                else job.normalized_listing
            )
            logger.info(
                "analysis=%s stage=listing_ready piloterr_called=%s photos=%s elapsed_ms=%s",
                analysis_id,
                piloterr_called,
                len(normalized_listing.get("photos") or []),
                round((time.monotonic() - started) * 1000),
            )
            failure_stage = "media_archive"
            gemini_listing = normalized_listing
            persisted_listing = normalized_listing
            archived_images = self.storage.archive_listing_images(
                user_id=job.user_id,
                analysis_id=analysis_id,
                photos=list(normalized_listing.get("photos") or []),
                limit=self.settings.max_listing_images,
                max_bytes=self.settings.max_listing_image_bytes,
            )
            if archived_images:
                self.repository.record_listing_media(
                    analysis_id=analysis_id,
                    user_id=job.user_id,
                    images=[asdict(image) for image in archived_images],
                )
                gemini_listing = {
                    **normalized_listing,
                    "photos": [
                        {
                            "ref": f"listing_photo_{image.ordinal + 1:02d}",
                            "url": image.input_url,
                            "media_id": image.media_id,
                        }
                        for image in archived_images
                    ],
                }
                persisted_listing = {
                    **normalized_listing,
                    "photos": [
                        {
                            "ref": f"listing_photo_{image.ordinal + 1:02d}",
                            "media_id": image.media_id,
                        }
                        for image in archived_images
                    ],
                }
            private_images = self.storage.build_inputs(
                job.seller_media, self.settings.max_private_images
            )
            logger.info(
                "analysis=%s stage=media_ready archived_listing_images=%s "
                "seller_images=%s elapsed_ms=%s",
                analysis_id,
                len(archived_images),
                len(private_images),
                round((time.monotonic() - started) * 1000),
            )
            failure_stage = "gemini"
            logger.info(
                "analysis=%s stage=gemini_start elapsed_ms=%s",
                analysis_id,
                round((time.monotonic() - started) * 1000),
            )
            gemini_started = time.monotonic()
            output = self.gemini.analyze(
                analysis_id=analysis_id,
                normalized_listing=gemini_listing,
                device_profile=job.device_profile,
                purchase_mode=job.purchase_mode,
                seller_reply_text=job.seller_reply_text,
                parent_result=job.parent_result,
                private_images=private_images,
                model_id=job.model_id,
            )
            gemini_duration_ms = round((time.monotonic() - gemini_started) * 1000)
            failure_stage = "postprocess"
            sanitized_candidate, sensitive_candidate_field_count = sanitize_candidate(
                output.candidate
            )
            processed = build_report(
                sanitized_candidate,
                normalized_listing=persisted_listing,
                device_profile=job.device_profile,
                purchase_mode=job.purchase_mode,
                schema_version=REPORT_SCHEMA_VERSION,
            )
            logger.info(
                "analysis=%s stage=postprocess_complete template=%s elapsed_ms=%s",
                analysis_id,
                processed.result.template_id.value,
                round((time.monotonic() - started) * 1000),
            )
            metadata: dict[str, Any] = {
                **output.metadata,
                **processed.metadata,
                "engine_revision": job.engine_revision,
                "listing_image_count": len(gemini_listing.get("photos") or []),
                "private_image_count": len(private_images),
                "piloterr_duration_ms": piloterr_duration_ms,
                "gemini_duration_ms": gemini_duration_ms,
                "total_duration_ms": round((time.monotonic() - started) * 1000),
                "provider_pricing_version": self.settings.provider_pricing_version,
                "sensitive_candidate_field_count": sensitive_candidate_field_count,
            }
            if piloterr_called and self.settings.piloterr_eur_per_request is not None:
                metadata["piloterr_cost_microeur"] = round(
                    self.settings.piloterr_eur_per_request * 1_000_000
                )
            failure_stage = "persist"
            model_id = job.model_id or self.settings.gemini_model
            self.repository.complete(
                analysis_id,
                sanitized_candidate,
                processed.result.model_dump(mode="json"),
                model_id,
                {
                    "temperature": None,
                    "thinking_level": self.settings.gemini_thinking_level,
                    "store": self.settings.gemini_store_interactions,
                    "tools": ["google_search"],
                },
                metadata,
                listing_payload,
                persisted_listing,
            )
            logger.info(
                "analysis=%s stage=persisted status=completed total_ms=%s",
                analysis_id,
                round((time.monotonic() - started) * 1000),
            )
            self.analytics.capture(
                job.user_id,
                "analysis_completed",
                {
                    "analysis_id": analysis_id,
                    "kind": job.kind,
                    "model": model_id,
                    "device_category": job.device_category,
                    "template_id": processed.result.template_id.value,
                },
            )
            self._notify(job.user_id, analysis_id, completed=True)
            return {
                "status": "completed",
                "analysis_id": analysis_id,
                "duration_ms": round((time.monotonic() - started) * 1000),
            }
        except PiloterrError as exc:
            sentry_sdk.capture_exception(exc)
            error_code = "PILOTERR_FAILED"
            error_message = "L’annonce n’a pas pu être extraite."
            debug_detail = f"{type(exc).__name__}: {exc}"
        except GeminiError as exc:
            sentry_sdk.capture_exception(exc)
            error_code = exc.code
            if exc.code == "GEMINI_TIMEOUT":
                error_message = "L’analyse IA a dépassé le délai autorisé."
            elif exc.code == "GEMINI_CONNECTION_FAILED":
                error_message = "La connexion au service d’analyse a été interrompue."
            elif exc.code == "GEMINI_RESPONSE_INVALID":
                error_message = "La réponse IA reçue était incomplète ou invalide."
            elif exc.code == "GEMINI_REQUEST_INVALID":
                error_message = "La demande envoyée au service d’analyse a été refusée."
            else:
                error_message = "L’analyse IA n’a pas pu aboutir."
            debug_detail = exc.debug_detail or f"{type(exc).__name__}: {exc}"
        except Exception as exc:
            sentry_sdk.capture_exception(exc)
            error_code = "ANALYSIS_FAILED"
            error_message = "Une erreur inattendue a interrompu l’analyse."
            debug_detail = f"{type(exc).__name__}: {exc}"
        total_duration_ms = round((time.monotonic() - started) * 1000)
        failure_metadata = {
            "failure": {"code": error_code, "stage": failure_stage},
            "piloterr_duration_ms": piloterr_duration_ms,
            "gemini_duration_ms": (
                round((time.monotonic() - gemini_started) * 1000)
                if gemini_started is not None
                else 0
            ),
            "total_duration_ms": total_duration_ms,
            "provider_pricing_version": self.settings.provider_pricing_version,
        }
        self.repository.fail(analysis_id, error_code, error_message, failure_metadata)
        logger.error(
            "analysis=%s stage=failed error_code=%s total_ms=%s detail=%s",
            analysis_id,
            error_code,
            total_duration_ms,
            debug_detail[:300] if self.settings.app_env == "local" else "redacted",
        )
        self.analytics.capture(
            job.user_id,
            "analysis_failed",
            {"analysis_id": analysis_id, "kind": job.kind, "error_code": error_code},
        )
        self._notify(job.user_id, analysis_id, completed=False)
        result: dict[str, str | int] = {
            "status": "failed",
            "analysis_id": analysis_id,
            "error_code": error_code,
            "error_message": error_message,
            "duration_ms": total_duration_ms,
        }
        if self.settings.app_env == "local":
            result["debug_detail"] = debug_detail[:600]
        return result
