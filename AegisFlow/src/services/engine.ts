/**
 * Deterministic simulation engine. Pure functions only: no React, no state.
 * When the FastAPI + Gemini backend is connected, diagnose/propose move server-side;
 * validate() mirrors the independent checks the backend will run.
 */
import type {
  FailureScenario,
  FailureType,
  Incident,
  LogEntry,
  PatchOperation,
  RepairProposal,
  RootCauseDiagnosis,
  Severity,
  TimelineEvent,
  ValidationCheck,
  WorkflowExecution,
} from "@/types";
import type { WorkflowSeed } from "@/mock/workflows";

export const SCENARIOS: FailureScenario[] = [
  {
    type: "missing_field",
    label: "Missing Required Field",
    description:
      "Upstream sends the identifier under a legacy alias, so the required key is absent.",
    expectedOutcome: "recoverable",
  },
  {
    type: "invalid_type",
    label: "Invalid Data Type",
    description:
      "A numeric field arrives as free text. The model's suggested repair discards data.",
    expectedOutcome: "rejected",
  },
  {
    type: "rate_limit",
    label: "API Rate Limit",
    description: "Destination returns HTTP 429 with a Retry-After header.",
    expectedOutcome: "recoverable",
  },
  {
    type: "timeout",
    label: "Temporary Timeout",
    description: "Write step times out on a non-idempotent call. Replay needs human approval.",
    expectedOutcome: "approval",
  },
];

export const FAILURE_LABEL: Record<FailureType, string> = {
  missing_field: "Missing required field",
  invalid_type: "Invalid data type",
  rate_limit: "API rate limit",
  timeout: "Request timeout",
  schema_mismatch: "Schema mismatch",
  payment_failed: "Stripe payment failed",
};

const SEVERITY: Record<FailureType, Severity> = {
  missing_field: "high",
  invalid_type: "high",
  rate_limit: "medium",
  timeout: "critical",
  schema_mismatch: "high",
  payment_failed: "high",
};

/** Index of the pipeline step at which each failure surfaces. */
export const FAILED_STEP: Record<FailureType, number> = {
  missing_field: 1,
  invalid_type: 1,
  payment_failed: 3,
  schema_mismatch: 1,
  rate_limit: 3,
  timeout: 3,
};

export function brokenPayload(type: FailureType, wf: WorkflowSeed): Record<string, unknown> {
  const p = { ...wf.samplePayload };
  if (type === "missing_field") {
    const v = p[wf.idField];
    delete p[wf.idField];
    return { [wf.idAlias]: v, ...p };
  }
  if (type === "invalid_type") return { ...p, [wf.numberField]: "N/A — see notes" };
  if (type === "schema_mismatch") {
    const key = "email" in p ? "email" : wf.idField;
    const v = p[key];
    delete p[key];
    return { ...p, [`${key}_address`]: v };
  }
  return p;
}

function errorFor(type: FailureType, wf: WorkflowSeed, payload: Record<string, unknown>) {
  switch (type) {
    case "missing_field":
      return `Payload validation failed: required field \`${wf.idField}\` was not found.`;
    case "invalid_type":
      return `Type error: field \`${wf.numberField}\` expected number, received string "${payload[wf.numberField]}".`;
    case "schema_mismatch":
      return `Schema mismatch: unexpected key \`${Object.keys(payload).find((k) => k.endsWith("_address"))}\`; required key missing.`;
    case "rate_limit":
      return `HTTP 429 Too Many Requests from ${wf.integration.split("→")[1]?.trim()} (Retry-After: 30s).`;
    case "timeout":
      return `Request timed out after 30000 ms on step "${wf.steps[3].name}". Write state unknown.`;
    case "payment_failed":
      return "Stripe test-mode PaymentIntent reported a payment failure.";
  }
}

export interface ScenarioResult {
  incident: Incident;
  execution: WorkflowExecution;
  logs: LogEntry[];
  events: TimelineEvent[];
}

