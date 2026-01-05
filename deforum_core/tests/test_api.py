from fastapi.testclient import TestClient

from deforum_core.api.app import create_app


def test_health():
    app = create_app()
    c = TestClient(app)
    r = c.get("/health")
    assert r.status_code == 200
    assert r.json()["status"] == "ok"
