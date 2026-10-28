from app.core.storage import get, put, all_docs
from app.core.seed import get_workflows

def list_workflows(): return get_workflows()
def get_workflow(workflow_id: str):
    return get('workflows',workflow_id) or next((w for w in get_workflows() if w['id']==workflow_id),None)
def save_workflow(workflow: dict): return put('workflows',workflow['id'],workflow)
