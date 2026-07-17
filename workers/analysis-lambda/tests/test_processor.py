from types import SimpleNamespace

from analysis_worker.integrations.gemini import GeminiAnalysis
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

    def push_tokens(self, user_id):
        return []

    def record_listing_media(self, **kwargs):
        self.media.append(kwargs)


class FakeAnalytics:
    def capture(self, *args, **kwargs):
        pass


class FakePush:
    def send_analysis_ready(self, *args, **kwargs):
        pass


class FakeStorage:
    def build_inputs(self, media, limit):
        return []

    def archive_listing_images(self, **kwargs):
        return []


class FakeGemini:
    def __init__(self) -> None:
        self.calls = 0

    def analyze(self, **kwargs):
        self.calls += 1
        return GeminiAnalysis(
            candidate=candidate_payload(), metadata={"input_tokens": 120}
        )


def settings():
    return SimpleNamespace(
        max_private_images=10,
        max_listing_images=10,
        max_listing_image_bytes=10_000_000,
        gemini_model="founder-selected-model",
        gemini_temperature=0.2,
        gemini_thinking_level="medium",
        gemini_store_interactions=False,
        push_after_seconds=999,
        piloterr_eur_per_request=None,
        provider_pricing_version="test",
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
        push=FakePush(),
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
        source_url="https://www.leboncoin.fr/ad/telephones_objets_connectes/1",
        purchase_mode="face_to_face",
        seller_reply_text=None,
        seller_media=[],
        listing_payload={"subject": "iPhone 15 Pro", "images": {"urls": []}},
        normalized_listing=normalized_listing(),
        device_category="IPHONE",
        device_profile=device_profile(),
        parent_result=None,
        model_id=None,
        prompt_version="2.0",
        schema_version="2.0",
        taxonomy_version="1.0",
        scoring_version="1.0",
        checklist_version="1.0",
        device_catalog_version="1.0",
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
        push=FakePush(),
    )

    assert processor.process("analysis-1")["status"] == "completed"
    assert gemini.calls == 1
    assert repository.completed is not None
    candidate, report = repository.completed[1], repository.completed[2]
    assert candidate["schema_version"] == "2.0"
    assert report["schema_version"] == "2.0"
    assert report["template_id"] == "NEGOTIATE"
    assert repository.failed is None
