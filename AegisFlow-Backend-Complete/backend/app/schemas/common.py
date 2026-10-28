from typing import Any, Literal
from pydantic import BaseModel, Field, ConfigDict
class APIModel(BaseModel):
    model_config=ConfigDict(extra='allow')
class LogIngest(APIModel):
    level: Literal['INFO','WARN','ERROR','DEBUG']='INFO'
    workflowId: str='external'
    executionId: str='external'
    incidentId: str | None=None
    event: str=Field(min_length=1,max_length=160)
    message: str=Field(min_length=1,max_length=4000)
    metadata: dict[str,Any]=Field(default_factory=dict)
class FailureSimulation(APIModel):
    type: Literal['missing_field','invalid_type','rate_limit','timeout','schema_mismatch']='timeout'
    workflowId: str | None=None
    workflow: dict[str,Any] | None=None
    seq: int=1
    payload: dict[str,Any] | None=None
