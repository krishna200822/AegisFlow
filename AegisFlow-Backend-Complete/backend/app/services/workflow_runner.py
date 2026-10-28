"""Sandbox-only runner. Production connector execution is deliberately not implemented."""
from datetime import datetime, timezone
from uuid import uuid4
from app.core.storage import put
from app.services.log_collector import record_log

def run_sandbox(workflow: dict, payload: dict | None=None, force_failure: bool=False) -> dict:
    eid='exe_'+uuid4().hex[:10]; ok=not force_failure; now=datetime.now(timezone.utc).isoformat()
    execution={'id':eid,'workflowId':workflow['id'],'startedAt':now,'durationMs':250,'outcome':'success' if ok else 'failed','isRetry':False,'failedStep':None if ok else 1}
    put('executions',eid,execution)
    record_log(level='INFO' if ok else 'ERROR',workflow_id=workflow['id'],execution_id=eid,event='execution.completed' if ok else 'execution.failed',message='Sandbox execution completed.' if ok else 'Sandbox execution was instructed to fail.',metadata={'payload':payload or {},'sandbox':True})
    return execution
