from typing import Any
from pydantic import BaseModel, Field
class WorkflowRecord(BaseModel):
    id: str
    name: str
    description: str=''
    integration: str='Custom integration'
    status: str='healthy'
    steps: list[dict[str,Any]]=Field(default_factory=list)
    inputSchema: dict[str,str]=Field(default_factory=dict)
    outputSchema: dict[str,str]=Field(default_factory=dict)
    retryPolicy: dict[str,Any]=Field(default_factory=lambda:{'maxAttempts':3,'backoff':'exponential','idempotent':False})
