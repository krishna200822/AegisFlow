from fastapi import APIRouter, HTTPException
from app.core.storage import get, put, all_docs
from app.services.incident_service import find_workflow
from app.ai.diagnostics import diagnose
from app.ai.repair_planner import propose
from app.services.log_collector import record_log
from app.services.incident_service import add_attempt, now
router=APIRouter(prefix='/incidents',tags=['incidents'])
@router.get('')
def list_incidents(q: str | None=None, status: str | None=None, severity: str | None=None, limit: int=200):
    items=all_docs('incidents')
    if status: items=[x for x in items if x.get('status')==status]
    if severity: items=[x for x in items if x.get('severity')==severity]
    if q: items=[x for x in items if q.lower() in str(x).lower()]
    items.sort(key=lambda x:x.get('detectedAt',''),reverse=True); items=items[:max(1,min(limit,500))]
    return {'items':items,'total':len(items)}
@router.get('/{incident_id}')
def get_incident(incident_id: str):
    item=get('incidents',incident_id)
    if not item: raise HTTPException(404,'Incident not found')
    return item
@router.post('/{incident_id}/analyze')
def analyze_incident(incident_id: str, payload: dict | None=None):
    inc=get('incidents',incident_id) or (payload or {}).get('incident')
    if not inc: raise HTTPException(404,'Incident not found. Simulate a failure or ingest an incident first.')
    wf=find_workflow(inc.get('workflowId','')) or (payload or {}).get('workflow')
    if not wf: raise HTTPException(404,'Workflow associated with incident was not found')
    inc['status']='analyzing'; put('incidents',incident_id,inc)
    diagnosis=diagnose(inc,wf); inc['diagnosis']=diagnosis; inc['status']='repair_proposed' if inc.get('repairId') else 'open'; put('incidents',incident_id,inc)
    record_log(level='INFO',workflow_id=wf['id'],execution_id=inc.get('executionId','unknown'),incident_id=incident_id,event='diagnosis.completed',message=diagnosis['likelyCause'],metadata={'source':diagnosis['source'],'confidence':diagnosis['confidence']})
    return diagnosis
@router.post('/{incident_id}/repairs')
def create_repair(incident_id: str, payload: dict | None=None):
    inc=get('incidents',incident_id) or (payload or {}).get('incident')
    if not inc: raise HTTPException(404,'Incident not found')
    if inc.get('failureType')=='payment_failed':
        raise HTTPException(409,'Stripe payment incidents do not support payment or recovery actions.')
    wf=find_workflow(inc.get('workflowId','')) or (payload or {}).get('workflow')
    if not wf: raise HTTPException(404,'Workflow associated with incident was not found')
    diagnosis=inc.get('diagnosis') or diagnose(inc,wf)
    repair=propose(inc,wf,diagnosis); put('repairs',repair['id'],repair)
    inc['diagnosis']=diagnosis; inc['repairId']=repair['id']; inc['status']='repair_proposed'; put('incidents',incident_id,inc)
    record_log(level='INFO',workflow_id=wf['id'],execution_id=inc.get('executionId','unknown'),incident_id=incident_id,event='repair.proposed',message=repair['summary'],metadata={'repairId':repair['id'],'risk':repair.get('risk'),'source':repair.get('source')})
    return repair

@router.post('/{incident_id}/review')
def request_review(incident_id: str):
    inc=get('incidents',incident_id)
    if not inc: raise HTTPException(404,'Incident not found')
    inc['owner']='On-call · platform team'
    add_attempt(inc,'Escalated','pending','Assigned to on-call for manual investigation.')
    record_log(level='WARN',workflow_id=inc['workflowId'],execution_id=inc.get('executionId','unknown'),incident_id=incident_id,event='incident.escalated',message='Incident escalated for manual review.',metadata={})
    return inc

@router.post('/{incident_id}/resolve')
def resolve_incident(incident_id: str):
    inc=get('incidents',incident_id)
    if not inc: raise HTTPException(404,'Incident not found')
    inc['status']='resolved'; inc['owner']='Manual · operator'; inc['updatedAt']=now()
    add_attempt(inc,'Resolved manually','success','Closed by operator after source correction.')
    put('incidents',incident_id,inc)
    wf=find_workflow(inc['workflowId'])
    if wf:
        wf['status']='healthy'; put('workflows',wf['id'],wf)
    record_log(level='INFO',workflow_id=inc['workflowId'],execution_id=inc.get('executionId','unknown'),incident_id=incident_id,event='incident.resolved',message='Incident resolved manually by an operator.',metadata={})
    return inc
