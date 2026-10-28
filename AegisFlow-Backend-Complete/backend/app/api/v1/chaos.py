from fastapi import APIRouter, HTTPException
from app.core.seed import get_workflows
from app.services.incident_service import create_incident
router=APIRouter(prefix='/simulate',tags=['chaos'])
@router.post('/failure')
def simulate_failure(payload: dict):
    kind=payload.get('type','timeout'); workflow_data=payload.get('workflow') or {}; wid=workflow_data.get('id') or payload.get('workflowId')
    workflows=get_workflows(); wf=next((x for x in workflows if x['id']==wid),None)
    if wf is None and workflow_data.get('name'):
        # Accept a frontend-provided workflow seed to support new local workflow definitions.
        wf={**workflow_data,'id':wid or 'wf-custom','samplePayload':workflow_data.get('samplePayload',{}),'idField':workflow_data.get('idField','id'),'idAlias':workflow_data.get('idAlias','id'),'numberField':workflow_data.get('numberField','amount')}
    if wf is None: wf=workflows[0]
    inc,exe=create_incident(kind,wf,int(payload.get('seq',1)),payload.get('payload'))
    return {'accepted':True,'mode':'simulation','incident':inc,'execution':exe,'logs':[],'events':[],'detail':'Failure simulated locally; no external system was affected.'}
