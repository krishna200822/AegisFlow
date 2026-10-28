from typing import Any, Literal
from pydantic import BaseModel, Field
class IncidentRecord(BaseModel):
    id: str
    workflowId: str
    failureType: Literal['missing_field','invalid_type','rate_limit','timeout','schema_mismatch']
    severity: Literal['low','medium','high','critical']
    status: str='open'
    detectedAt: str
    updatedAt: str
    title: str
    description: str=''
    errorMessage: str
    executionId: str
    owner: str='Unassigned'
    payload: dict[str,Any]=Field(default_factory=dict)
    attempts: list[dict[str,Any]]=Field(default_factory=list)
