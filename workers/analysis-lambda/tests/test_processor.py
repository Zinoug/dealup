from types import SimpleNamespace

from analysis_worker.integrations.gemini import GeminiAnalysis, GeminiError
from analysis_worker.repositories import AnalysisJob
from analysis_worker.services import AnalysisProcessor
from tests.factories import candidate_payload, device_profile, normalized_listing


class FakeRepository:
    def __init__(self, job=None) -> None:
        self.job = job
        self.completed = None
        self.failed = None
        self.media = []

    def reserve(self, analysis_id):
        return self.job

    def complete(self, *args):
        self.completed = args

    def fail(self, *args):
        self.failed = args

    def record_listing_media(self, **kwargs):
        self.media.append(kwargs)


class FakeAnalytics:
    def capture(self, *args, **kwargs):
        pass


class FakeStorage:
    def build_inputs(self, media, limit):
        return []

    def archive_listing_images(self, **kwargs):
        return []


class FakeGemini:
    def __init__(self) -> None:
        self.calls = 0
        self.last_kwargs = None

    def analyze(self, **kwargs):
        self.calls += 1
        self.last_kwargs = kwargs
        return GeminiAnalysis(
            candidate=candidate_payload(), metadata={"input_tokens": 120}
        )


def settings():
    return SimpleNamespace(
        max_private_images=10,
        max_listing_images=10,
        max_listing_image_bytes=10_000_000,
        gemini_model="founder-selected-model",
        gemini_thinking_level="low",
        gemini_store_interactions=False,
        piloterr_eur_per_request=None,
        provider_pricing_version="test",
        app_env="local",
    )


def test_duplicate_delivery_is_ignored() -> None:
    repository = FakeRepository()
    processor = AnalysisProcessor(
        settings=settings(),
        repository=repository,
        piloterr=SimpleNamespace(),
        gemini=FakeGemini(),
        storage=FakeStorage(),
        analytics=FakeAnalytics(),
    )

    assert processor.process("analysis-1") == {
        "status": "ignored",
        "analysis_id": "analysis-1",
    }


def test_successful_analysis_uses_one_gemini_call_and_persists_both_results() -> None:
    job = AnalysisJob(
        id="analysis-1",
        user_id="user-1",
        kind="initial",
        purchase_mode="face_to_face",
        input_snapshot={
            "source_url": "https://www.leboncoin.fr/ad/telephones_objets_connectes/1",
            "listing_payload": {"subject": "iPhone 15 Pro", "images": {"urls": []}},
            "normalized_listing": normalized_listing(),
            "device_profile": device_profile(),
        },
        seller_context={"already_contacted": False, "media": []},
        device_category="IPHONE",
        parent_result=None,
        model_id=None,
        engine_revision="test-engine",
    )
    repository = FakeRepository(job)
    gemini = FakeGemini()
    processor = AnalysisProcessor(
        settings=settings(),
        repository=repository,
        piloterr=SimpleNamespace(),
        gemini=gemini,
        storage=FakeStorage(),
        analytics=FakeAnalytics(),
    )

    assert processor.process("analysis-1")["status"] == "completed"
    assert gemini.calls == 1
    assert repository.completed is not None
    candidate, report = repository.completed[1], repository.completed[2]
    assert candidate["headline"]
    assert report["schema_version"] == "2.0"
    assert report["template_id"] == "NEGOTIATE"
    assert "prompt_version" not in gemini.last_kwargs
    assert repository.failed is None


def test_gemini_connection_failure_keeps_specific_code() -> None:
    class FailingGemini:
        def analyze(self, **kwargs):
            raise GeminiError(
                "Gemini connection was interrupted",
                "APIConnectionError: connection reset by peer",
                code="GEMINI_CONNECTION_FAILED",
            )

    job = AnalysisJob(
        id="analysis-1",
        user_id="user-1",
        kind="initial",
        purchase_mode="face_to_face",
        input_snapshot={
            "source_url": "https://www.leboncoin.fr/ad/telephones_objets_connectes/1",
            "listing_payload": {"subject": "iPhone 15 Pro", "images": {"urls": []}},
            "normalized_listing": normalized_listing(),
            "device_profile": device_profile(),
        },
        seller_context={"already_contacted": False, "media": []},
        device_category="IPHONE",
        parent_result=None,
        model_id=None,
        engine_revision="test-engine",
    )
    repository = FakeRepository(job)
    processor = AnalysisProcessor(
        settings=settings(),
        repository=repository,
        piloterr=SimpleNamespace(),
        gemini=FailingGemini(),
        storage=FakeStorage(),
        analytics=FakeAnalytics(),
    )

    result = processor.process("analysis-1")

    assert result["status"] == "failed"
    assert result["error_code"] == "GEMINI_CONNECTION_FAILED"
    assert repository.failed[:3] == (
        "analysis-1",
        "GEMINI_CONNECTION_FAILED",
        "La connexion au service d’analyse a été interrompue.",
    )
    failure_metadata = repository.failed[3]
    assert failure_metadata["failure"] == {
        "code": "GEMINI_CONNECTION_FAILED",
        "stage": "gemini",
    }
    assert failure_metadata["gemini_duration_ms"] >= 0
