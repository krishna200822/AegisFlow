from app.ai.diagnostics import diagnose
class DiagnosticianAgent:
    def run(self, incident: dict, workflow: dict) -> dict:
        return diagnose(incident, workflow)
