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


def test_reanalysis_pins_parent_versions_while_refresh_uses_current(client) -> None:
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
            parent.prompt_version = "1.9"
            parent.taxonomy_version = "0.9"
            parent.scoring_version = "0.9"
            parent.checklist_version = "0.9"
            parent.device_catalog_version = "0.9"
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
            assert child.prompt_version == "1.9"
            assert child.taxonomy_version == "0.9"
            assert child.model_id == "founder-manual-model"
            assert child.root_analysis_id == parent_id
            active = get_analysis_contract().versions()
            assert refreshed.kind == AnalysisKind.REFRESH
            assert refreshed.prompt_version == active["prompt_version"]
            assert refreshed.taxonomy_version == active["taxonomy_version"]
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
            source_url="https://www.leboncoin.fr/ad/1",
            purchase_mode=PurchaseMode.FACE_TO_FACE,
            seller_media=[],
            prompt_version="2.0",
            schema_version="2.0",
        )
        session.add(foreign)
        session.commit()
        foreign_id = foreign.id

    response = client.get(f"/v1/analyses/{foreign_id}")
    deletion = client.delete(f"/v1/analyses/{foreign_id}")

    assert response.status_code == 404
    assert deletion.status_code == 404
