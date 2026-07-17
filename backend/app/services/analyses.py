import hashlib
import json
from datetime import datetime, timezone

from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.core.errors import DealUpError
from app.domain import adapt_legacy_result, get_analysis_contract
from app.integrations import AnalysisInvoker, Analytics, MediaStorage
from app.models import (
    Analysis,
    AnalysisKind,
    AnalysisStatus,
    User,
)
from app.repositories import (
    AnalysisRepository,
    DeletionRepository,
    ListingRepository,
    MediaRepository,
)
from app.schemas.analysis import (
    AnalysisAccepted,
    AnalysisCreate,
    AnalysisList,
    AnalysisRead,
    AnalysisResult,
    AnalysisSummary,
    ReanalysisCreate,
)
from app.services.usage import UsageService


class AnalysisService:
    def __init__(
        self,
        session: Session,
        invoker: AnalysisInvoker,
        analytics: Analytics,
        storage: MediaStorage | None = None,
    ) -> None:
        self.session = session
        self.repo = AnalysisRepository(session)
        self.listings = ListingRepository(session)
        self.media = MediaRepository(session)
        self.usage = UsageService(session)
        self.invoker = invoker
        self.analytics = analytics
        self.storage = storage
        self.deletions = DeletionRepository(session)

    @staticmethod
    def _contract_versions() -> dict[str, str]:
        return get_analysis_contract().versions()

    @staticmethod
    def _version_fields(versions: dict[str, str]) -> dict[str, str]:
        return {
            "schema_version": versions["schema_version"],
            "prompt_version": versions["prompt_version"],
            "taxonomy_version": versions["taxonomy_version"],
            "scoring_version": versions["scoring_version"],
            "checklist_version": versions["checklist_version"],
            "device_catalog_version": versions["device_catalog_version"],
        }

    def _media_descriptors(
        self, user: User, media_ids: list[str]
    ) -> list[dict[str, object]]:
        media = self.media.get_owned_many(media_ids, user.id)
        if len(media) != len(set(media_ids)) or any(
            item.status != "ready" for item in media
        ):
            raise DealUpError(
                "MEDIA_NOT_READY", "Une ou plusieurs images ne sont pas prêtes.", 422
            )
        by_id = {item.id: item for item in media}
        return [
            {
                "id": item.id,
                "object_key": item.object_key,
                "content_type": item.content_type,
            }
            for media_id in media_ids
            if (item := by_id.get(media_id)) is not None
        ]

    def _accepted(
        self, analysis: Analysis, quota_source: str | None
    ) -> AnalysisAccepted:
        return AnalysisAccepted(
            analysis_id=analysis.id,
            status=analysis.status,
            quota_source=quota_source,
            created_at=analysis.created_at,
        )

    @staticmethod
    def _fingerprint(operation: str, payload: dict[str, object]) -> str:
        serialized = json.dumps(
            {"operation": operation, "payload": payload},
            sort_keys=True,
            separators=(",", ":"),
            ensure_ascii=False,
            default=str,
        )
        return hashlib.sha256(serialized.encode()).hexdigest()

    @staticmethod
    def _validate_replay(existing: Analysis, fingerprint: str) -> None:
        if existing.request_fingerprint != fingerprint:
            raise DealUpError(
                "IDEMPOTENCY_KEY_REUSED",
                "Cette clé d’idempotence a déjà été utilisée pour une autre requête.",
                409,
            )

    def _add_idempotent(
        self,
        user: User,
        candidate: Analysis,
        idempotency_key: str,
        fingerprint: str,
    ) -> tuple[Analysis, bool]:
        try:
            return self.repo.add(candidate), True
        except IntegrityError:
            self.session.rollback()
            existing = self.repo.get_by_idempotency(user.id, idempotency_key)
            if existing:
                self._validate_replay(existing, fingerprint)
                return existing, False
            raise

    def _dispatch(self, analysis: Analysis, *, charged: bool) -> None:
        try:
            self.invoker.invoke(analysis.id)
        except DealUpError:
            analysis.status = AnalysisStatus.FAILED
            analysis.error_code = "ANALYSIS_DISPATCH_FAILED"
            analysis.error_message = "L’analyse n’a pas pu être envoyée au worker."
            if charged:
                self.usage.reverse(analysis.id)
            self.session.commit()
            raise

    def create(
        self, user: User, data: AnalysisCreate, idempotency_key: str
    ) -> AnalysisAccepted:
        fingerprint = self._fingerprint("create", data.model_dump(mode="json"))
        existing = self.repo.get_by_idempotency(user.id, idempotency_key)
        if existing:
            self._validate_replay(existing, fingerprint)
            return self._accepted(existing, None)
        identification = self.listings.get_owned(
            data.identification_id, user.id, for_update=True
        )
        if not identification:
            raise DealUpError(
                "LISTING_NOT_FOUND", "Cette annonce identifiée est introuvable.", 404
            )
        if identification.consumed_at is not None:
            raise DealUpError(
                "LISTING_ALREADY_USED",
                "Cette identification a déjà servi. Identifie à nouveau l’annonce pour une nouvelle analyse.",
                409,
            )
        if (
            identification.compatibility_status != "SUPPORTED"
            or not identification.device_profile
        ):
            raise DealUpError(
                "UNSUPPORTED_DEVICE",
                "DealUp analyse actuellement les iPhone 11 ou plus récents et les MacBook Apple Silicon.",
                422,
            )
        existing = self.repo.get_by_idempotency(user.id, idempotency_key)
        if existing:
            self._validate_replay(existing, fingerprint)
            return self._accepted(existing, None)
        descriptors = self._media_descriptors(user, data.seller_context.media_ids)
        versions = self._contract_versions()
        analysis, created = self._add_idempotent(
            user,
            Analysis(
                user_id=user.id,
                identification_id=identification.id,
                kind=AnalysisKind.INITIAL,
                idempotency_key=idempotency_key,
                request_fingerprint=fingerprint,
                source_url=identification.source_url,
                external_listing_id=identification.external_id,
                purchase_mode=data.purchase_mode,
                seller_contacted=data.seller_context.already_contacted,
                seller_reply_text=data.seller_context.reply_text,
                seller_media=descriptors,
                listing_payload=identification.payload,
                normalized_listing=identification.normalized_payload,
                device_category=identification.device_category,
                device_profile=identification.device_profile,
                input_fingerprint=fingerprint,
                **self._version_fields(versions),
            ),
            idempotency_key,
            fingerprint,
        )
        if not created:
            return self._accepted(analysis, None)
        analysis.root_analysis_id = analysis.id
        self.media.attach_to_analysis(
            data.seller_context.media_ids, user.id, analysis.id
        )
        reservation = self.usage.reserve(user, analysis.id)
        identification.consumed_at = datetime.now(timezone.utc)
        self.session.commit()
        self._dispatch(analysis, charged=True)
        self.analytics.capture(
            user.clerk_user_id,
            "analysis_created",
            {"analysis_id": analysis.id, "purchase_mode": data.purchase_mode.value},
        )
        return self._accepted(analysis, reservation.source)

    def reanalyze(
        self,
        user: User,
        parent_id: str,
        data: ReanalysisCreate,
        idempotency_key: str,
    ) -> AnalysisAccepted:
        fingerprint = self._fingerprint(
            "reanalyze",
            {"parent_analysis_id": parent_id, **data.model_dump(mode="json")},
        )
        existing = self.repo.get_by_idempotency(user.id, idempotency_key)
        if existing:
            self._validate_replay(existing, fingerprint)
            return self._accepted(existing, None)
        parent = self.repo.get_owned(parent_id, user.id)
        if not parent:
            raise DealUpError("ANALYSIS_NOT_FOUND", "Analyse introuvable.", 404)
        if parent.status != AnalysisStatus.COMPLETED or not parent.result:
            raise DealUpError(
                "ANALYSIS_NOT_READY",
                "L’analyse doit être terminée avant sa réanalyse.",
                409,
            )
        descriptors = self._media_descriptors(user, data.media_ids)
        analysis, created = self._add_idempotent(
            user,
            Analysis(
                user_id=user.id,
                parent_analysis_id=parent.id,
                root_analysis_id=parent.root_analysis_id or parent.id,
                kind=AnalysisKind.REANALYSIS,
                idempotency_key=idempotency_key,
                request_fingerprint=fingerprint,
                source_url=parent.source_url,
                external_listing_id=parent.external_listing_id,
                purchase_mode=data.purchase_mode or parent.purchase_mode,
                seller_contacted=True,
                seller_reply_text=data.reply_text,
                seller_media=descriptors,
                listing_payload=parent.listing_payload,
                normalized_listing=parent.normalized_listing,
                device_category=parent.device_category,
                device_profile=parent.device_profile,
                parent_result=parent.result,
                model_id=parent.model_id,
                model_config=parent.model_config,
                schema_version=parent.schema_version,
                prompt_version=parent.prompt_version,
                taxonomy_version=parent.taxonomy_version,
                scoring_version=parent.scoring_version,
                checklist_version=parent.checklist_version,
                device_catalog_version=parent.device_catalog_version,
                input_fingerprint=fingerprint,
            ),
            idempotency_key,
            fingerprint,
        )
        if not created:
            return self._accepted(analysis, None)
        self.media.attach_to_analysis(data.media_ids, user.id, analysis.id)
        self.session.commit()
        self._dispatch(analysis, charged=False)
        self.analytics.capture(
            user.clerk_user_id, "seller_reply_added", {"analysis_id": parent.id}
        )
        return self._accepted(analysis, None)

    def refresh(
        self, user: User, parent_id: str, idempotency_key: str
    ) -> AnalysisAccepted:
        fingerprint = self._fingerprint("refresh", {"parent_analysis_id": parent_id})
        existing = self.repo.get_by_idempotency(user.id, idempotency_key)
        if existing:
            self._validate_replay(existing, fingerprint)
            return self._accepted(existing, None)
        parent = self.repo.get_owned(parent_id, user.id)
        if not parent:
            raise DealUpError("ANALYSIS_NOT_FOUND", "Analyse introuvable.", 404)
        if parent.status != AnalysisStatus.COMPLETED:
            raise DealUpError(
                "ANALYSIS_NOT_READY",
                "Attends la fin de l’analyse avant de la rafraîchir.",
                409,
            )
        versions = self._contract_versions()
        analysis, created = self._add_idempotent(
            user,
            Analysis(
                user_id=user.id,
                parent_analysis_id=parent.id,
                root_analysis_id=parent.root_analysis_id or parent.id,
                kind=AnalysisKind.REFRESH,
                idempotency_key=idempotency_key,
                request_fingerprint=fingerprint,
                source_url=parent.source_url,
                external_listing_id=parent.external_listing_id,
                purchase_mode=parent.purchase_mode,
                seller_contacted=parent.seller_contacted,
                seller_reply_text=parent.seller_reply_text,
                seller_media=parent.seller_media,
                listing_payload=None,
                normalized_listing=parent.normalized_listing,
                device_category=parent.device_category,
                device_profile=parent.device_profile,
                input_fingerprint=fingerprint,
                **self._version_fields(versions),
            ),
            idempotency_key,
            fingerprint,
        )
        if not created:
            return self._accepted(analysis, None)
        reservation = self.usage.reserve(user, analysis.id)
        self.session.commit()
        self._dispatch(analysis, charged=True)
        return self._accepted(analysis, reservation.source)

    def retry(self, user: User, analysis_id: str) -> AnalysisAccepted:
        analysis = self.repo.get_owned(analysis_id, user.id)
        if not analysis:
            raise DealUpError("ANALYSIS_NOT_FOUND", "Analyse introuvable.", 404)
        if analysis.status != AnalysisStatus.FAILED:
            raise DealUpError(
                "ANALYSIS_STATE_CONFLICT",
                "Seule une analyse échouée peut être relancée.",
                409,
            )
        self.repo.mark_pending_for_retry(analysis)
        self.session.commit()
        self._dispatch(analysis, charged=False)
        return self._accepted(analysis, None)

    def get(self, user: User, analysis_id: str) -> AnalysisRead:
        analysis = self.repo.get_owned(analysis_id, user.id)
        if not analysis:
            raise DealUpError("ANALYSIS_NOT_FOUND", "Analyse introuvable.", 404)
        return self._read(analysis, user.id)

    def _read(self, analysis: Analysis, user_id: str) -> AnalysisRead:
        result = None
        if analysis.result:
            public_payload = analysis.result
            if str(public_payload.get("schema_version")) == "1.0":
                public_payload = adapt_legacy_result(
                    public_payload,
                    listing_payload=analysis.listing_payload,
                    normalized_listing=analysis.normalized_listing,
                    device_profile=analysis.device_profile,
                )
            if public_payload:
                result = AnalysisResult.model_validate(public_payload)
        if result:
            media_id = result.listing.thumbnail_media_id
            if media_id and self.storage:
                media = self.media.get_owned(media_id, user_id)
                if media:
                    object_key = media.object_key
                    self.session.rollback()
                    try:
                        signed_url = self.storage.presign_read(object_key)
                    except DealUpError:
                        signed_url = None
                    result = result.model_copy(
                        update={
                            "listing": result.listing.model_copy(
                                update={"thumbnail_url": signed_url}
                            )
                        }
                    )
        return AnalysisRead(
            id=analysis.id,
            kind=analysis.kind,
            parent_analysis_id=analysis.parent_analysis_id,
            status=analysis.status,
            purchase_mode=analysis.purchase_mode,
            result=result,
            error_code=analysis.error_code,
            error_message=analysis.error_message,
            created_at=analysis.created_at,
            started_at=analysis.started_at,
            completed_at=analysis.completed_at,
        )

    def list(self, user: User, cursor: str | None, limit: int) -> AnalysisList:
        try:
            offset = int(cursor or "0")
        except ValueError as exc:
            raise DealUpError("INVALID_CURSOR", "Curseur invalide.", 422) from exc
        items, total = self.repo.list_owned(user.id, offset=offset, limit=limit)
        next_offset = offset + len(items)
        summaries: list[AnalysisSummary] = []
        for root in items:
            latest = self.repo.latest_for_root(user.id, root)
            parsed = None
            if latest.result:
                public_payload = latest.result
                if str(public_payload.get("schema_version")) == "1.0":
                    public_payload = adapt_legacy_result(
                        public_payload,
                        listing_payload=latest.listing_payload,
                        normalized_listing=latest.normalized_listing,
                        device_profile=latest.device_profile,
                    )
                if public_payload:
                    parsed = AnalysisResult.model_validate(public_payload)
            summaries.append(
                AnalysisSummary(
                    id=root.id,
                    latest_analysis_id=latest.id,
                    status=latest.status,
                    kind=latest.kind,
                    device=parsed.device if parsed else None,
                    listing=parsed.listing if parsed else None,
                    verdict=parsed.verdict if parsed else None,
                    template_id=parsed.template_id if parsed else None,
                    created_at=root.created_at,
                    completed_at=latest.completed_at,
                )
            )
        return AnalysisList(
            items=summaries,
            next_cursor=str(next_offset) if next_offset < total else None,
        )

    def delete(self, user: User, analysis_id: str) -> None:
        analysis = self.repo.get_owned(analysis_id, user.id)
        if not analysis:
            raise DealUpError("ANALYSIS_NOT_FOUND", "Analyse introuvable.", 404)
        root_id = analysis.root_analysis_id or analysis.id
        chain = self.repo.chain_owned(user.id, root_id)
        media = self.media.list_for_analyses([item.id for item in chain], user.id)
        deletion = self.deletions.add(
            user_id=user.id,
            kind="analysis",
            object_keys=[item.object_key for item in media],
        )
        self.session.commit()
        storage_failed = False
        if self.storage:
            try:
                for item in media:
                    self.storage.delete(item.object_key)
            except DealUpError as exc:
                self.deletions.fail(deletion, exc.code)
                self.session.commit()
                storage_failed = True
        self.repo.delete_chain(user.id, root_id)
        if not storage_failed:
            self.deletions.complete(deletion)
        self.session.commit()
