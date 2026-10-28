"""Signature-verified, test-mode-only Stripe webhook processing."""
from __future__ import annotations

import hashlib
import json
from datetime import datetime, timezone
from typing import Any
from uuid import uuid4

import stripe

from app.core.config import settings
from app.core.storage import all_docs, claim_retryable, put
from app.services.incident_service import create_incident, find_workflow

SUPPORTED_EVENTS = {"payment_intent.payment_failed", "payment_intent.succeeded"}


class StripeWebhookError(ValueError):
    pass


class StripeLiveModeError(ValueError):
    pass


def verify_signature(payload: bytes, signature: str | None) -> dict[str, Any]:
    if not settings.stripe_webhook_secret:
        raise RuntimeError("STRIPE_WEBHOOK_SECRET is not configured in the backend environment.")
    if not signature:
        raise StripeWebhookError("Missing Stripe-Signature header.")
    try:
        stripe.Webhook.construct_event(
            payload,
            signature,
            settings.stripe_webhook_secret,
        )
    except (ValueError, stripe.SignatureVerificationError) as exc:
        raise StripeWebhookError("Invalid Stripe webhook payload or signature.") from exc
    return json.loads(payload)


def _read(value: Any, key: str, default: Any = None) -> Any:
    if isinstance(value, dict):
        return value.get(key, default)
    getter = getattr(value, "get", None)
    return getter(key, default) if getter else default


def _validate_event(event: dict[str, Any]) -> tuple[str, str, dict[str, Any]]:
    event_id = event.get("id")
    event_type = event.get("type")
    if not isinstance(event_id, str) or not event_id.startswith("evt_") or len(event_id) > 255:
        raise StripeWebhookError("Stripe event must contain a valid event ID.")
    if not isinstance(event_type, str) or len(event_type) > 160:
        raise StripeWebhookError("Stripe event must contain a valid event type.")
    if not isinstance(event.get("livemode"), bool):
        raise StripeWebhookError("Stripe event must include a boolean livemode field.")
    if event.get("livemode") is True:
        raise StripeLiveModeError("Live-mode Stripe events are not accepted by this test-mode integration.")
    data = event.get("data")
    payment_intent = _read(data, "object")
    if not isinstance(payment_intent, dict):
        raise StripeWebhookError("Stripe event data.object must be a JSON object.")
    if event_type in SUPPORTED_EVENTS:
        intent_id = payment_intent.get("id")
        if not isinstance(intent_id, str) or not intent_id.startswith("pi_"):
            raise StripeWebhookError("PaymentIntent event must contain a valid payment_intent ID.")
    return event_id, event_type, payment_intent


def _event_record(
    event_id: str,
    event_type: str,
    payment_intent: dict[str, Any],
    *,
    simulated: bool,
) -> dict[str, Any]:
    failure = _read(payment_intent.get("last_payment_error"), "code")
    record: dict[str, Any] = {
        "id": event_id,
        "type": event_type,
        "status": "processing",
        "paymentIntentId": payment_intent.get("id"),
        "livemode": False,
        "simulated": simulated,
        "receivedAt": datetime.now(timezone.utc).isoformat(),
    }
    amount = payment_intent.get("amount")
    if isinstance(amount, int) and not isinstance(amount, bool) and amount >= 0:
        record["amount"] = amount
    currency = payment_intent.get("currency")
    if isinstance(currency, str) and len(currency) == 3:
        record["currency"] = currency.lower()
    if isinstance(failure, str):
        record["failureCode"] = failure[:100]
    return record


def process_event(event: dict[str, Any], *, simulated: bool = False) -> dict[str, Any]:
    event_id, event_type, payment_intent = _validate_event(event)
    record = _event_record(event_id, event_type, payment_intent, simulated=simulated)
    acquired, existing = claim_retryable("stripe_events", event_id, record)
    if not acquired:
        return {
            "accepted": True,
            "duplicate": True,
            "event": existing,
            "incidentId": existing.get("incidentId") if existing else None,
            "detail": "Stripe event was already received; no duplicate incident was created.",
        }

    try:
        if event_type == "payment_intent.payment_failed":
            workflow = find_workflow("wf-pts-07")
            if not workflow:
                raise RuntimeError("Payment reconciliation workflow is not configured.")
            error_message = (
                f"Stripe test-mode PaymentIntent {payment_intent['id']} failed."
                + (f" Failure code: {record['failureCode']}." if record.get("failureCode") else "")
            )
            safe_payload = {
                "provider": "stripe",
                "stripeEventId": event_id,
                "paymentIntentId": payment_intent["id"],
                "amount": record.get("amount"),
                "currency": record.get("currency"),
                "failureCode": record.get("failureCode"),
            }
            incident_id = f"STRIPE-{hashlib.sha256(event_id.encode()).hexdigest()[:20].upper()}"
            incident, _ = create_incident(
                "payment_failed",
                workflow,
                payload=safe_payload,
                error_message=error_message,
                incident_id=incident_id,
            )
            record["incidentId"] = incident["id"]
        record["status"] = "processed" if event_type in SUPPORTED_EVENTS else "ignored"
        record["detail"] = (
            "Test-mode payment failure recorded as an incident."
            if event_type == "payment_intent.payment_failed"
            else "Test-mode payment success event recorded; no financial action was performed."
            if event_type == "payment_intent.succeeded"
            else "Event stored; this event type is not handled by AegisFlow."
        )
        put("stripe_events", event_id, record)
        return {
            "accepted": True,
            "duplicate": False,
            "event": record,
            "incidentId": record.get("incidentId"),
            "detail": record["detail"],
        }
    except Exception:
        record["status"] = "failed"
        record["detail"] = "Event processing failed; Stripe may safely retry delivery."
        put("stripe_events", event_id, record)
        raise


def list_events() -> list[dict[str, Any]]:
    events = all_docs("stripe_events")
    events.sort(key=lambda event: event.get("receivedAt", ""), reverse=True)
    return events


def simulation_event(
    *,
    event_id: str | None,
    payment_intent_id: str,
    amount: int,
    currency: str,
    failure_code: str,
) -> dict[str, Any]:
    return {
        "id": event_id or f"evt_sim_{uuid4().hex}",
        "type": "payment_intent.payment_failed",
        "livemode": False,
        "data": {
            "object": {
                "id": payment_intent_id,
                "amount": amount,
                "currency": currency,
                "last_payment_error": {"code": failure_code},
            }
        },
    }
