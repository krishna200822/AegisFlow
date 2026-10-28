# Data model

Core entities: Workflow, WorkflowRun, Incident, LogEvent, Diagnosis, RepairProposal, Approval, ValidationRun, FailureCluster, PostMortem, AuditEvent.

Suggested relationships: a Workflow has many WorkflowRuns; a WorkflowRun can create multiple Incidents; an Incident has many LogEvents and RepairProposals; a RepairProposal has zero or one Approval and many ValidationRuns; FailureClusters group similar Incidents; PostMortems summarize resolved Incidents.
