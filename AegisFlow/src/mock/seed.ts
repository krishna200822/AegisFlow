import type { Incident, LogEntry, RepairProposal, TimelineEvent, WorkflowExecution } from "@/types";
import { BASE_TIME, minutesAgo } from "@/lib/time";
import { WORKFLOW_SEEDS } from "./workflows";
import { brokenPayload, diagnose, ev, propose } from "@/services/engine";

function mulberry32(a: number) {
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** 24h of illustrative execution history, deterministic. */
function genExecutions(): WorkflowExecution[] {
  const rand = mulberry32(42);
  const out: WorkflowExecution[] = [];
  for (const wf of WORKFLOW_SEEDS) {
    const total = Math.max(2, Math.round(wf.runsPerHour * 24));
    for (let i = 0; i < total; i++) {
      const minAgo = Math.floor((i / total) * 1440 + rand() * (1440 / total));
      const ok = rand() < wf.successRate;
      out.push({
        id: `exe_${wf.id.slice(3, 6)}${(1000 + i).toString(16)}`,
        workflowId: wf.id,
        startedAt: minutesAgo(1440 - minAgo),
        durationMs: Math.round(400 + rand() * 2600 + (ok ? 0 : 2000)),
        outcome: ok ? "success" : "failed",
        failedStep: ok ? undefined : 1 + Math.floor(rand() * 3),
      });
    }
  }
  // 20 historical recovery replays, 18 successful (illustrative).
  const retryWfs = ["wf-cds-01", "wf-lep-02", "wf-inv-03", "wf-iua-04", "wf-ndp-05"];
  for (let i = 0; i < 20; i++) {
    const ok = i !== 6 && i !== 13;
    out.push({
      id: `exe_rty${(200 + i).toString(16)}`,
      workflowId: retryWfs[i % retryWfs.length],
      startedAt: minutesAgo(1380 - i * 68),
      durationMs: 900 + i * 37,
      outcome: ok ? "success" : "failed",
      failedStep: ok ? undefined : 4,
      isRetry: true,
    });
  }
  return out.sort((a, b) => a.startedAt.localeCompare(b.startedAt));
}

const wfBy = (id: string) => WORKFLOW_SEEDS.find((w) => w.id === id)!;

function resolved(
  n: number,
  wfId: string,
  type: Incident["failureType"],
  sev: Incident["severity"],
  minAgo: number,
  owner: string,
  msg: string,
): Incident {
  const wf = wfBy(wfId);
  const id = `INC-${n}`;
  const inc: Incident = {
    id,
    workflowId: wfId,
    failureType: type,
    severity: sev,
    status: "resolved",
    detectedAt: minutesAgo(minAgo),
    updatedAt: minutesAgo(minAgo - 9),
    title: msg,
    description: msg,
    errorMessage: msg,
    executionId: `exe_${wfId.slice(3, 6)}h${n}`,
    owner,
    payload: brokenPayload(type, wf),
    attempts: [],
  };
  inc.diagnosis = diagnose(inc, wf);
  inc.attempts = [
    { id: `${id}-a1`, incidentId: id, at: minutesAgo(minAgo - 4), action: "Repair validated", outcome: "success", detail: "7/7 checks passed" },
    { id: `${id}-a2`, incidentId: id, at: minutesAgo(minAgo - 9), action: "Replay #1", outcome: "success", detail: "Recovery verified" },
  ];
  return inc;
}

export function buildSeed() {
  const executions = genExecutions();

  const historic: Incident[] = [
    resolved(1036, "wf-cds-01", "missing_field", "high", 1210, "auto · validated", "Payload validation failed: required field `customer_id` was not found."),
    resolved(1037, "wf-inv-03", "timeout", "critical", 905, "approved · d.chen", "Request timed out after 30000 ms on NetSuite bill post."),
    resolved(1038, "wf-iua-04", "invalid_type", "medium", 640, "manual · a.ruiz", "Type error: `quantity` expected number, received string."),
    resolved(1039, "wf-ndp-05", "rate_limit", "medium", 420, "auto · validated", "HTTP 429 Too Many Requests from Twilio."),
    resolved(1040, "wf-lep-02", "schema_mismatch", "high", 300, "auto · validated", "Schema mismatch on Clearbit enrichment response."),
  ];

  // Active 1: schema mismatch with a repair that passes validation but fails verification on replay.
  const lep = wfBy("wf-lep-02");
  const a1: Incident = {
    id: "INC-1041",
    workflowId: lep.id,
    failureType: "schema_mismatch",
    severity: "high",
    status: "repair_proposed",
    detectedAt: minutesAgo(48),
    updatedAt: minutesAgo(41),
    title: "Schema mismatch in Lead Enrichment Pipeline",
    description: "Execution exe_lep7a1 failed at \"Validate required fields\". Payload uses `email_address` instead of `email`.",
    errorMessage: "Schema mismatch: unexpected key `email_address`; required key missing.",
    executionId: "exe_lep7a1",
    owner: "Unassigned",
    payload: brokenPayload("schema_mismatch", lep),
    attempts: [],
  };
  a1.diagnosis = diagnose(a1, lep);
  a1.repairId = "RP-1041";
  const r1: RepairProposal = propose(a1, lep, Date.parse(minutesAgo(41)));

  // Active 2: rate limit, not yet analyzed.
  const ndp = wfBy("wf-ndp-05");
  const a2: Incident = {
    id: "INC-1042",
    workflowId: ndp.id,
    failureType: "rate_limit",
    severity: "medium",
    status: "open",
    detectedAt: minutesAgo(14),
    updatedAt: minutesAgo(14),
    title: "API rate limit in Notification Delivery Pipeline",
    description: "Execution exe_ndp7b4 failed at \"Write to destination\". Twilio returned HTTP 429.",
    errorMessage: "HTTP 429 Too Many Requests from Twilio (Retry-After: 30s).",
    executionId: "exe_ndp7b4",
    owner: "Unassigned",
    payload: ndp.samplePayload,
    attempts: [],
  };

  const logs: LogEntry[] = [];
  let li = 0;
  const L = (minAgo: number, level: LogEntry["level"], wf: string, exe: string, event: string, message: string, metadata: Record<string, unknown> = {}, incidentId?: string) =>
    logs.push({ id: `log-s${li++}`, timestamp: minutesAgo(minAgo), level, workflowId: wf, executionId: exe, event, message, metadata, incidentId });

  // Sample of routine logs from recent executions.
  executions.slice(-60).forEach((e) => {
    const m = (BASE_TIME - Date.parse(e.startedAt)) / 60000;
    L(m, "INFO", e.workflowId, e.id, "execution.started", "Execution started.", { retry: !!e.isRetry });
    if (e.outcome === "success") L(m - 0.02, "INFO", e.workflowId, e.id, "execution.completed", `Completed in ${e.durationMs} ms.`, { duration_ms: e.durationMs });
    else L(m - 0.02, "WARN", e.workflowId, e.id, "step.retrying", "Transient step failure; handled by native retry.", { step_index: e.failedStep });
  });
  L(48.2, "INFO", lep.id, a1.executionId, "execution.started", "Execution started for Lead Enrichment Pipeline.", { trigger: "HubSpot" });
  L(48.1, "DEBUG", lep.id, a1.executionId, "payload.received", `Received payload with keys: ${Object.keys(a1.payload).join(", ")}.`, { payload: a1.payload });
  L(48, "ERROR", lep.id, a1.executionId, "payload.validation_failed", a1.errorMessage, { step_index: 1, failure_type: "schema_mismatch" }, a1.id);
  L(47.9, "WARN", lep.id, a1.executionId, "incident.opened", "Incident INC-1041 opened (high).", { severity: "high" }, a1.id);
  L(41, "INFO", lep.id, a1.executionId, "repair.proposed", "Repair RP-1041 proposed: map `email_address` to `email`.", { ops: 1 }, a1.id);
  L(14.3, "INFO", ndp.id, a2.executionId, "execution.started", "Execution started for Notification Delivery Pipeline.", { trigger: "Segment" });
  L(14.1, "ERROR", ndp.id, a2.executionId, "step.failed", a2.errorMessage, { status: 429, retry_after_s: 30 }, a2.id);
  L(14, "WARN", ndp.id, a2.executionId, "incident.opened", "Incident INC-1042 opened (medium).", { severity: "medium" }, a2.id);
  historic.forEach((h) => {
    const m = (BASE_TIME - Date.parse(h.detectedAt)) / 60000;
    L(m, "ERROR", h.workflowId, h.executionId, "step.failed", h.errorMessage, { failure_type: h.failureType }, h.id);
    L(m - 9, "INFO", h.workflowId, h.executionId, "recovery.verified", `Incident ${h.id} recovered and verified.`, {}, h.id);
  });
  logs.sort((a, b) => b.timestamp.localeCompare(a.timestamp));

  const timeline: TimelineEvent[] = [
    ev(minutesAgo(300), "detection", "wf-lep-02", "INC-1040", "Failure detected — INC-1040 opened", "error"),
    ev(minutesAgo(291), "recovery", "wf-lep-02", "INC-1040", "Recovery succeeded and verified", "success"),
    ev(minutesAgo(420), "detection", "wf-ndp-05", "INC-1039", "Failure detected — INC-1039 opened", "error"),
    ev(minutesAgo(411), "recovery", "wf-ndp-05", "INC-1039", "Recovery succeeded after backoff retry", "success"),
    ev(minutesAgo(905), "approval", "wf-inv-03", "INC-1037", "Manual approval requested for guarded replay", "warning"),
    ev(minutesAgo(48), "execution", lep.id, undefined, "Execution exe_lep7a1 started", "neutral"),
    ev(minutesAgo(48), "detection", lep.id, a1.id, "Failure detected — INC-1041 opened", "error"),
    ev(minutesAgo(44), "diagnosis", lep.id, a1.id, "Root cause identified (62% heuristic confidence)", "info"),
    ev(minutesAgo(41), "repair", lep.id, a1.id, "Repair RP-1041 proposed: map `email_address` → `email`", "info"),
    ev(minutesAgo(14), "anomaly", ndp.id, a2.id, "Unexpected response: HTTP 429 from Twilio", "warning"),
    ev(minutesAgo(14), "detection", ndp.id, a2.id, "Failure detected — INC-1042 opened", "error"),
  ].sort((a, b) => b.timestamp.localeCompare(a.timestamp));


  return {
    workflows: WORKFLOW_SEEDS,
    executions,
    incidents: [a2, a1, ...historic.reverse()],
    repairs: [r1],
    logs,
    timeline,
  };
}
