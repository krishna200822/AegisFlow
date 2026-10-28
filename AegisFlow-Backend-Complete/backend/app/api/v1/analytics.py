from fastapi import APIRouter, HTTPException
from app.services.metrics import get_metrics, get_clusters
from app.services.postmortem import build_postmortem
from app.core.storage import get, put, all_docs
from app.services.incident_service import find_workflow
router=APIRouter(prefix='/analytics',tags=['analytics'])
@router.get('/metrics')
def metrics(): return get_metrics()
@router.get('/executions')
def executions():
    items=all_docs('executions')
    items.sort(key=lambda x:x.get('startedAt',''),reverse=True)
    return {'items':items,'total':len(items)}
@router.get('/clusters')
def clusters(): return get_clusters()
@router.post('/postmortems/{incident_id}')
def create_postmortem(incident_id: str):
    inc=get('incidents',incident_id)
    if not inc: raise HTTPException(404,'Incident not found')
    wf=find_workflow(inc['workflowId']) or {'id':inc['workflowId'],'name':inc['workflowId']}
    repair=get('repairs',inc.get('repairId','')) if inc.get('repairId') else None
    doc=build_postmortem(inc,wf,repair); put('postmortems',incident_id,doc); return doc
@router.get('/postmortems')
def list_postmortems():
    items=all_docs('postmortems'); return {'items':items,'total':len(items)}
