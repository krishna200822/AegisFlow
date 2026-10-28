from fastapi import APIRouter, HTTPException
from uuid import uuid4
from datetime import datetime, timezone
from app.core.seed import get_workflows
from app.core.storage import get, put, all_docs
from app.services.incident_service import find_workflow
from app.services.log_collector import record_log
router=APIRouter(prefix='/workflows',tags=['workflows'])
@router.get('')
def list_workflows():
    items=get_workflows(); return {'items':items,'total':len(items)}
@router.get('/{workflow_id}')
def get_workflow(workflow_id: str):
    wf=find_workflow(workflow_id)
    if not wf: raise HTTPException(404,'Workflow not found')
    return wf
@router.get('/{workflow_id}/executions')
def list_workflow_executions(workflow_id: str):
    wf=find_workflow(workflow_id)
    if not wf: raise HTTPException(404,'Workflow not found')
    items=[x for x in all_docs('executions') if x.get('workflowId')==workflow_id]
    items.sort(key=lambda x:x.get('startedAt',''),reverse=True)
    return {'items':items,'total':len(items)}
@router.post('')
def create_workflow(payload: dict):
    name=str(payload.get('name','')).strip()
    if not name: raise HTTPException(422,'name is required')
    wid='wf-'+uuid4().hex[:8]
    wf={'id':wid,'name':name,'description':payload.get('description','Created through API'),'integration':payload.get('integration','Custom integration'),'status':'healthy','steps':payload.get('steps',[]),'inputSchema':payload.get('inputSchema',{}),'outputSchema':payload.get('outputSchema',{}),'retryPolicy':payload.get('retryPolicy',{'maxAttempts':3,'backoff':'exponential','idempotent':False}),'samplePayload':payload.get('samplePayload',{}),'idField':payload.get('idField','id'),'idAlias':payload.get('idAlias','id'),'numberField':payload.get('numberField','amount')}
    put('workflows',wid,wf); return wf
@router.post('/{workflow_id}/execute')
def execute_workflow(workflow_id: str, payload: dict | None=None):
    wf=find_workflow(workflow_id)
    if not wf: raise HTTPException(404,'Workflow not found')
    p=payload or {}; execution_id='exe_'+uuid4().hex[:10]; now=datetime.now(timezone.utc).isoformat()
    # Deliberately executes a local simulation only. No external connector is invoked.
    outcome='success' if p.get('simulateFailure') is not True else 'failed'
    doc={'id':execution_id,'workflowId':workflow_id,'startedAt':now,'durationMs':int(p.get('durationMs',350)),'outcome':outcome,'isRetry':bool(p.get('isRetry',False)),'failedStep':p.get('failedStep') if outcome=='failed' else None}
    put('executions',execution_id,doc)
    record_log(level='INFO' if outcome=='success' else 'ERROR',workflow_id=workflow_id,execution_id=execution_id,event='execution.completed' if outcome=='success' else 'execution.failed',message='Local workflow simulation completed.' if outcome=='success' else 'Local workflow simulation failed by request.',metadata={'mode':'simulation'})
    return {'executionId':execution_id,'workflowId':workflow_id,'status':'completed' if outcome=='success' else 'failed','mode':'simulation','execution':doc}
