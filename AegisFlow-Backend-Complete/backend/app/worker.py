"""Optional Celery worker entry point; core API works without Redis/Celery."""
try:
    from celery import Celery
    from app.core.config import settings
    celery_app=Celery('aegisflow',broker=settings.redis_url,backend=settings.redis_url)
except ImportError:
    celery_app=None
