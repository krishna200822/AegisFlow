"""Synchronous task entry points. Can be moved behind Celery when a worker is deployed."""
from app.core.storage import get
from app.services.incident_service import find_workflow
from app.ai.diagnostics import diagnose
from app.ai.repair_planner import propose

def diagnose_task(incident_id: str):
    inc=get('incidents',incident_id)
    if not inc: raise KeyError(f'Incident {incident_id} not found')
    wf=find_workflow(inc['workflowId'])
    if not wf: raise KeyError(f"Workflow {inc['workflowId']} not found")
    return diagnose(inc,wf)

def propose_repair_task(incident_id: str):
    inc=get('incidents',incident_id)
    if not inc: raise KeyError(f'Incident {incident_id} not found')
    wf=find_workflow(inc['workflowId'])
    if not wf: raise KeyError(f"Workflow {inc['workflowId']} not found")
    return propose(inc,wf,inc.get('diagnosis'))
