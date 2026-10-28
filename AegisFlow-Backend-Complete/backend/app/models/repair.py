from typing import Any
from pydantic import BaseModel, Field
class RepairRecord(BaseModel):
    id: str
    incidentId: str
    summary: str
    rootCause: str
    modification: str
    reason: str
    expectedEffect: str
    risks: list[str]=Field(default_factory=list)
    reversible: bool=True
    requiresApproval: bool=True
    approved: bool=False
    originalPayload: dict[str,Any]=Field(default_factory=dict)
    proposedPayload: dict[str,Any]=Field(default_factory=dict)
    operations: list[dict[str,Any]]=Field(default_factory=list)
    checks: list[dict[str,Any]]=Field(default_factory=list)
    status: str='draft'
    createdAt: str
