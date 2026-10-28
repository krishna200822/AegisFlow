from typing import Any, Literal
from pydantic import BaseModel, Field
class LogRecord(BaseModel):
    id: str
    timestamp: str
    level: Literal['INFO','WARN','ERROR','DEBUG']
    workflowId: str
    executionId: str
    incidentId: str | None=None
    event: str
    message: str
    metadata: dict[str,Any]=Field(default_factory=dict)
