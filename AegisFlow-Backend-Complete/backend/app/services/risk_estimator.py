from app.ai.repair_planner import risk_score

def estimate(incident: dict, workflow: dict, operations: list[dict]):
    return risk_score(incident, workflow, operations)
