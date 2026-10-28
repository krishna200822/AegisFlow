from fastapi import APIRouter, Header, HTTPException, Request
from pydantic import BaseModel, ConfigDict, Field

from app.core.config import settings
from app.integrations.stripe import (
    StripeLiveModeError,
    StripeWebhookError,
    list_events,
    process_event,
    simulation_event,
    verify_signature,
)

router = APIRouter(prefix="/stripe", tags=["stripe-test-mode"])


class FailureSimulation(BaseModel):
    model_config = ConfigDict(extra="forbid")
    eventId: str | None = Field(default=None, pattern=r"^evt_[A-Za-z0-9_]+$", max_length=255)
    paymentIntentId: str = Field(default="pi_test_aegisflow", pattern=r"^pi_[A-Za-z0-9_]+$", max_length=255)
    amount: int = Field(default=2500, ge=0, le=99_999_999)
    currency: str = Field(default="usd", pattern=r"^[A-Za-z]{3}$")
    failureCode: str = Field(default="card_declined", min_length=1, max_length=100)


@router.post("/webhook")
async def receive_webhook(
    request: Request,
    stripe_signature: str | None = Header(default=None, alias="Stripe-Signature"),
):
    payload = await request.body()
    if len(payload) > settings.max_request_bytes:
        raise HTTPException(status_code=413, detail="Stripe webhook payload exceeds the configured request limit.")
    if not settings.stripe_webhook_secret:
        raise HTTPException(status_code=503, detail="Stripe webhook verification is not configured.")
    try:
        event = verify_signature(payload, stripe_signature)
        return process_event(event)
    except StripeLiveModeError as exc:
        raise HTTPException(status_code=403, detail=str(exc)) from exc
    except StripeWebhookError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc


@router.post("/simulate/failure")
def simulate_payment_failure(payload: FailureSimulation):
    event = simulation_event(
        event_id=payload.eventId,
        payment_intent_id=payload.paymentIntentId,
        amount=payload.amount,
        currency=payload.currency.lower(),
        failure_code=payload.failureCode,
    )
    result = process_event(event, simulated=True)
    return {**result, "mode": "simulation"}


@router.get("/events")
def stripe_events():
    events = list_events()
    return {"items": events, "total": len(events), "mode": "test"}


@router.get("/status")
def stripe_status():
    return {
        "mode": "test",
        "webhookConfigured": bool(settings.stripe_webhook_secret),
        "simulationAvailable": True,
        "financialActionsEnabled": False,
    }
