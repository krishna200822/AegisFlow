from app.core.storage import get, put, all_docs
from app.services.incident_service import add_attempt

def get_incident(incident_id: str): return get('incidents',incident_id)
def list_incidents(status: str | None=None, query: str | None=None, limit: int=200):
    items=all_docs('incidents')
    if status: items=[x for x in items if x.get('status')==status]
    if query: items=[x for x in items if query.lower() in str(x).lower()]
    return sorted(items,key=lambda x:x.get('detectedAt',''),reverse=True)[:max(1,min(limit,500))]
def save_incident(incident: dict): return put('incidents',incident['id'],incident)
