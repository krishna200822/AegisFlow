import ipaddress

from fastapi import APIRouter, HTTPException, Request
from pydantic import BaseModel, ConfigDict, Field

from app.core.config import settings
from app.integrations.salesforce import (
    MAX_LEADS_PER_REPORT,
    SalesforceConnectionError,
    SalesforceNotConfigured,
    build_lead_report,
    is_configured,
)

router = APIRouter(prefix="/salesforce", tags=["salesforce-read-only"])


class LeadReportRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")
    limit: int = Field(default=20, ge=1, le=MAX_LEADS_PER_REPORT)


def _require_local_request(request: Request) -> None:
    if settings.environment.lower() not in {"development", "local", "local-sandbox"}:
        raise HTTPException(
            status_code=403,
            detail="Live Salesforce reporting is restricted to local development.",
        )
    host = request.client.host if request.client else ""
    try:
        is_loopback = ipaddress.ip_address(host).is_loopback
    except ValueError:
        is_loopback = False
    if not is_loopback:
        raise HTTPException(
            status_code=403,
            detail="Live Salesforce reporting is available only through a local connection.",
        )


@router.get("/status")
def salesforce_status(request: Request):
    _require_local_request(request)
    return {
        "configured": is_configured(),
        "mode": "live-read-only",
        "maxRecordsPerReport": MAX_LEADS_PER_REPORT,
        "persisted": False,
        "writeActionsEnabled": False,
        "detail": (
            "Salesforce Lead reporting is configured."
            if is_configured()
            else "Set Salesforce OAuth credentials in the backend environment to enable reporting."
        ),
    }


@router.post("/leads/report")
def salesforce_lead_report(payload: LeadReportRequest, request: Request):
    _require_local_request(request)
    try:
        return build_lead_report(payload.limit)
    except SalesforceNotConfigured as exc:
        raise HTTPException(status_code=503, detail=str(exc)) from exc
    except SalesforceConnectionError as exc:
        raise HTTPException(status_code=502, detail=str(exc)) from exc
