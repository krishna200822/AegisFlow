"""Evidence collector limited to data already captured by AegisFlow."""
from app.core.storage import all_docs
class ResearcherAgent:
    def run(self, incident_id: str) -> dict:
        return {'incidentId':incident_id,'logs':[x for x in all_docs('logs') if x.get('incidentId')==incident_id][:50],'similarIncidents':[x for x in all_docs('incidents') if x.get('id')!=incident_id][:10]}
