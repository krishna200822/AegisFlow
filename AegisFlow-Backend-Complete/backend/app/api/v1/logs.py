from fastapi import APIRouter, HTTPException
from app.services.log_collector import query_logs, record_log
from app.core.security import check_json_depth
router=APIRouter(prefix='/logs',tags=['logs'])
@router.get('')
def list_logs(q: str | None=None, level: str | None=None, workflowId: str | None=None, incidentId: str | None=None, limit: int=100):
    items=query_logs(q,level,workflowId,incidentId,limit); return {'items':items,'total':len(items),'query':q,'level':level,'limit':max(1,min(limit,500))}
@router.post('')
def ingest_log(payload: dict):
    if not check_json_depth(payload): raise HTTPException(413,'JSON nesting exceeds supported depth')
    if not payload.get('message') or not payload.get('event'): raise HTTPException(422,'event and message are required')
    item=record_log(level=payload.get('level','INFO'),workflow_id=str(payload.get('workflowId','external')),execution_id=str(payload.get('executionId','external')),incident_id=payload.get('incidentId'),event=str(payload['event'])[:160],message=str(payload['message'])[:4000],metadata=payload.get('metadata') if isinstance(payload.get('metadata'),dict) else {})
    return {'accepted':True,'stored':True,'item':item}