export function createFailure(
  type: FailureType,
  wf: WorkflowSeed,
  seq: number,
  at: number,
): ScenarioResult {
  const id = `INC-${1040 + seq}`;
  const exec = `exe_${wf.id.slice(3, 6)}${(7310 + seq * 37).toString(16)}`;
  const t = (offsetMs: number) => new Date(at + offsetMs).toISOString();
  const payload = brokenPayload(type, wf);
  const err = errorFor(type, wf, payload);
  const failedStep = FAILED_STEP[type];

  const incident: Incident = {
    id,
    workflowId: wf.id,
    failureType: type,
    severity: SEVERITY[type],
    status: "open",
    detectedAt: t(1400),
    updatedAt: t(1400),
    title: `${FAILURE_LABEL[type]} in ${wf.name}`,
    description: `Execution ${exec} failed at "${wf.steps[failedStep].name}". ${SCENARIOS.find((s) => s.type === type)?.description ?? ""}`,
    errorMessage: err,
    executionId: exec,
    owner: "Unassigned",
    payload,
    attempts: [],
  };

  const logs: LogEntry[] = [
    {
      id: `log-${id}-1`,
      timestamp: t(0),
      level: "INFO",
      workflowId: wf.id,
      executionId: exec,
      event: "execution.started",
      message: `Execution started for ${wf.name}.`,
      metadata: {
        trigger: wf.integration.split("→")[0].trim(),
        payload_bytes: JSON.stringify(payload).length,
      },
    },
    {
      id: `log-${id}-2`,
      timestamp: t(320),
      level: "DEBUG",
      workflowId: wf.id,
      executionId: exec,
      event: "payload.received",
      message: `Received payload with keys: ${Object.keys(payload).join(", ")}.`,
      metadata: { payload },
    },
    {
      id: `log-${id}-3`,
      timestamp: t(1100),
      level: "ERROR",
      workflowId: wf.id,
      executionId: exec,
      incidentId: id,
      event:
        type === "rate_limit" || type === "timeout" ? "step.failed" : "payload.validation_failed",
      message: err,
      metadata: { step: wf.steps[failedStep].name, step_index: failedStep, failure_type: type },
    },
    {
      id: `log-${id}-4`,
      timestamp: t(1400),
      level: "WARN",
      workflowId: wf.id,
      executionId: exec,
      incidentId: id,
      event: "incident.opened",
      message: `Incident ${id} opened (${SEVERITY[type]}).`,
      metadata: { severity: SEVERITY[type] },
    },
  ];

  const events: TimelineEvent[] = [
    ev(t(0), "execution", wf.id, undefined, `Execution ${exec} started`, "neutral"),
    ev(t(1100), "anomaly", wf.id, id, err, "warning"),
    ev(t(1400), "detection", wf.id, id, `Failure detected — ${id} opened`, "error"),
  ];

  return {
    incident,
    execution: {
      id: exec,
      workflowId: wf.id,
      startedAt: t(0),
      durationMs: 1100,
      outcome: "failed",
      failedStep,
    },
    logs,
    events,
  };
}

let evSeq = 0;
export function ev(
  timestamp: string,
  category: TimelineEvent["category"],
  workflowId: string,
  incidentId: string | undefined,
  description: string,
  tone: TimelineEvent["tone"],
): TimelineEvent {
  evSeq += 1;
  return {
    id: `ev-${timestamp}-${evSeq}`,
    timestamp,
    category,
    workflowId,
    incidentId,
    description,
    tone,
  };
}

