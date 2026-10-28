from typing import Any, Literal
from pydantic import BaseModel, Field, ConfigDict
class PatchOperation(BaseModel):
    model_config=ConfigDict(extra='allow')
    op: Literal['add','replace','remove','rename','policy']
    path: str
    note: str
    value: Any=None
    from_: Any=Field(default=None,alias='from')
class RepairProposal(BaseModel):
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
    operations: list[PatchOperation]=Field(default_factory=list)
    checks: list[dict[str,Any]]=Field(default_factory=list)
    status: str='draft'
    createdAt: str
