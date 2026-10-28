from datetime import datetime, timezone
from uuid import uuid4
from app.core.storage import get, put, all_docs
from app.core.seed import get_workflows
from app.services.log_collector import record_log

def now(): return datetime.now(timezone.utc).isoformat()
def find_workflow(wid: str): return next((w for w in get_workflows() if w['id']==wid), None)
def add_attempt(incident: dict, action: str, outcome: str, detail: str):
    attempts=list(incident.get('attempts') or [])
    attempts.append({'id':f"{incident['id']}-a{len(attempts)+1}",'incidentId':incident['id'],'at':now(),'action':action,'outcome':outcome,'detail':detail})
    incident['attempts']=attempts; incident['updatedAt']=now(); put('incidents',incident['id'],incident); return incident

def create_incident(kind: str, workflow: dict, seq: int = 1, payload: dict | None = None, error_message: str | None = None, incident_id: str | None = None):
    failure_types={'missing_field','invalid_type','rate_limit','timeout','schema_mismatch','payment_failed'}
    if kind not in failure_types: kind='timeout'
    if incident_id:
        existing=get('incidents',incident_id)
        if existing:
            execution=get('executions',existing.get('executionId',''))
            return existing, execution
    broken=dict(payload or workflow.get('samplePayload') or {})
    id_field=workflow.get('idField','id'); alias=workflow.get('idAlias',id_field); num=workflow.get('numberField','amount')
    if payload is None:
        if kind=='missing_field' and id_field in broken: broken[alias]=broken.pop(id_field)
        elif kind=='schema_mismatch':
            key='email' if 'email' in broken else id_field
            if key in broken: broken[key+'_address']=broken.pop(key)
        elif kind=='invalid_type': broken[num]='NOT_A_NUMBER'
    errors={'missing_field':f"Payload validation failed: required field `{id_field}` was not found.",'invalid_type':f"Type error: field `{num}` expected number, received string.",'rate_limit':'HTTP 429 Too Many Requests from destination API (Retry-After: 30s).','timeout':'Request timed out after 30000 ms; destination write state is unknown.','schema_mismatch':'Schema mismatch: expected key missing or renamed.'}
    severity={'missing_field':'high','invalid_type':'high','rate_limit':'medium','timeout':'critical','schema_mismatch':'high','payment_failed':'high'}[kind]
    iid=incident_id or f"INC-{int(datetime.now().timestamp())%900000:06d}-{uuid4().hex[:4].upper()}"; execution=f"exe_{uuid4().hex[:8]}"; t=now()
    incident={'id':iid,'workflowId':workflow['id'],'failureType':kind,'severity':severity,'status':'open','detectedAt':t,'updatedAt':t,'title':f"{kind.replace('_',' ').title()} in {workflow['name']}",'description':f"Execution {execution} failed in workflow {workflow['name']}.",'errorMessage':error_message or errors[kind],'executionId':execution,'owner':'Unassigned','payload':broken,'attempts':[]}
    put('incidents',iid,incident)
    execution_doc={'id':execution,'workflowId':workflow['id'],'startedAt':t,'durationMs':1200,'outcome':'failed','failedStep':3 if kind in ('timeout','rate_limit') else 1,'isRetry':False}
    put('executions',execution,execution_doc)
    workflow['status']='failed'; put('workflows',workflow['id'],workflow)
    record_log(level='INFO',workflow_id=workflow['id'],execution_id=execution,event='execution.started',message=f"Execution started for {workflow['name']}.",metadata={'payloadKeys':list(broken.keys())})
    record_log(level='ERROR',workflow_id=workflow['id'],execution_id=execution,incident_id=iid,event='execution.failed',message=incident['errorMessage'],metadata={'failureType':kind,'severity':severity})
    record_log(level='WARN',workflow_id=workflow['id'],execution_id=execution,incident_id=iid,event='incident.opened',message=f"Incident {iid} opened.",metadata={'severity':severity})
    return incident, execution_doc
