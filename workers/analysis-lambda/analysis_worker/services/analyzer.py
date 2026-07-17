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
    PushClient,
)
from analysis_worker.repositories import AnalysisRepository
from analysis_worker.services.normalizer import normalize_listing
from analysis_worker.services.postprocessor import build_report, sanitize_candidate


class AnalysisProcessor:
    def __init__(
        self,
        settings: Settings,
        repository: AnalysisRepository,
        piloterr: PiloterrClient,
        gemini: GeminiClient,
        storage: MediaStorage,
        analytics: Analytics,
        push: PushClient,
    ) -> None:
        self.settings = settings
        self.repository = repository
        self.piloterr = piloterr
        self.gemini = gemini
        self.storage = storage
        self.analytics = analytics
        self.push = push

    def process(self, analysis_id: str) -> dict[str, str]:
        job = self.repository.reserve(analysis_id)
        if job is None:
            return {"status": "ignored", "analysis_id": analysis_id}
        started = time.monotonic()
        try:
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
            gemini_started = time.monotonic()
            output = self.gemini.analyze(
                normalized_listing=gemini_listing,
                device_profile=job.device_profile,
                purchase_mode=job.purchase_mode,
                seller_reply_text=job.seller_reply_text,
                parent_result=job.parent_result,
                private_images=private_images,
                model_id=job.model_id,
            )
            gemini_duration_ms = round((time.monotonic() - gemini_started) * 1000)
            sanitized_candidate, sensitive_candidate_field_count = sanitize_candidate(
                output.candidate
            )
            processed = build_report(
                sanitized_candidate,
                normalized_listing=persisted_listing,
                device_profile=job.device_profile,
                purchase_mode=job.purchase_mode,
            )
            metadata: dict[str, Any] = {
                **output.metadata,
                **processed.metadata,
                "prompt_version": job.prompt_version,
                "schema_version": job.schema_version,
                "taxonomy_version": job.taxonomy_version,
                "scoring_version": job.scoring_version,
                "checklist_version": job.checklist_version,
                "device_catalog_version": job.device_catalog_version,
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
            model_id = job.model_id or self.settings.gemini_model
            self.repository.complete(
                analysis_id,
                sanitized_candidate.model_dump(mode="json"),
                processed.result.model_dump(mode="json"),
                model_id,
                {
                    "temperature": self.settings.gemini_temperature,
                    "thinking_level": self.settings.gemini_thinking_level,
                    "store": self.settings.gemini_store_interactions,
                    "tools": ["google_search"],
                },
                metadata,
                listing_payload,
                persisted_listing,
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
            if time.monotonic() - started >= self.settings.push_after_seconds:
                try:
                    self.push.send_analysis_ready(
                        self.repository.push_tokens(job.user_id), analysis_id
                    )
                except Exception as exc:
                    sentry_sdk.capture_exception(exc)
            return {"status": "completed", "analysis_id": analysis_id}
        except PiloterrError as exc:
            sentry_sdk.capture_exception(exc)
            self.repository.fail(
                analysis_id, "PILOTERR_FAILED", "L’annonce n’a pas pu être extraite."
            )
        except GeminiError as exc:
            sentry_sdk.capture_exception(exc)
            self.repository.fail(
                analysis_id, "GEMINI_FAILED", "L’analyse IA n’a pas pu aboutir."
            )
        except Exception as exc:
            sentry_sdk.capture_exception(exc)
            self.repository.fail(
                analysis_id,
                "ANALYSIS_FAILED",
                "Une erreur inattendue a interrompu l’analyse.",
            )
        self.analytics.capture(
            job.user_id,
            "analysis_failed",
            {"analysis_id": analysis_id, "kind": job.kind},
        )
        return {"status": "failed", "analysis_id": analysis_id}
