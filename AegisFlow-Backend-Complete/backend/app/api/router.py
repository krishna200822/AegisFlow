from fastapi import APIRouter
from app.api.v1 import analytics, chaos, health, incidents, logs, repairs, salesforce, settings, stripe, workflows
api_router=APIRouter()
for module in (health, settings, workflows, incidents, logs, repairs, chaos, analytics, stripe, salesforce):
    api_router.include_router(module.router)
