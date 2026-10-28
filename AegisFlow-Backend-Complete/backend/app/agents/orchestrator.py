"""Small deterministic task planner; it never executes arbitrary generated code."""
from uuid import uuid4

def plan_workflow(goal: str) -> dict:
    text=goal.strip()
    if not text: raise ValueError('goal must not be empty')
    steps=[{'id':f'task-{uuid4().hex[:6]}','name':name,'description':desc,'status':'pending'} for name,desc in [
      ('Inspect inputs','Collect and validate the declared input data.'),('Execute registered operation','Run only a registered integration/tool in a configured sandbox.'),('Verify output','Check output against the expected schema and business rules.')]]
    return {'id':'plan-'+uuid4().hex[:8],'goal':text,'steps':steps,'executionBoundary':'No external actions are performed by the planner.'}
