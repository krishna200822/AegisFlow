from app.services.validation_engine import validate_repair
class ValidatorAgent:
    def run(self, repair: dict, incident: dict, workflow: dict) -> list[dict]:
        return validate_repair(repair, incident, workflow)
