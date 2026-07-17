def test_health(client) -> None:
    response = client.get("/health")

    assert response.status_code == 200
    assert response.json() == {"status": "ok"}


def test_ready(client) -> None:
    response = client.get("/ready")

    assert response.status_code == 200
    assert response.json() == {"status": "ready"}


def test_openapi_contract_is_generated(client) -> None:
    response = client.get("/openapi.json")

    assert response.status_code == 200
    paths = response.json()["paths"]
    assert "/v1/catalog/compatible-devices" in paths
    assert "/v1/analyses" in paths
    assert "delete" in paths["/v1/analyses/{analysis_id}"]
    assert "/v1/analyses/{analysis_id}/reanalyze" in paths
    assert "/v1/uploads/{media_id}/complete" in paths
