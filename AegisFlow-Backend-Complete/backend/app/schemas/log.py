from app.schemas.common import LogIngest
class LogResponse(LogIngest):
    id: str
    timestamp: str
