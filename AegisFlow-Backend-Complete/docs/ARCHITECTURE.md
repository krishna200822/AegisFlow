# AegisFlow system architecture

## Main flow
1. Workflow events and structured logs enter the API / collectors.
2. Incident service correlates evidence and retrieves similar historical incidents.
3. Diagnostic layer proposes root-cause hypotheses with evidence references.
4. Risk estimator computes impact and confidence.
5. Repair planner produces a constrained patch proposal.
6. Approval policy blocks unsafe or unapproved changes.
7. Validation engine runs health checks and replay tests.
8. Metrics and post-mortems record the outcome.

## Safety boundaries
- Default to human approval; automatic repair is disabled by default.
- Keep immutable audit events for diagnosis, approval, apply, rollback, and validation.
- Never run arbitrary model-generated shell commands.
- Use allowlisted patch operations and explicit timeouts.
- Keep credentials in environment/secret storage, never in source control.

## Main modules
- `src/`: React/TanStack frontend.
- `backend/app/api/`: HTTP API surface.
- `backend/app/services/`: deterministic workflow and reliability logic.
- `backend/app/ai/`: LLM diagnostics, embeddings, clustering, repair planning.
- `backend/app/agents/`: orchestrated specialist responsibilities.
- `backend/app/models/` and `backend/app/repositories/`: persistence.
- `contracts/`: event schemas shared by components.
- `infra/`: local services, reverse proxy, monitoring.