export function diagnose(inc: Incident, wf: WorkflowSeed): RootCauseDiagnosis {
  const base = { source: "simulated" as const };
  switch (inc.failureType) {
    case "missing_field":
      return {
        ...base,
        likelyCause: `Upstream sender renamed \`${wf.idField}\` to the legacy alias \`${wf.idAlias}\`.`,
        evidence: [
          `Payload contains \`${wf.idAlias}\` with value "${inc.payload[wf.idAlias]}" matching the ${wf.idField} format.`,
          `\`${wf.idField}\` is required by the input schema and absent.`,
          "Previous 200 executions used the canonical key.",
        ],
        confidence: 0.86,
        alternatives: [
          "Upstream mapping change deployed without notice",
          "Partial payload truncation",
        ],
        nextStep: `Map \`${wf.idAlias}\` → \`${wf.idField}\` and replay. Do not fabricate an identifier.`,
      };
    case "invalid_type":
      return {
        ...base,
        likelyCause: `Free-text value entered in numeric field \`${wf.numberField}\` at source.`,
        evidence: [
          `Value "${inc.payload[wf.numberField]}" is not parseable as a number.`,
          `Schema declares \`${wf.numberField}\` as number.`,
        ],
        confidence: 0.74,
        alternatives: ["Source form validation disabled", "CSV import column shift"],
        nextStep:
          "The original value cannot be recovered automatically. Request corrected data from the source owner.",
      };
    case "rate_limit":
      return {
        ...base,
        likelyCause: "Destination API quota exhausted during a traffic burst.",
        evidence: [
          "HTTP 429 with Retry-After: 30s",
          "Request volume 3.1× hourly baseline in preceding 5 minutes",
        ],
        confidence: 0.91,
        alternatives: ["API key downgraded to lower tier"],
        nextStep: "Retry after the Retry-After window with exponential backoff. Payload unchanged.",
      };
    case "timeout":
      return {
        ...base,
        likelyCause: `Destination latency spike during "${wf.steps[3].name}". Write may or may not have committed.`,
        evidence: [
          "No response within 30000 ms",
          "p95 latency for destination rose to 24 s",
          "Step is not idempotent per retry policy",
        ],
        confidence: 0.68,
        alternatives: [
          "Network partition between worker and destination",
          "Destination maintenance window",
        ],
        nextStep:
          "Replay with an idempotency key derived from the execution ID. Requires human approval.",
      };
    case "schema_mismatch":
      return {
        ...base,
        likelyCause: "Provider changed field naming from `email` to `email_address`.",
        evidence: ["Unknown key `email_address` in payload", "Required key `email` missing"],
        confidence: 0.62,
        alternatives: [
          "Enrichment provider rejects the email domain itself",
          "Payload from a test environment",
        ],
        nextStep: "Rename key and replay; verify enrichment output.",
      };
  }
}

function checksTemplate(): ValidationCheck[] {
  return [
    {
      id: "json",
      name: "JSON syntax",
      description: "Proposed payload serializes and parses losslessly.",
      state: "not_run",
    },
    {
      id: "schema",
      name: "Schema validation",
      description: "No keys outside the declared input schema.",
      state: "not_run",
    },
    {
      id: "required",
      name: "Required fields",
      description: "Every required field is present and non-empty.",
      state: "not_run",
    },
    {
      id: "types",
      name: "Data types",
      description: "Each value matches its declared type.",
      state: "not_run",
    },
    {
      id: "business",
      name: "Business rules",
      description: "Numeric quantities positive; no original data discarded.",
      state: "not_run",
    },
    {
      id: "output",
      name: "Expected-output test",
      description: "Dry-run of pipeline steps produces the output schema.",
      state: "not_run",
    },
    {
      id: "safety",
      name: "Safety & retry",
      description: "Retry budget, idempotency, and approval requirements.",
      state: "not_run",
    },
  ];
}

