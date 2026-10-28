from typing import Literal
from fastapi import APIRouter
from pydantic import BaseModel, ConfigDict, Field
from app.ai.provider import GeminiNotConfigured, check_model_support
from app.core.config import settings as app_settings
from app.core.seed import WORKFLOWS
from app.core.storage import delete_collection, get, put

router=APIRouter(prefix='/settings',tags=['settings'])

DEFAULTS={
    'pollingIntervalSec':30,
    'monitoringEnabled':True,
    'severityThreshold':'medium',
    'maxRetries':3,
    'retryDelaySec':30,
    'approvalForHighRisk':True,
    'autoRetry':False,
    'requiredFields':'customer_id, email, plan, seats',
    'enforceTypes':True,
    'businessRules':True,
}

class SettingsPatch(BaseModel):
    model_config=ConfigDict(extra='forbid')
    pollingIntervalSec: int | None=Field(default=None,ge=5,le=600)
    monitoringEnabled: bool | None=None
    severityThreshold: Literal['low','medium','high','critical'] | None=None
    maxRetries: int | None=Field(default=None,ge=0,le=5)
    retryDelaySec: int | None=Field(default=None,ge=1,le=600)
    approvalForHighRisk: bool | None=None
    autoRetry: bool | None=None
    requiredFields: str | None=Field(default=None,max_length=1000)
    enforceTypes: bool | None=None
    businessRules: bool | None=None

def current_settings():
    stored=get('settings','global') or {}
    return {**DEFAULTS,**stored,'model':app_settings.gemini_model}

@router.get('')
def read_settings():
    return current_settings()

@router.patch('')
def update_settings(payload: SettingsPatch):
    updated={**current_settings(),**payload.model_dump(exclude_unset=True)}
    updated.pop('model',None)
    put('settings','global',updated)
    return {**updated,'model':app_settings.gemini_model}

@router.get('/model-status')
def model_status():
    model=app_settings.gemini_model
    try:
        check_model_support()
        return {'model':model,'configured':True,'supported':True,'verified':True,'detail':'The configured Gemini model is available through the Gemini API.'}
    except GeminiNotConfigured as exc:
        return {'model':model,'configured':False,'supported':None,'verified':False,'detail':str(exc)}
    except Exception:
        return {'model':model,'configured':True,'supported':None,'verified':False,'detail':'Gemini model verification failed. Check backend logs, model access, API key permissions, quota, and network connectivity.'}

@router.post('/reset-demo')
def reset_demo():
    for collection in ('incidents','logs','repairs','executions','postmortems','settings','stripe_events'):
        delete_collection(collection)
    for workflow in WORKFLOWS:
        put('workflows',workflow['id'],workflow)
    return {'ok':True,'detail':'Sandbox incidents, logs, repairs, executions, post-mortems, and settings were reset.'}
