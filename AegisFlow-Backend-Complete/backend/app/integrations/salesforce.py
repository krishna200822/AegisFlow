"""Read-only Salesforce Lead reporting using the OAuth client-credentials flow."""
from __future__ import annotations

import re
from typing import Any
from urllib.parse import urlsplit

import httpx

from app.core.config import settings

MAX_LEADS_PER_REPORT = 100


class SalesforceNotConfigured(RuntimeError):
    pass


class SalesforceConnectionError(RuntimeError):
    pass


def is_configured() -> bool:
    return bool(settings.salesforce_client_id and settings.salesforce_client_secret.get_secret_value())


def _validate_salesforce_url(url: str, *, instance: bool = False) -> str:
    parsed = urlsplit(url)
    hostname = (parsed.hostname or "").lower()
    allowed = hostname.endswith((".salesforce.com", ".salesforce.mil"))
    if not (
        parsed.scheme == "https"
        and allowed
        and parsed.username is None
        and parsed.password is None
        and parsed.query == ""
        and parsed.fragment == ""
        and (parsed.port is None or parsed.port == 443)
        and (instance or parsed.path in ("", "/"))
    ):
        raise SalesforceConnectionError("Salesforce returned an invalid service URL.")
    return f"https://{hostname}"


def _http_client() -> httpx.Client:
    return httpx.Client(timeout=httpx.Timeout(10.0, connect=5.0))


def _response_json(response: httpx.Response, message: str) -> dict[str, Any]:
    if not 200 <= response.status_code < 300:
        raise SalesforceConnectionError(message)
    try:
        value = response.json()
    except ValueError as exc:
        raise SalesforceConnectionError(message) from exc
    if not isinstance(value, dict):
        raise SalesforceConnectionError(message)
    return value


def _priority(record: dict[str, Any]) -> tuple[int, str, list[str]]:
    rating = str(record.get("Rating") or "").strip().lower()
    status = str(record.get("Status") or "").strip().lower()
    score = {"hot": 40, "warm": 25, "cold": 10}.get(rating, 0)
    reasons: list[str] = []
    if rating in {"hot", "warm", "cold"}:
        reasons.append(f"Salesforce rating is {rating.title()}.")
    if status == "open":
        score += 20
        reasons.append("Lead status is Open.")
    elif status == "working":
        score += 10
        reasons.append("Lead status is Working.")
    priority = "high" if score >= 40 else "medium" if score >= 20 else "low"
    if not reasons:
        reasons.append("No high-priority rating or active status signal was available.")
    return score, priority, reasons


def build_lead_report(limit: int = 20) -> dict[str, Any]:
    if not is_configured():
        raise SalesforceNotConfigured("Salesforce read-only access is not configured in the backend.")
    if not 1 <= limit <= MAX_LEADS_PER_REPORT:
        raise ValueError(f"limit must be between 1 and {MAX_LEADS_PER_REPORT}.")
    if not re.fullmatch(r"v\d{1,2}\.\d", settings.salesforce_api_version):
        raise SalesforceConnectionError("Salesforce API version configuration is invalid.")

    login_url = _validate_salesforce_url(settings.salesforce_login_url)
    token_url = f"{login_url}/services/oauth2/token"
    client_secret = settings.salesforce_client_secret.get_secret_value()
    soql = (
        "SELECT Name, Company, Status, Rating FROM Lead "
        f"WHERE IsConverted = false ORDER BY CreatedDate DESC LIMIT {limit}"
    )

    try:
        with _http_client() as client:
            token_response = client.post(
                token_url,
                data={
                    "grant_type": "client_credentials",
                    "client_id": settings.salesforce_client_id,
                    "client_secret": client_secret,
                },
            )
            token = _response_json(
                token_response,
                "Salesforce authentication failed. Verify the backend Connected App configuration.",
            )
            access_token = token.get("access_token")
            instance_url = token.get("instance_url")
            if not isinstance(access_token, str) or not access_token or not isinstance(instance_url, str):
                raise SalesforceConnectionError(
                    "Salesforce authentication response was incomplete. Check the backend Connected App configuration."
                )
            api_origin = _validate_salesforce_url(instance_url, instance=True)
            query_response = client.get(
                f"{api_origin}/services/data/{settings.salesforce_api_version}/query",
                params={"q": soql},
                headers={"Authorization": f"Bearer {access_token}"},
            )
            result = _response_json(
                query_response,
                "Salesforce Lead query failed. Check the connected user’s API and Lead field permissions.",
            )
    except httpx.RequestError as exc:
        raise SalesforceConnectionError(
            "Could not reach Salesforce. Check backend network access and Salesforce configuration."
        ) from exc

    records = result.get("records")
    if not isinstance(records, list):
        raise SalesforceConnectionError("Salesforce returned an unexpected Lead query response.")

    leads: list[dict[str, Any]] = []
    validation_issues: list[dict[str, Any]] = []
    for index, record in enumerate(records[:limit], start=1):
        if not isinstance(record, dict):
            validation_issues.append({"recordNumber": index, "missingFields": ["record"]})
            continue
        missing = [
            field
            for field in ("Name", "Company", "Status")
            if not isinstance(record.get(field), str) or not record[field].strip()
        ]
        if missing:
            validation_issues.append({"recordNumber": index, "missingFields": missing})
            continue
        score, priority, reasons = _priority(record)
        rating = record.get("Rating")
        leads.append(
            {
                "name": record["Name"].strip(),
                "company": record["Company"].strip(),
                "status": record["Status"].strip(),
                "rating": rating.strip() if isinstance(rating, str) and rating.strip() else "Unrated",
                "score": score,
                "priority": priority,
                "reasons": reasons,
            }
        )
    leads.sort(key=lambda lead: (-lead["score"], lead["name"].casefold()))
    return {
        "source": "salesforce",
        "mode": "live-read-only",
        "recordsRead": len(records[:limit]),
        "validCount": len(leads),
        "needsReview": len(validation_issues),
        "leads": leads,
        "validationIssues": validation_issues,
        "persisted": False,
        "writeActionsEnabled": False,
    }
