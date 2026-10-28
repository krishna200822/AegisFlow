from app.ai.repair_planner import propose
class RepairAgent:
    def run(self, incident: dict, workflow: dict, diagnosis: dict | None=None) -> dict:
        return propose(incident, workflow, diagnosis)
