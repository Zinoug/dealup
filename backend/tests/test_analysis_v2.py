from datetime import datetime, timedelta, timezone

from app.api.dependencies import storage_dependency
from app.api.v1.listings import piloterr_dependency
from app.core.errors import DealUpError
from app.db.session import session_factory
from app.domain import adapt_legacy_result, get_analysis_contract
from app.models import (
    Analysis,
    AnalysisKind,
    AnalysisStatus,
    DeletionJob,
    Media,
    PurchaseMode,
    Subscription,
    SubscriptionPlan,
    SubscriptionStatus,
    UsageEvent,
    UsageEventKind,
    User,
)
from app.schemas.analysis import AnalysisResult
from app.services.deletions import DeletionService


class FakePiloterr:
    def fetch_ad(self, url: str) -> dict:
        return {
            "url": url,
            "list_id": 4012186547,
            "subject": "iPhone 15 Pro 256 Go",
            "body": "Remise en main propre.",
            "price_cents": [72000],
            "images": {"urls": []},
            "location": {"city": "Paris", "zipcode": "75011"},
            "attributes": [{"key": "storage", "value_label": "256 Go"}],
        }


class FailingStorage:
    def delete(self, object_key: str) -> None:
        raise DealUpError("MEDIA_PROVIDER_UNAVAILABLE", "S3 indisponible", 503)


class SuccessfulStorage:
    def __init__(self) -> None:
        self.deleted: list[str] = []

    def delete(self, object_key: str) -> None:
        self.deleted.append(object_key)


class PresigningStorage:
    def presign_read(self, object_key: str) -> str:
        return f"https://media.example.test/{object_key}"


def activate_subscription() -> None:
    with session_factory()() as session:
        user = session.query(User).filter_by(clerk_user_id="user_local_dealup").one()
        now = datetime.now(timezone.utc)
        session.add(
            Subscription(
                user_id=user.id,
                plan=SubscriptionPlan.WEEKLY,
                status=SubscriptionStatus.ACTIVE,
                product_id="dealup_premium_weekly",
                current_period_started_at=now - timedelta(days=1),
                current_period_ends_at=now + timedelta(days=6),
                will_renew=True,
            )
        )
        session.add(
            UsageEvent(
                user_id=user.id,
                kind=UsageEventKind.INCLUDED_CREDIT,
                amount=15,
                source_event_id="subscription-period:test-v2",
            )
        )
        session.commit()


def create_initial(client) -> str:
    identified = client.post(
        "/v1/listings/identify",
        json={
            "url": "https://www.leboncoin.fr/ad/telephones_objets_connectes/4012186547"
        },
    )
    assert identified.status_code == 200, identified.text
    created = client.post(
        "/v1/analyses",
        headers={"Idempotency-Key": "analysis-v2-initial-0001"},
        json={
            "identification_id": identified.json()["identification_id"],
            "purchase_mode": "face_to_face",
        },
    )
    assert created.status_code == 202, created.text
    return created.json()["analysis_id"]


def test_reanalysis_and_refresh_capture_current_engine_metadata(client) -> None:
    from app.main import app

    app.dependency_overrides[piloterr_dependency] = lambda: FakePiloterr()
    try:
        client.get("/v1/me")
        activate_subscription()
        parent_id = create_initial(client)
        with session_factory()() as session:
            parent = session.get(Analysis, parent_id)
            assert parent is not None
            parent.status = AnalysisStatus.COMPLETED
            parent.result = {"schema_version": "2.0", "internal_test": True}
            parent.model_id = "founder-manual-model"
            parent.engine_revision = "legacy-engine"
            session.commit()

        reanalysis = client.post(
            f"/v1/analyses/{parent_id}/reanalyze",
            headers={"Idempotency-Key": "analysis-v2-reanalysis-0001"},
            json={"reply_text": "Le vendeur a envoyé la facture."},
        )
        refresh = client.post(
            f"/v1/analyses/{parent_id}/refresh",
            headers={"Idempotency-Key": "analysis-v2-refresh-0001"},
        )
        assert reanalysis.status_code == 202, reanalysis.text
        assert refresh.status_code == 202, refresh.text

        with session_factory()() as session:
            child = session.get(Analysis, reanalysis.json()["analysis_id"])
            refreshed = session.get(Analysis, refresh.json()["analysis_id"])
            assert child is not None and refreshed is not None
            assert child.kind == AnalysisKind.REANALYSIS
            assert child.engine_revision == "legacy-engine"
            assert child.model_id == "founder-manual-model"
            assert child.root_analysis_id == parent_id
            assert refreshed.kind == AnalysisKind.REFRESH
            assert refreshed.engine_revision == get_analysis_contract().engine_revision
            assert refreshed.root_analysis_id == parent_id
    finally:
        app.dependency_overrides.clear()


