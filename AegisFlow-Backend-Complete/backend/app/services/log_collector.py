from datetime import datetime, timezone
from uuid import uuid4
from typing import Any
from app.core.storage import put, all_docs

VALID_LEVELS = {"INFO", "WARN", "ERROR", "DEBUG"}

def record_log(*, level: str, workflow_id: str, execution_id: str, event: str, message: str, metadata: dict[str, Any] | None = None, incident_id: str | None = None) -> dict[str, Any]:
    lvl = level.upper()
    if lvl not in VALID_LEVELS: lvl = "INFO"
    item = {"id": f"log-{uuid4().hex[:12]}", "timestamp": datetime.now(timezone.utc).isoformat(), "level": lvl, "workflowId": workflow_id, "executionId": execution_id, "incidentId": incident_id, "event": event, "message": message, "metadata": metadata or {}}
    put('logs', item['id'], item)
    return item

def query_logs(q: str | None = None, level: str | None = None, workflow_id: str | None = None, incident_id: str | None = None, limit: int = 100):
    items = all_docs('logs')
    if q:
        needle=q.lower(); items=[x for x in items if needle in (x.get('message','')+' '+x.get('event','')+' '+x.get('executionId','')).lower()]
    if level and level.lower() != 'all': items=[x for x in items if x.get('level') == level.upper()]
    if workflow_id and workflow_id != 'all': items=[x for x in items if x.get('workflowId') == workflow_id]
    if incident_id: items=[x for x in items if x.get('incidentId') == incident_id]
    items.sort(key=lambda x:x.get('timestamp',''), reverse=True)
    return items[:max(1,min(limit,500))]
