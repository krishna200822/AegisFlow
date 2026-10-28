from app.services.log_collector import record_log

def capture_event(event: str, message: str, *, workflow_id: str='external', execution_id: str='external', level: str='INFO', metadata: dict | None=None, incident_id: str | None=None):
    return record_log(level=level,workflow_id=workflow_id,execution_id=execution_id,event=event,message=message,metadata=metadata,incident_id=incident_id)
