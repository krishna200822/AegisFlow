from fastapi.testclient import TestClient

from app.core.config import settings
from app.main import app


def test_end_to_end_sandbox_recovery_and_analytics(monkeypatch):
    monkeypatch.setattr(settings, "gemini_api_key", "")
    with TestClient(app) as client:
        workflow_response = client.post(
            "/api/v1/workflows",
            json={
                "name": "Integration test workflow",
                "description": "Workflow created by the API integration test.",
                "integration": "Local sandbox",
                "steps": [{"id": "validate", "name": "Validate", "description": "Check data"}],
                "inputSchema": {},
                "outputSchema": {},
                "retryPolicy": {"maxAttempts": 1, "backoff": "fixed", "idempotent": True},
            },
        )
        assert workflow_response.status_code == 200
        workflow_id = workflow_response.json()["id"]

        execution = client.post(f"/api/v1/workflows/{workflow_id}/execute", json={})
        assert execution.status_code == 200
        assert execution.json()["mode"] == "simulation"
        assert client.get(f"/api/v1/workflows/{workflow_id}/executions").json()["total"] == 1

        simulated = client.post(
            "/api/v1/simulate/failure",
            json={"type": "missing_field", "workflowId": "wf-cds-01"},
        )
        assert simulated.status_code == 200
        incident = simulated.json()["incident"]
        original_payload = incident["payload"].copy()
        incident_id = incident["id"]

        diagnosis = client.post(f"/api/v1/incidents/{incident_id}/analyze", json={})
        assert diagnosis.status_code == 200
        assert diagnosis.json()["source"] in ("gemini", "simulated")

        proposal = client.post(f"/api/v1/incidents/{incident_id}/repairs", json={})
        assert proposal.status_code == 200
        repair = proposal.json()
        repair_id = repair["id"]
        assert repair["requiresApproval"] is True
        assert repair["originalPayload"] == original_payload

        validation = client.post(f"/api/v1/repairs/{repair_id}/validate", json={})
        assert validation.status_code == 200
        assert validation.json()["status"] == "validated"
        assert client.post(f"/api/v1/repairs/{repair_id}/apply", json={}).status_code == 403

        approval = client.post(f"/api/v1/repairs/{repair_id}/approve", json={})
        assert approval.status_code == 200
        assert approval.json()["approved"] is True
        assert client.post(f"/api/v1/repairs/{repair_id}/validate", json={}).json()["eligible"] is True
        replay = client.post(f"/api/v1/repairs/{repair_id}/apply", json={})
        assert replay.status_code == 200
        assert replay.json()["ok"] is True
        assert "no external system was changed" in replay.json()["detail"]

        assert client.get(f"/api/v1/incidents/{incident_id}").json()["status"] == "resolved"
        assert client.get("/api/v1/logs", params={"incidentId": incident_id}).json()["total"] > 0
        assert client.get("/api/v1/repairs").json()["total"] == 1
        assert client.get("/api/v1/analytics/metrics").json()["successfulRecoveries"] >= 1
        assert client.get("/api/v1/analytics/clusters").json()["total"] >= 1
        postmortem = client.post(f"/api/v1/analytics/postmortems/{incident_id}")
        assert postmortem.status_code == 200
        assert postmortem.json()["incidentId"] == incident_id


def test_settings_are_persisted_model_is_fixed_and_cors_allows_frontend():
    with TestClient(app) as client:
        updated = client.patch("/api/v1/settings", json={"pollingIntervalSec": 45})
        assert updated.status_code == 200
        assert updated.json()["pollingIntervalSec"] == 45
        assert updated.json()["model"] == settings.gemini_model
        assert "gemini_api_key" not in updated.json()
        assert client.get("/api/v1/settings").json()["pollingIntervalSec"] == 45

        response = client.options(
            "/api/v1/workflows",
            headers={
                "Origin": "http://localhost:5173",
                "Access-Control-Request-Method": "POST",
            },
        )
        assert response.status_code == 200
        assert response.headers["access-control-allow-origin"] == "http://localhost:5173"


def test_model_status_reports_backend_only_verification(monkeypatch):
    from app.api.v1 import settings as settings_routes

    monkeypatch.setattr(settings_routes, "check_model_support", lambda: None)
    with TestClient(app) as client:
        status = client.get("/api/v1/settings/model-status")
        assert status.status_code == 200
        assert status.json()["model"] == settings.gemini_model
        assert status.json()["supported"] is True
        assert "api_key" not in status.json()


def test_incident_review_resolution_rejection_and_log_ingestion(monkeypatch):
    monkeypatch.setattr(settings, "gemini_api_key", "")
    with TestClient(app) as client:
        simulated = client.post(
            "/api/v1/simulate/failure",
            json={"type": "timeout", "workflowId": "wf-cds-01"},
        )
        incident_id = simulated.json()["incident"]["id"]
        escalation = client.post(f"/api/v1/incidents/{incident_id}/review")
        assert escalation.status_code == 200
        assert escalation.json()["owner"] == "On-call · platform team"
        resolved = client.post(f"/api/v1/incidents/{incident_id}/resolve")
        assert resolved.status_code == 200
        assert resolved.json()["status"] == "resolved"

        rejected_incident = client.post(
            "/api/v1/simulate/failure",
            json={"type": "missing_field", "workflowId": "wf-cds-01"},
        ).json()["incident"]
        proposal = client.post(
            f"/api/v1/incidents/{rejected_incident['id']}/repairs",
            json={},
        ).json()
        rejection = client.post(f"/api/v1/repairs/{proposal['id']}/reject")
        assert rejection.status_code == 200
        assert client.get(f"/api/v1/repairs/{proposal['id']}").json()["status"] == "rejected"

        logged = client.post(
            "/api/v1/logs",
            json={
                "level": "INFO",
                "workflowId": "wf-cds-01",
                "executionId": "test-execution",
                "event": "integration.test",
                "message": "Test log persisted.",
                "metadata": {"source": "automated-test"},
            },
        )
        assert logged.status_code == 200
        assert logged.json()["stored"] is True
        assert client.get("/api/v1/logs", params={"q": "Test log persisted"}).json()["total"] >= 1


def test_reset_demo_clears_sandbox_records():
    with TestClient(app) as client:
        client.post(
            "/api/v1/simulate/failure",
            json={"type": "timeout", "workflowId": "wf-cds-01"},
        )
        response = client.post("/api/v1/settings/reset-demo")
        assert response.status_code == 200
        assert client.get("/api/v1/incidents").json()["total"] == 0
        assert client.get("/api/v1/logs").json()["total"] == 0
        assert client.get("/api/v1/analytics/executions").json()["total"] == 0