def test_legacy_report_is_adapted_without_rewriting_storage() -> None:
    legacy = {
        "schema_version": "1.0",
        "verdict": {
            "type": "NEGOTIATE",
            "deal_score": 72,
            "confidence": "MEDIUM",
            "headline": "Bonne base à négocier",
            "explanation": "Le prix mérite une discussion.",
        },
        "primary_action": {
            "type": "MAKE_OFFER",
            "label": "Faire une offre",
            "reason": "Le prix est ajustable.",
        },
        "pricing": {
            "currency": "EUR",
            "asking_price_cents": 72000,
            "market_low_cents": 65000,
            "market_median_cents": 70000,
            "fair_price_cents": 69000,
            "opening_offer_cents": 64000,
            "agreement_zone_low_cents": 66000,
            "agreement_zone_high_cents": 69000,
            "max_recommended_cents": 70000,
            "potential_savings_cents": 4500,
            "confidence": "MEDIUM",
        },
        "risks": {"level": "MEDIUM", "items": []},
        "positive_signals": [],
        "missing_information": [],
        "messages": {
            "request_proofs": "Pouvez-vous fournir la facture ?",
            "make_offer": "Je vous propose 660 €.",
            "decline": "Merci, je ne donne pas suite.",
        },
        "checklist": {"before_meeting": [], "during_meeting": [], "before_payment": []},
        "available_actions": ["MAKE_OFFER"],
    }
    payload = FakePiloterr().fetch_ad("https://www.leboncoin.fr/ad/1")
    adapted = adapt_legacy_result(
        legacy,
        listing_payload=payload,
        normalized_listing=None,
        device_profile=None,
    )

    report = AnalysisResult.model_validate(adapted)
    assert legacy["schema_version"] == "1.0"
    assert report.schema_version == "2.0"
    assert report.device.category.value == "IPHONE"
    assert report.template_id.value == "NEGOTIATE"


def test_analysis_deletion_is_private_and_s3_retryable(client) -> None:
    from app.main import app

    app.dependency_overrides[piloterr_dependency] = lambda: FakePiloterr()
    app.dependency_overrides[storage_dependency] = lambda: FailingStorage()
    try:
        client.get("/v1/me")
        activate_subscription()
        analysis_id = create_initial(client)
        with session_factory()() as session:
            analysis = session.get(Analysis, analysis_id)
            assert analysis is not None
            session.add(
                Media(
                    user_id=analysis.user_id,
                    analysis_id=analysis.id,
                    object_key=f"private/{analysis.user_id}/{analysis.id}/photo.jpg",
                    content_type="image/jpeg",
                    size_bytes=128,
                    status="ready",
                )
            )
            session.commit()

        deleted = client.delete(f"/v1/analyses/{analysis_id}")
        assert deleted.status_code == 204
        with session_factory()() as session:
            assert session.get(Analysis, analysis_id) is None
            job = session.query(DeletionJob).one()
            assert job.status == "pending"
            assert job.object_keys

        storage = SuccessfulStorage()
        with session_factory()() as session:
            completed, failed = DeletionService(session, storage).retry_pending()
            assert (completed, failed) == (1, 0)
        with session_factory()() as session:
            job = session.query(DeletionJob).one()
            assert job.status == "completed"
            assert job.object_keys == []
            assert job.user_id is None
            assert storage.deleted
    finally:
        app.dependency_overrides.clear()


def test_analysis_resources_are_filtered_by_internal_user(client) -> None:
    client.get("/v1/me")
    with session_factory()() as session:
        owner = User(clerk_user_id="different_clerk_user")
        session.add(owner)
        session.flush()
        foreign = Analysis(
            user_id=owner.id,
            kind=AnalysisKind.INITIAL,
            idempotency_key="foreign-analysis-key",
            request_fingerprint="a" * 64,
            purchase_mode=PurchaseMode.FACE_TO_FACE,
            input_snapshot={"source_url": "https://www.leboncoin.fr/ad/1"},
            seller_context={"media": []},
        )
        session.add(foreign)
        session.commit()
        foreign_id = foreign.id

    response = client.get(f"/v1/analyses/{foreign_id}")
    deletion = client.delete(f"/v1/analyses/{foreign_id}")

    assert response.status_code == 404
    assert deletion.status_code == 404


