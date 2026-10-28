from typing import Any
from app.core.storage import get

def validate_repair(repair: dict[str,Any], incident: dict[str,Any], workflow: dict[str,Any]) -> list[dict[str,Any]]:
    proposed=repair.get('proposedPayload') or {}; schema=workflow.get('inputSchema') or {}; original=repair.get('originalPayload') or {}
    settings=get('settings','global') or {}
    checks=[]
    def add(cid,name,description,state,detail): checks.append({'id':cid,'name':name,'description':description,'state':state,'detail':detail})
    required_fields=list(schema) or [field.strip() for field in settings.get('requiredFields','').split(',') if field.strip()]
    missing=[key for key in required_fields if key not in proposed]
    add('required-fields','Required fields','Ensure the proposed payload contains required schema keys.','passed' if not missing else 'failed', 'All required keys are present.' if not missing else 'Missing keys: '+', '.join(missing))
    type_errors=[]
    for key, expected in schema.items():
        if key not in proposed: continue
        v=proposed[key]
        valid=(expected=='string' and isinstance(v,str)) or (expected in ('number','integer') and isinstance(v,(int,float)) and not isinstance(v,bool)) or (expected=='boolean' and isinstance(v,bool)) or (expected=='array' and isinstance(v,list)) or (expected=='object' and isinstance(v,dict)) or (expected not in ('string','number','integer','boolean','array','object'))
        if not valid: type_errors.append(f'{key} should be {expected}')
    enforce_types=settings.get('enforceTypes',True)
    if not enforce_types: type_errors=[]
    add('schema-types','Schema type validation','Check payload types against the workflow contract.','passed' if not type_errors else 'failed','Type validation is disabled.' if not enforce_types else 'All known field types match.' if not type_errors else '; '.join(type_errors))
    removed=[k for k in original if k not in proposed]
    add('data-preservation','Source data preservation','Detect removal of source fields before replay.','passed' if not removed else 'review','No original fields were removed.' if not removed else 'Fields removed: '+', '.join(removed)+'. Confirm removal is intentional.')
    dangerous=any(op.get('op') in ('remove','replace') for op in repair.get('operations',[]))
    business_review=settings.get('businessRules',True) and proposed!=original
    change_review=dangerous or business_review
    add('change-risk','Change risk review','Review operations that may alter existing values.','review' if change_review else 'passed','Manual review required for a potentially destructive change or business-rule review.' if change_review else 'No high-risk operation detected by the local policy.')
    idem=workflow.get('retryPolicy',{}).get('idempotent',False)
    add('replay-safety','Replay safety','Ensure a replay will not duplicate non-idempotent writes.','review' if not idem else 'passed','Workflow is not marked idempotent; destination state must be checked before replay.' if not idem else 'Workflow is marked idempotent.')
    return checks
