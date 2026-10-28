import hashlib
import hmac
import json
import time

from fastapi.testclient import TestClient

from app.core.config import settings
from app.core.storage import all_docs
from app.main import app

WEBHOOK_SECRET = "whsec_test_aegisflow_secret"


def signed_headers(payload: bytes, secret: str = WEBHOOK_SECRET) -> dict[str, str]:
    timestamp = int(time.time())
    signed_payload = f"{timestamp}.".encode() + payload
    signature = hmac.new(secret.encode(), signed_payload, hashlib.sha256).hexdigest()
    return {
        "Stripe-Signature": f"t={timestamp},v1={signature}",
        "Content-Type": "application/json",
    }


def event_payload(event_id="evt_test_payment_failed", event_type="payment_intent.payment_failed", *, live=False):
    return json.dumps(
        {
            "id": event_id,
            "type": event_type,
            "livemode": live,
            "created": int(time.time()),
            "data": {
                "object": {
                    "id": "pi_test_aegisflow",
                    "object": "payment_intent",
                    "amount": 2500,
                    "currency": "usd",
                    "last_payment_error": {
                        "code": "card_declined",
                        "message": "The test card was declined.",
                    },
                }
            },
        },
        separators=(",", ":"),
    ).encode()


def test_webhook_verifies_signature_and_creates_one_incident_for_repeated_event(monkeypatch):
    monkeypatch.setattr(settings, "stripe_webhook_secret", WEBHOOK_SECRET)
    with TestClient(app) as client:
        body = event_payload()
        headers = signed_headers(body)

        rejected = client.post("/api/v1/stripe/webhook", content=body, headers={"Stripe-Signature": "t=1,v1=invalid"})
        assert rejected.status_code == 400

        first = client.post("/api/v1/stripe/webhook", content=body, headers=headers)
        assert first.status_code == 200
        assert first.json()["duplicate"] is False
        incident_id = first.json()["incidentId"]
        incident = client.get(f"/api/v1/incidents/{incident_id}").json()
        assert incident["failureType"] == "payment_failed"
        assert incident["payload"]["stripeEventId"] == "evt_test_payment_failed"
        assert incident["payload"]["paymentIntentId"] == "pi_test_aegisflow"
        assert "card_declined" in incident["errorMessage"]
        assert "test card" not in incident["errorMessage"]
        assert client.post(f"/api/v1/incidents/{incident_id}/repairs", json={}).status_code == 409

        second = client.post("/api/v1/stripe/webhook", content=body, headers=headers)
        assert second.status_code == 200
        assert second.json()["duplicate"] is True
        assert second.json()["incidentId"] == incident_id
        assert len([item for item in all_docs("incidents") if item.get("payload", {}).get("stripeEventId") == "evt_test_payment_failed"]) == 1
        assert client.get("/api/v1/stripe/events").json()["total"] == 1


def test_success_event_is_recorded_without_creating_incident(monkeypatch):
    monkeypatch.setattr(settings, "stripe_webhook_secret", WEBHOOK_SECRET)
    with TestClient(app) as client:
        body = event_payload("evt_test_payment_succeeded", "payment_intent.succeeded")
        response = client.post(
            "/api/v1/stripe/webhook",
            content=body,
            headers=signed_headers(body),
        )
        assert response.status_code == 200
        assert response.json()["event"]["status"] == "processed"
        assert response.json()["incidentId"] is None
        assert client.get("/api/v1/incidents").json()["total"] == 0


def test_invalid_payloads_and_live_mode_events_are_rejected(monkeypatch):
    monkeypatch.setattr(settings, "stripe_webhook_secret", WEBHOOK_SECRET)
    with TestClient(app) as client:
        malformed = b'{"id":'
        response = client.post(
            "/api/v1/stripe/webhook",
            content=malformed,
            headers=signed_headers(malformed),
        )
        assert response.status_code == 400

        live_event = event_payload("evt_live_disallowed", live=True)
        response = client.post(
            "/api/v1/stripe/webhook",
            content=live_event,
            headers=signed_headers(live_event),
        )
        assert response.status_code == 403
        assert client.get("/api/v1/stripe/events").json()["total"] == 0

        invalid_simulation = client.post(
            "/api/v1/stripe/simulate/failure",
            json={"paymentIntentId": "not-a-payment-intent", "amount": -1},
        )
        assert invalid_simulation.status_code == 422


def test_simulated_failure_needs_no_stripe_credentials_and_deduplicates(monkeypatch):
    monkeypatch.setattr(settings, "stripe_webhook_secret", "")
    with TestClient(app) as client:
        body = {
            "eventId": "evt_sim_repeat",
            "paymentIntentId": "pi_test_simulated",
            "amount": 4200,
            "currency": "usd",
            "failureCode": "card_declined",
        }
        first = client.post("/api/v1/stripe/simulate/failure", json=body)
        second = client.post("/api/v1/stripe/simulate/failure", json=body)
        assert first.status_code == 200
        assert first.json()["mode"] == "simulation"
        assert first.json()["duplicate"] is False
        assert second.status_code == 200
        assert second.json()["duplicate"] is True
        assert client.get("/api/v1/incidents").json()["total"] == 1
        status = client.get("/api/v1/stripe/status").json()
        assert status["mode"] == "test"
        assert status["simulationAvailable"] is True
        assert status["financialActionsEnabled"] is False


def test_webhook_returns_service_unavailable_when_signing_secret_is_unset(monkeypatch):
    monkeypatch.setattr(settings, "stripe_webhook_secret", "")
    with TestClient(app) as client:
        response = client.post("/api/v1/stripe/webhook", content=b"{}")
        assert response.status_code == 503
