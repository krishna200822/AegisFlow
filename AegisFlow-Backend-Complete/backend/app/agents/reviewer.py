from app.ai.repair_planner import risk_score
class ReviewerAgent:
    def run(self, incident: dict, workflow: dict, operations: list[dict]) -> dict:
        risk=risk_score(incident,workflow,operations)
        return {'risk':risk,'requiresApproval':risk['score']>=55 or incident.get('severity')=='critical' or not workflow.get('retryPolicy',{}).get('idempotent',False)}
