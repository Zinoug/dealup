from handler import handler


def test_handler_rejects_missing_analysis_id() -> None:
    assert handler({}, None) == {"status": "invalid_event"}
