from fastapi import APIRouter
from app.core.config import settings
from app.core.storage import count
router=APIRouter(tags=['health'])
@router.get('/health')
def health(): return {'status':'ok','service':'aegisflow-api','model':settings.gemini_model}
@router.get('/ready')
def ready(): return {'status':'ready','dependencies':{'database':'ok','llm':'configured' if settings.gemini_api_key else 'fallback_enabled'}}
