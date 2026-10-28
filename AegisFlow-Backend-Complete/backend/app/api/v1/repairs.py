from fastapi import APIRouter, HTTPException
from datetime import datetime, timezone
from app.core.storage import get, put, all_docs
from app.services.incident_service import find_workflow, add_attempt
from app.services.validation_engine import validate_repair
from app.services.log_collector import record_log
from app.services.postmortem import build_postmortem
router=APIRouter(prefix='/repairs',tags=['repairs'])
@router.get('')
def list_repairs():
    items=all_docs('repairs')
    return {'items':items,'total':len(items)}

def required_repair(rid):
    item=get('repairs',rid)
    if not item: raise HTTPException(404,'Repair proposal not found')
    return item
def required_incident(iid):
    item=get('incidents',iid)
    if not item: raise HTTPException(404,'Incident not found')
    return item
@router.get('/{repair_id}')
def get_repair(repair_id: str): return required_repair(repair_id)
@router.post('/{repair_id}/validate')
def validate(repair_id: str, payload: dict | None=None):
    r=required_repair(repair_id); inc=required_incident(r['incidentId']); wf=find_workflow(inc['workflowId'])
    if not wf: raise HTTPException(404,'Workflow not found')
    checks=validate_repair(r,inc,wf); r['checks']=checks
    failed=any(c['state']=='failed' for c in checks); review=any(c['state']=='review' for c in checks)
    r['status']='failed_validation' if failed else 'validated'; put('repairs',repair_id,r)
    inc['status']='awaiting_approval' if review and not failed else ('repair_proposed' if not failed else 'open'); put('incidents',inc['id'],inc)
    outcome='failed' if failed else 'pending' if review else 'success'
    add_attempt(inc,'Repair validated',outcome,f"{sum(c['state']=='passed' for c in checks)}/{len(checks)} checks passed" + ('; manual review required' if review else ''))
    record_log(level='WARN' if failed else 'INFO',workflow_id=wf['id'],execution_id=inc.get('executionId','unknown'),incident_id=inc['id'],event='repair.validation_completed',message=f"Repair {repair_id}: {r['status']}",metadata={'checks':checks})
    return {'repairId':repair_id,'status':r['status'],'checks':checks,'eligible':not failed and (not review or r.get('approved',False))}
@router.post('/{repair_id}/approve')
def approve(repair_id: str, payload: dict | None=None):
    r=required_repair(repair_id); inc=required_incident(r['incidentId'])
    if r.get('status')=='failed_validation': raise HTTPException(409,'Repair failed validation and cannot be approved')
    r['approved']=True; put('repairs',repair_id,r); inc['status']='repair_proposed'; inc['owner']='Approved · operator'; put('incidents',inc['id'],inc)
    add_attempt(inc,'Approval granted','success','Human approval recorded through the API.')
    return {'repairId':repair_id,'approved':True,'status':'approved','note':'Approval recorded. Revalidate before replay.'}
@router.post('/{repair_id}/reject')
def reject(repair_id: str, payload: dict | None=None):
    r=required_repair(repair_id); inc=required_incident(r['incidentId'])
    r['status']='rejected'; put('repairs',repair_id,r); inc['status']='repair_rejected'; put('incidents',inc['id'],inc)
    add_attempt(inc,'Repair rejected','rejected','Original payload preserved unchanged.')
    return {'repairId':repair_id,'ok':True,'status':'rejected'}
@router.post('/{repair_id}/apply')
def apply(repair_id: str, payload: dict | None=None):
    r=required_repair(repair_id); inc=required_incident(r['incidentId']); wf=find_workflow(inc['workflowId'])
    if inc.get('failureType')=='payment_failed':
        raise HTTPException(409,'Stripe payment incidents do not support payment or recovery actions.')
    if r.get('status')!='validated': raise HTTPException(409,'Repair must pass validation before replay')
    if not r.get('approved'): raise HTTPException(403,'Human approval is required before replay')
    if not wf: raise HTTPException(404,'Workflow not found')
    checks=validate_repair(r,inc,wf)
    r['checks']=checks
    failed=any(c['state']=='failed' for c in checks)
    if failed:
        r['status']='failed_validation'; put('repairs',repair_id,r)
        raise HTTPException(409,'Repair no longer passes validation and cannot be replayed')
    r['status']='validated'
    # This is a deterministic sandbox replay only. No real downstream connector is called.
    ok=inc.get('failureType') in ('missing_field','schema_mismatch','rate_limit')
    if inc.get('failureType') in ('timeout','invalid_type') and not r.get('approved'): ok=False
    now=datetime.now(timezone.utc).isoformat(); execution_id='exe_replay_'+repair_id.lower().replace('rp-','')
    exe={'id':execution_id,'workflowId':wf['id'],'startedAt':now,'durationMs':480,'outcome':'success' if ok else 'failed','isRetry':True,'failedStep':None if ok else 1}
    from app.core.storage import put as store_put
    store_put('executions',execution_id,exe)
    if ok:
        r['status']='applied'; inc['status']='resolved'; inc['owner']='Auto · validated'; wf['status']='healthy'
        detail='Sandbox replay passed simulated recovery verification; no external system was changed.'
    else:
        r['status']='replay_failed'; inc['status']='open'; wf['status']='failed'
        detail='Sandbox replay did not pass verification. Incident remains open; no external system was changed.'
    put('repairs',repair_id,r); put('incidents',inc['id'],inc); put('workflows',wf['id'],wf)
    add_attempt(inc,'Replay #1','success' if ok else 'failed',detail)
    record_log(level='INFO' if ok else 'ERROR',workflow_id=wf['id'],execution_id=execution_id,incident_id=inc['id'],event='recovery.verified' if ok else 'recovery.failed',message=detail,metadata={'repairId':repair_id,'sandbox':True})
    return {'repairId':repair_id,'executionId':execution_id,'status':r['status'],'applied':ok,'ok':ok,'detail':detail,'execution':exe}
