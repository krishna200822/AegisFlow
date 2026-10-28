"""Safety helpers: request bounds and conservative execution policy."""
from typing import Any

MAX_NESTING = 12

def check_json_depth(value: Any, depth: int = 0) -> bool:
    if depth > MAX_NESTING:
        return False
    if isinstance(value, dict):
        return all(check_json_depth(v, depth + 1) for v in value.values())
    if isinstance(value, list):
        return all(check_json_depth(v, depth + 1) for v in value)
    return True

def needs_human_approval(incident: dict, workflow: dict, risk_score: int) -> bool:
    return incident.get("severity") == "critical" or risk_score >= 55 or not workflow.get("retryPolicy", {}).get("idempotent", False)