export function propose(inc: Incident, wf: WorkflowSeed, at: number): RepairProposal {
  const original = inc.payload;
  let proposed: Record<string, unknown> = { ...original };
  let ops: PatchOperation[] = [];
  let p: Pick<
    RepairProposal,
    | "summary"
    | "modification"
    | "reason"
    | "expectedEffect"
    | "risks"
    | "reversible"
    | "requiresApproval"
  >;

  switch (inc.failureType) {
    case "missing_field": {
      const v = original[wf.idAlias];
      proposed = {
        [wf.idField]: v,
        ...Object.fromEntries(Object.entries(original).filter(([k]) => k !== wf.idAlias)),
      };
      ops = [
        {
          op: "rename",
          path: `/${wf.idAlias}`,
          value: `/${wf.idField}`,
          note: "Map known legacy alias to canonical key. Value preserved.",
        },
      ];
      p = {
        summary: `Map \`${wf.idAlias}\` to \`${wf.idField}\``,
        modification: `Rename key \`${wf.idAlias}\` → \`${wf.idField}\`; value unchanged.`,
        reason: "Alias is a documented legacy name and its value matches the identifier format.",
        expectedEffect: "Validation step passes; record syncs normally.",
        risks: [
          "If alias semantics differ, wrong record could be updated (mitigated by format match).",
        ],
        reversible: true,
        requiresApproval: false,
      };
      break;
    }
    case "invalid_type": {
      proposed = { ...original, [wf.numberField]: 0 };
      ops = [
        {
          op: "replace",
          path: `/${wf.numberField}`,
          from: original[wf.numberField],
          value: 0,
          note: "Model suggested defaulting unparseable value to 0.",
        },
      ];
      p = {
        summary: `Default \`${wf.numberField}\` to 0`,
        modification: `Replace "${original[wf.numberField]}" with 0.`,
        reason:
          "Model output: coerce invalid value to a type-safe default so the pipeline can proceed.",
        expectedEffect: "Type check passes, but downstream receives a fabricated value.",
        risks: [
          "Discards original data",
          `Writes ${wf.numberField}=0 to ${wf.integration.split("→")[1]?.trim()}`,
        ],
        reversible: false,
        requiresApproval: true,
      };
      break;
    }
    case "rate_limit":
      ops = [
        {
          op: "policy",
          path: "retry",
          value: { delay_s: 30, backoff: "exponential", max_attempts: wf.retryPolicy.maxAttempts },
          note: "Honor Retry-After; payload unchanged.",
        },
      ];
      p = {
        summary: "Retry after Retry-After window",
        modification: "No payload changes. Schedule replay after 30 s with exponential backoff.",
        reason: "429 is transient; destination explicitly advertised a retry window.",
        expectedEffect: "Request succeeds once quota resets.",
        risks: ["Repeated bursts may re-trigger the limit"],
        reversible: true,
        requiresApproval: false,
      };
      break;
    case "timeout":
      proposed = { ...original, idempotency_key: inc.executionId };
      ops = [
        {
          op: "add",
          path: "/idempotency_key",
          value: inc.executionId,
          note: "Derived from the failed execution ID, not invented.",
        },
        {
          op: "policy",
          path: "retry",
          value: { delay_s: 10, attempts: 1 },
          note: "Single guarded replay.",
        },
      ];
      p = {
        summary: "Guarded replay with idempotency key",
        modification:
          "Add `idempotency_key` header/field equal to the original execution ID and replay once.",
        reason:
          "Write outcome unknown; idempotency key prevents duplicate records if the first write committed.",
        expectedEffect: "Destination deduplicates or completes the write exactly once.",
        risks: [
          "Step is declared non-idempotent; destination must honor the key",
          "Possible duplicate side effects if unsupported",
        ],
        reversible: false,
        requiresApproval: true,
      };
      break;
    case "schema_mismatch": {
      const v = original.email_address;
      proposed = {
        ...Object.fromEntries(Object.entries(original).filter(([k]) => k !== "email_address")),
        email: v,
      };
      ops = [
        {
          op: "rename",
          path: "/email_address",
          value: "/email",
          note: "Map provider's new key name to schema key.",
        },
      ];
      p = {
        summary: "Map `email_address` to `email`",
        modification: "Rename key `email_address` → `email`.",
        reason: "Field naming drift detected on provider side.",
        expectedEffect: "Validation passes; enrichment returns firmographic data.",
        risks: ["Diagnosis confidence is moderate; enrichment may still fail"],
        reversible: true,
        requiresApproval: false,
      };
      break;
    }
  }

  return {
    id: `RP-${inc.id.slice(4)}`,
    incidentId: inc.id,
    rootCause: inc.diagnosis?.likelyCause ?? diagnose(inc, wf).likelyCause,
    ...p,
    approved: false,
    originalPayload: original,
    proposedPayload: proposed,
    operations: ops,
    checks: checksTemplate(),
    status: "draft",
    createdAt: new Date(at).toISOString(),
  };
}

const typeOf = (v: unknown) => (Array.isArray(v) ? "array" : v === null ? "null" : typeof v);
const ALLOWED_META = new Set(["idempotency_key"]);

/**
 * Independent validation: evaluates the proposal against the workflow schema and rules.
 * It never trusts the proposal's own description.
 */
