from typing import Any, Literal
from pydantic import BaseModel, Field, ConfigDict
class IncidentCreate(BaseModel):
    model_config=ConfigDict(extra='allow')
    workflowId: str
    failureType: Literal['missing_field','invalid_type','rate_limit','timeout','schema_mismatch','payment_failed']
    severity: Literal['low','medium','high','critical']='medium'
    title: str
    errorMessage: str
    executionId: str
    payload: dict[str,Any]=Field(default_factory=dict)
class Diagnosis(BaseModel):
    likelyCause: str
    evidence: list[str]=Field(default_factory=list)
    confidence: float=Field(ge=0,le=1)
    alternatives: list[str]=Field(default_factory=list)
    nextStep: str
    source: Literal['gemini','simulated']
