from urllib.parse import parse_qs

import httpx
from fastapi.testclient import TestClient
from pydantic import SecretStr

from app.core.config import settings
from app.integrations import salesforce
from app.main import app


def local_client():
    return TestClient(app, client=("127.0.0.1", 12345))


def test_salesforce_status_does_not_expose_credentials(monkeypatch):
    monkeypatch.setattr(settings, "salesforce_client_id", "")
    monkeypatch.setattr(settings, "salesforce_client_secret", SecretStr(""))
    with local_client() as client:
        response = client.get("/api/v1/salesforce/status")

    assert response.status_code == 200
    assert response.json()["configured"] is False
    assert response.json()["writeActionsEnabled"] is False
    assert "secret" not in response.text.lower()


def test_lead_report_uses_scoped_read_only_query_and_does_not_return_unrequested_fields(monkeypatch):
    monkeypatch.setattr(settings, "salesforce_client_id", "client-id-for-test")
    monkeypatch.setattr(settings, "salesforce_client_secret", SecretStr("client-secret-for-test"))
    monkeypatch.setattr(settings, "salesforce_login_url", "https://login.salesforce.com")
    monkeypatch.setattr(settings, "salesforce_api_version", "v62.0")

    requests: list[httpx.Request] = []

    def handle(request: httpx.Request) -> httpx.Response:
        requests.append(request)
        if request.url.path.endswith("/services/oauth2/token"):
            assert b"grant_type=client_credentials" in request.content
            assert b"client-secret-for-test" in request.content
            return httpx.Response(
                200,
                json={
                    "access_token": "temporary-test-token",
                    "instance_url": "https://aegisflow.my.salesforce.com",
                },
            )
        query = parse_qs(request.url.query.decode())["q"][0]
        assert "SELECT Name, Company, Status, Rating FROM Lead" in query
        assert "Id" not in query
        assert "Email" not in query
        assert "LIMIT 2" in query
        assert request.headers["Authorization"] == "Bearer temporary-test-token"
        return httpx.Response(
            200,
            json={
                "records": [
                    {
                        "Id": "00Q-HIGH",
                        "Name": "Lead One",
                        "Company": "Example Co",
                        "Status": "Open",
                        "Rating": "Hot",
                        "Email": "not-returned@example.com",
                    },
                    {
                        "Id": "00Q-INVALID",
                        "Company": "Missing Name Co",
                        "Status": "Open",
                        "Rating": "Warm",
                        "Email": "also-not-returned@example.com",
                    },
                    {
                        "Id": "00Q-LOW",
                        "Name": "Lead Two",
                        "Company": "Other Co",
                        "Status": "New",
                        "Rating": "Cold",
                    },
                ]
            },
        )

    monkeypatch.setattr(
        salesforce,
        "_http_client",
        lambda: httpx.Client(transport=httpx.MockTransport(handle)),
    )
    with local_client() as client:
        response = client.post("/api/v1/salesforce/leads/report", json={"limit": 2})

    assert response.status_code == 200
    report = response.json()
    assert report["mode"] == "live-read-only"
    assert report["recordsRead"] == 2
    assert report["validCount"] == 1
    assert report["needsReview"] == 1
    assert report["leads"][0]["name"] == "Lead One"
    assert report["leads"][0]["score"] == 60
    assert report["leads"][0]["priority"] == "high"
    assert report["validationIssues"] == [{"recordNumber": 2, "missingFields": ["Name"]}]
    assert report["persisted"] is False
    assert report["writeActionsEnabled"] is False
    assert "Email" not in response.text
    assert "not-returned@example.com" not in response.text
    assert requests[0].url.host == "login.salesforce.com"
    assert requests[1].url.host == "aegisflow.my.salesforce.com"


def test_lead_report_rejects_bad_limits_and_non_local_access(monkeypatch):
    monkeypatch.setattr(settings, "salesforce_client_id", "client-id")
    monkeypatch.setattr(settings, "salesforce_client_secret", SecretStr("secret"))
    with local_client() as client:
        too_many = client.post("/api/v1/salesforce/leads/report", json={"limit": 101})
        remote_client = TestClient(app, client=("192.0.2.10", 12345))
        denied = remote_client.get("/api/v1/salesforce/status")

    assert too_many.status_code == 422
    assert denied.status_code == 403


def test_salesforce_credentials_missing_returns_clear_service_error(monkeypatch):
    monkeypatch.setattr(settings, "salesforce_client_id", "")
    monkeypatch.setattr(settings, "salesforce_client_secret", SecretStr(""))
    with local_client() as client:
        response = client.post("/api/v1/salesforce/leads/report", json={})

    assert response.status_code == 503
    assert "not configured" in response.json()["detail"].lower()
