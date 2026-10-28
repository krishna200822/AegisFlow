from app.services.log_collector import query_logs, record_log

def search_logs(query: str | None=None, level: str | None=None, workflow_id: str | None=None, incident_id: str | None=None, limit: int=100):
    return query_logs(query,level,workflow_id,incident_id,limit)
def create_log(**fields): return record_log(**fields)