export function validate(r: RepairProposal, wf: WorkflowSeed, inc: Incident): ValidationCheck[] {
  const schema = wf.inputSchema;
  const p = r.proposedPayload;
  const res: Record<string, Pick<ValidationCheck, "state" | "detail">> = {};

  try {
    const round = JSON.parse(JSON.stringify(p));
    res.json =
      Object.keys(round).length === Object.keys(p).length
        ? {
            state: "passed",
            detail: `${JSON.stringify(p).length} bytes, ${Object.keys(p).length} keys`,
          }
        : { state: "failed", detail: "Lossy serialization" };
  } catch {
    res.json = { state: "failed", detail: "Payload is not serializable" };
  }

  const unknown = Object.keys(p).filter((k) => !(k in schema) && !ALLOWED_META.has(k));
  res.schema = unknown.length
    ? { state: "failed", detail: `Unknown keys: ${unknown.join(", ")}` }
    : { state: "passed", detail: "All keys declared in input schema" };

  const missing = Object.keys(schema).filter(
    (k) => p[k] === undefined || p[k] === "" || p[k] === null,
  );
  res.required = missing.length
    ? { state: "failed", detail: `Missing: ${missing.join(", ")}` }
    : {
        state: "passed",
        detail: `${Object.keys(schema).length}/${Object.keys(schema).length} present`,
      };

  const badTypes = Object.keys(schema).filter((k) => k in p && typeOf(p[k]) !== schema[k]);
  res.types = badTypes.length
    ? {
        state: "failed",
        detail: badTypes.map((k) => `${k}: expected ${schema[k]}, got ${typeOf(p[k])}`).join("; "),
      }
    : { state: "passed", detail: "All values match declared types" };

  const nonPositive = Object.keys(schema).filter(
    (k) => schema[k] === "number" && typeof p[k] === "number" && (p[k] as number) <= 0,
  );
  const discarded = r.operations.filter(
    (o) =>
      o.op === "remove" ||
      (o.op === "replace" && o.from !== undefined && o.from !== null && o.from !== ""),
  );
  res.business =
    nonPositive.length || discarded.length
      ? {
          state: "failed",
          detail: [
            nonPositive.length ? `${nonPositive.join(", ")} must be > 0` : "",
            discarded.length
              ? `Repair overwrites original value at ${discarded.map((o) => o.path).join(", ")}`
              : "",
          ]
            .filter(Boolean)
            .join(". "),
        }
      : { state: "passed", detail: "No data discarded; numeric bounds satisfied" };

  const structural = ["json", "schema", "required", "types"].every(
    (k) => res[k].state === "passed",
  );
  res.output =
    structural && res.business.state === "passed"
      ? { state: "passed", detail: `Dry-run produced ${Object.keys(wf.outputSchema).join(", ")}` }
      : { state: "failed", detail: "Dry-run aborted: upstream checks failed" };

  const priorRetries = inc.attempts.filter((a) => a.action.startsWith("Replay")).length;
  if (priorRetries >= wf.retryPolicy.maxAttempts) {
    res.safety = {
      state: "failed",
      detail: `Retry budget exhausted (${priorRetries}/${wf.retryPolicy.maxAttempts})`,
    };
  } else if (r.requiresApproval && !r.approved) {
    res.safety = {
      state: "review",
      detail: !wf.retryPolicy.idempotent
        ? "Step is non-idempotent — human approval required"
        : "High-risk change — human approval required",
    };
  } else {
    res.safety = {
      state: "passed",
      detail: `Retry ${priorRetries + 1}/${wf.retryPolicy.maxAttempts}${r.approved ? " · approved" : ""}`,
    };
  }

  return r.checks.map((c) => ({ ...c, ...res[c.id] }));
}

export const isEligible = (r: RepairProposal) =>
  r.status !== "rejected" &&
  r.status !== "applied" &&
  r.checks.every((c) => c.state === "passed") &&
  (!r.requiresApproval || r.approved);

/** Deterministic replay outcome. Schema-mismatch seed demonstrates a failed verification. */
export function replay(inc: Incident): { ok: boolean; detail: string; failedStep?: number } {
  if (inc.failureType === "schema_mismatch") {
    return {
      ok: false,
      failedStep: 4,
      detail:
        "Verification failed: enrichment provider returned 422 (domain not resolvable). Key rename was not the root cause.",
    };
  }
  return { ok: true, detail: "Replay completed; read-back matched expected output schema." };
}
