export type WorkflowStatus = "healthy" | "degraded" | "failed" | "recovering";
export type Severity = "low" | "medium" | "high" | "critical";
export type IncidentStatus =
  "open" | "analyzing" | "repair_proposed" | "awaiting_approval" | "repair_rejected" | "resolved";
export type FailureType =
  | "missing_field"
  | "invalid_type"
  | "rate_limit"
  | "timeout"
  | "schema_mismatch"
  | "payment_failed";
export type LogLevel = "INFO" | "WARN" | "ERROR" | "DEBUG";
export type CheckState = "not_run" | "running" | "passed" | "failed" | "review";
export type StageState = "waiting" | "in_progress" | "passed" | "failed" | "blocked" | "approval";
export type NodeState = "completed" | "failed" | "pending" | "retried" | "approval";
export type DataSource = "simulated" | "gemini";

export interface PipelineStep {
  id: string;
  name: string;
  description: string;
}

export interface Workflow {
  id: string;
  name: string;
  description: string;
  integration: string;
  status: WorkflowStatus;
  steps: PipelineStep[];
  inputSchema: Record<string, string>;
  outputSchema: Record<string, string>;
  retryPolicy: { maxAttempts: number; backoff: string; idempotent: boolean };
}

export interface WorkflowExecution {
  id: string;
  workflowId: string;
  startedAt: string;
  durationMs: number;
  outcome: "success" | "failed";
  /** Which step index failed, if any. */
  failedStep?: number;
  isRetry?: boolean;
}

export interface RootCauseDiagnosis {
  likelyCause: string;
  evidence: string[];
  confidence: number; // 0-1, heuristic, not calibrated
  alternatives: string[];
  nextStep: string;
  source: DataSource;
}

export interface PatchOperation {
  op: "add" | "replace" | "remove" | "rename" | "policy";
  path: string;
  from?: unknown;
  value?: unknown;
  note: string;
}

export interface ValidationCheck {
  id: string;
  name: string;
  description: string;
  state: CheckState;
  detail?: string;
}

export interface RepairProposal {
  id: string;
  incidentId: string;
  summary: string;
  rootCause: string;
  modification: string;
  reason: string;
  expectedEffect: string;
  risks: string[];
  reversible: boolean;
  requiresApproval: boolean;
  approved: boolean;
  originalPayload: Record<string, unknown>;
  proposedPayload: Record<string, unknown>;
  operations: PatchOperation[];
  checks: ValidationCheck[];
  status:
    | "draft"
    | "validating"
    | "validated"
    | "failed_validation"
    | "rejected"
    | "applied"
    | "replay_failed";
  createdAt: string;
  risk?: { score: number; band: string; blastRadius: string };
}

export interface RecoveryAttempt {
  id: string;
  incidentId: string;
  at: string;
  action: string;
  outcome: "success" | "failed" | "rejected" | "pending";
  detail: string;
}

export interface Incident {
  id: string;
  workflowId: string;
  failureType: FailureType;
  severity: Severity;
  status: IncidentStatus;
  detectedAt: string;
  updatedAt: string;
  title: string;
  description: string;
  errorMessage: string;
  executionId: string;
  owner: string;
  payload: Record<string, unknown>;
  diagnosis?: RootCauseDiagnosis;
  repairId?: string;
  attempts: RecoveryAttempt[];
}

export interface StripeEvent {
  id: string;
  type: string;
  status: "processing" | "processed" | "ignored" | "failed";
  paymentIntentId?: string;
  incidentId?: string;
  amount?: number;
  currency?: string;
  failureCode?: string;
  livemode: boolean;
  simulated: boolean;
  receivedAt: string;
  detail?: string;
}

export interface StripeStatus {
  mode: "test";
  webhookConfigured: boolean;
  simulationAvailable: boolean;
  financialActionsEnabled: false;
}

export interface LogEntry {
  id: string;
  timestamp: string;
  level: LogLevel;
  workflowId: string;
  executionId: string;
  incidentId?: string;
  event: string;
  message: string;
  metadata: Record<string, unknown>;
}

export type TimelineCategory =
  | "execution"
  | "anomaly"
  | "detection"
  | "diagnosis"
  | "repair"
  | "validation"
  | "recovery"
  | "approval"
  | "rejection";

export interface TimelineEvent {
  id: string;
  timestamp: string;
  category: TimelineCategory;
  workflowId: string;
  incidentId?: string;
  description: string;
  tone: "info" | "warning" | "error" | "success" | "neutral";
}

export interface SystemMetrics {
  workflowsMonitored: number;
  activeIncidents: number;
  successfulRecoveries: number;
  failedRecoveries: number;
  recoverySuccessRate: number;
}

export interface Settings {
  pollingIntervalSec: number;
  monitoringEnabled: boolean;
  severityThreshold: Severity;
  maxRetries: number;
  retryDelaySec: number;
  approvalForHighRisk: boolean;
  autoRetry: boolean;
  requiredFields: string;
  enforceTypes: boolean;
  businessRules: boolean;
  model: string;
}

export interface FailureScenario {
  type: FailureType;
  label: string;
  description: string;
  expectedOutcome: "recoverable" | "rejected" | "approval";
}
