from typing import Any, Literal
from pydantic import BaseModel, Field, ConfigDict
class RetryPolicy(BaseModel):
    maxAttempts: int=Field(default=3,ge=0,le=10)
    backoff: str='exponential'
    idempotent: bool=False
class WorkflowCreate(BaseModel):
    model_config=ConfigDict(extra='allow')
    name: str=Field(min_length=1,max_length=160)
    description: str=''
    integration: str='Custom integration'
    steps: list[dict[str,Any]]=Field(default_factory=list)
    inputSchema: dict[str,str]=Field(default_factory=dict)
    outputSchema: dict[str,str]=Field(default_factory=dict)
    retryPolicy: RetryPolicy=Field(default_factory=RetryPolicy)
    samplePayload: dict[str,Any]=Field(default_factory=dict)
class WorkflowResponse(WorkflowCreate):
    id: str
    status: Literal['healthy','degraded','failed','recovering']='healthy'