def test_analysis_media_endpoint_returns_owned_presigned_media(client) -> None:
    from app.main import app

    app.dependency_overrides[storage_dependency] = lambda: PresigningStorage()
    try:
        assert client.get("/v1/me").status_code == 200
        with session_factory()() as session:
            user = (
                session.query(User).filter_by(clerk_user_id="user_local_dealup").one()
            )
            analysis = Analysis(
                user_id=user.id,
                kind=AnalysisKind.INITIAL,
                status=AnalysisStatus.COMPLETED,
                idempotency_key="media-endpoint-analysis",
                request_fingerprint="m" * 64,
                purchase_mode=PurchaseMode.FACE_TO_FACE,
                input_snapshot={"source_url": "https://www.leboncoin.fr/ad/42"},
                seller_context={"media": []},
            )
            session.add(analysis)
            session.flush()
            analysis.root_analysis_id = analysis.id
            object_key = f"private/{user.id}/{analysis.id}/listing-0.jpg"
            media = Media(
                user_id=user.id,
                analysis_id=analysis.id,
                object_key=object_key,
                content_type="image/jpeg",
                size_bytes=128,
                role="listing_photo",
                ordinal=0,
                status="ready",
            )
            session.add(media)
            session.commit()
            analysis_id = analysis.id
            media_id = media.id

        response = client.get(f"/v1/analyses/{analysis_id}/media")

        assert response.status_code == 200, response.text
        assert response.json() == {
            "items": [
                {
                    "id": media_id,
                    "role": "listing_photo",
                    "ordinal": 0,
                    "content_type": "image/jpeg",
                    "url": f"https://media.example.test/{object_key}",
                }
            ]
        }
        assert response.json()["items"][0]["url"].startswith(
            "https://media.example.test/private/"
        )
    finally:
        app.dependency_overrides.clear()


def test_analysis_list_returns_a_presigned_thumbnail_url(client) -> None:
    from app.main import app

    app.dependency_overrides[storage_dependency] = lambda: PresigningStorage()
    try:
        assert client.get("/v1/me").status_code == 200
        with session_factory()() as session:
            user = (
                session.query(User).filter_by(clerk_user_id="user_local_dealup").one()
            )
            analysis = Analysis(
                user_id=user.id,
                kind=AnalysisKind.INITIAL,
                status=AnalysisStatus.COMPLETED,
                idempotency_key="analysis-list-thumbnail",
                request_fingerprint="t" * 64,
                purchase_mode=PurchaseMode.FACE_TO_FACE,
                input_snapshot={"source_url": "https://www.leboncoin.fr/ad/42"},
                seller_context={"media": []},
            )
            session.add(analysis)
            session.flush()
            analysis.root_analysis_id = analysis.id
            object_key = f"private/{user.id}/{analysis.id}/listing-0.jpg"
            media = Media(
                user_id=user.id,
                analysis_id=analysis.id,
                object_key=object_key,
                content_type="image/jpeg",
                size_bytes=128,
                role="listing_photo",
                ordinal=0,
                status="ready",
            )
            session.add(media)
            session.flush()
            report = adapt_legacy_result(
                {
                    "schema_version": "1.0",
                    "verdict": {
                        "type": "VERIFY_FIRST",
                        "deal_score": 62,
                        "confidence": "MEDIUM",
                        "headline": "Quelques preuves restent à demander",
                        "explanation": "L’annonce mérite une vérification.",
                    },
                    "primary_action": {
                        "type": "REQUEST_PROOFS",
                        "label": "Demander les preuves",
                        "reason": "Les preuves sont incomplètes.",
                    },
                    "pricing": {},
                    "risks": {"level": "MEDIUM", "items": []},
                    "messages": {},
                    "checklist": {},
                    "available_actions": ["REQUEST_PROOFS"],
                },
                listing_payload=FakePiloterr().fetch_ad(
                    "https://www.leboncoin.fr/ad/42"
                ),
                normalized_listing=None,
                device_profile=None,
            )
            assert report is not None
            report["listing"]["thumbnail_media_id"] = media.id
            analysis.result = report
            session.commit()
            media_id = media.id

        response = client.get("/v1/analyses?limit=50")

        assert response.status_code == 200, response.text
        listing = response.json()["items"][0]["listing"]
        assert listing["thumbnail_media_id"] == media_id
        assert listing["thumbnail_url"] == f"https://media.example.test/{object_key}"
    finally:
        app.dependency_overrides.clear()
