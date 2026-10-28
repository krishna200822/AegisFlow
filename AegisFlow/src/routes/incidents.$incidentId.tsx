import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo } from "react";
import {
  AlertTriangle,
  ArrowLeft,
  CheckCircle2,
  ClipboardCheck,
  FileSearch,
  GitBranch,
  ShieldCheck,
  Sparkles,
  Wrench,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Panel,
  PageHeader,
  Pill,
  IncidentStatusPill,
  SeverityPill,
  WorkflowStatusPill,
} from "@/components/proof/primitives";
import { useStore } from "@/store/store";

export const Route = createFileRoute("/incidents/$incidentId")({
  head: () => ({ meta: [{ title: "Incident detail — AegisFlow" }] }),
  component: IncidentDetailPage,
});
function IncidentDetailPage() {
  const { incidentId } = Route.useParams();
  const { state, actions } = useStore();
  const incident = state.incidents.find((i) => i.id === incidentId);
  const workflow = state.workflows.find((w) => w.id === incident?.workflowId);
  const repair = state.repairs.find((r) => r.id === incident?.repairId);
  const stripeEvent = state.stripeEvents.find((event) => event.incidentId === incidentId);
  const isStripePaymentFailure = incident?.failureType === "payment_failed";
  const busy = state.busy[incidentId] || state.busy[repair?.id || ""];
  const relatedLogs = useMemo(
    () =>
      state.logs.filter(
        (l) => l.incidentId === incidentId || l.executionId === incident?.executionId,
      ),
    [state.logs, incidentId, incident?.executionId],
  );
  if ((!incident || !workflow) && state.loading)
    return (
      <PageHeader
        title="Loading incident"
        subtitle="Retrieving incident details from the backend."
      />
    );
  if (!incident || !workflow)
    return (
      <div className="space-y-4">
        <PageHeader
          title="Incident not found"
          subtitle="This incident may have been cleared by a demo reset."
        />
        <Link to="/incidents" className="text-sm text-primary">
          ← Back to incidents
        </Link>
      </div>
    );
  const runAnalysis = async () => {
    await actions.analyzeIncident(incident.id);
  };
  const makeRepair = async () => {
    await actions.proposeRepair(incident.id);
  };
  return (
    <div className="space-y-5">
      <Link
        to="/incidents"
        className="inline-flex items-center gap-2 text-xs text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="size-3.5" /> Incident register
      </Link>
      <PageHeader
        title={incident.title}
        subtitle={`${incident.id} · ${workflow.name} · Execution ${incident.executionId}`}
        actions={
          <>
            <SeverityPill severity={incident.severity} />
            <IncidentStatusPill status={incident.status} />
          </>
        }
      />
      <div className="grid gap-4 xl:grid-cols-[1.15fr_.85fr]">
        <Panel title="Failure evidence" description="Captured error and original input">
          <div className="rounded-md border border-error/25 bg-error/5 p-3">
            <div className="flex items-start gap-2">
              <AlertTriangle className="mt-0.5 size-4 shrink-0 text-error" />
              <div>
                <div className="text-xs font-semibold text-error">Execution failed</div>
                <p className="mt-1 text-sm">{incident.errorMessage}</p>
              </div>
            </div>
          </div>
          <div className="mt-4">
            <div className="mb-2 text-xs font-medium text-muted-foreground">
              Original payload · immutable source
            </div>
            <pre className="max-h-64 overflow-auto rounded-md border bg-elevated p-3 text-xs leading-5">
              {JSON.stringify(incident.payload, null, 2)}
            </pre>
          </div>
          {isStripePaymentFailure && (
            <div className="mt-4 rounded-md border border-primary/25 bg-primary/5 p-3">
              <div className="flex items-center justify-between gap-2">
                <div className="text-xs font-semibold">Stripe test-mode event</div>
                <Pill tone={stripeEvent?.simulated ? "warning" : "success"}>
                  {stripeEvent?.simulated ? "Simulated" : "Signed webhook"}
                </Pill>
              </div>
              <div className="mt-2 space-y-1 font-mono text-[11px] text-muted-foreground">
                <div>
                  Event:{" "}
                  {stripeEvent?.id || String(incident.payload.stripeEventId || "Unavailable")}
                </div>
                <div>
                  PaymentIntent: {String(incident.payload.paymentIntentId || "Unavailable")}
                </div>
                <div>
                  Amount: {String(incident.payload.amount ?? "Unknown")} minor units{" "}
                  {String(incident.payload.currency || "").toUpperCase()}
                </div>
                <div>Failure code: {String(incident.payload.failureCode || "Not supplied")}</div>
              </div>
              <p className="mt-2 text-xs text-muted-foreground">
                This event only creates an incident. AegisFlow never charges, retries, refunds, or
                changes payment state.
              </p>
            </div>
          )}
          <div className="mt-4 grid grid-cols-2 gap-3">
            <div className="rounded-md border p-3">
              <div className="text-[10px] uppercase text-muted-foreground">Workflow status</div>
              <div className="mt-2">
                <WorkflowStatusPill status={workflow.status} />
              </div>
            </div>
            <div className="rounded-md border p-3">
              <div className="text-[10px] uppercase text-muted-foreground">Execution step</div>
              <div className="mt-2 text-sm font-medium">
                {workflow.steps[
                  incident.failureType === "rate_limit" || incident.failureType === "timeout"
                    ? 3
                    : 1
                ]?.name || "Unknown step"}
              </div>
            </div>
          </div>
        </Panel>
        <Panel
          title="LLM diagnostics"
          description="Gemini requests run through the backend; a labeled deterministic fallback is used if unavailable."
          actions={
            <Pill
              tone={
                !incident.diagnosis
                  ? "neutral"
                  : incident.diagnosis.source === "gemini"
                    ? "success"
                    : "warning"
              }
            >
              {!incident.diagnosis
                ? "Not analyzed"
                : incident.diagnosis.source === "gemini"
                  ? "Gemini"
                  : "Backend rules"}
            </Pill>
          }
        >
          {incident.diagnosis ? (
            <div className="space-y-4">
              <div>
                <div className="text-xs text-muted-foreground">Likely root cause</div>
                <p className="mt-1 text-sm font-medium">{incident.diagnosis.likelyCause}</p>
                <div className="mt-2 flex items-center gap-2">
                  <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-elevated">
                    <div
                      className="h-full rounded-full bg-primary"
                      style={{ width: `${incident.diagnosis.confidence * 100}%` }}
                    />
                  </div>
                  <span className="font-mono text-xs">
                    {Math.round(incident.diagnosis.confidence * 100)}%{" "}
                    {incident.diagnosis.source === "gemini"
                      ? "model confidence"
                      : "rule-based confidence"}
                  </span>
                </div>
              </div>
              <div>
                <div className="mb-2 text-xs font-medium text-muted-foreground">
                  Supporting evidence
                </div>
                <ul className="space-y-2">
                  {incident.diagnosis.evidence.map((e, i) => (
                    <li key={i} className="flex gap-2 text-xs">
                      <CheckCircle2 className="mt-0.5 size-3.5 shrink-0 text-success" />
                      {e}
                    </li>
                  ))}
                </ul>
              </div>
              <div className="rounded-md border bg-elevated/50 p-3">
                <div className="text-xs font-medium">Recommended next step</div>
                <p className="mt-1 text-xs text-muted-foreground">{incident.diagnosis.nextStep}</p>
              </div>
              <div>
                <div className="mb-1 text-xs font-medium text-muted-foreground">
                  Alternative explanations
                </div>
                {incident.diagnosis.alternatives.map((a) => (
                  <div key={a} className="text-xs text-muted-foreground">
                    • {a}
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <div className="py-5 text-center">
              <FileSearch className="mx-auto size-8 text-muted-foreground" />
              <p className="mt-2 text-sm font-medium">No diagnosis yet</p>
              <p className="mt-1 text-xs text-muted-foreground">
                Analyze the captured logs and payload to identify a likely cause.
              </p>
              <Button className="mt-4" onClick={runAnalysis} disabled={!!busy}>
                <Sparkles className="size-4" />
                {busy || "Analyze incident"}
              </Button>
            </div>
          )}
          <div className="mt-4 flex flex-wrap gap-2">
            {!incident.diagnosis && (
              <Button variant="outline" onClick={runAnalysis} disabled={!!busy}>
                <Sparkles className="size-4" /> Analyze
              </Button>
            )}
            {!isStripePaymentFailure && (
              <Button onClick={makeRepair} disabled={!!busy || incident.status === "resolved"}>
                <Wrench className="size-4" />
                {repair ? "Refresh repair proposal" : "Propose repair"}
              </Button>
            )}
          </div>
          {isStripePaymentFailure && (
            <div className="mt-4 rounded-md border border-dashed p-3 text-xs text-muted-foreground">
              Payment failures are reported for investigation only. Repair and replay actions are
              intentionally unavailable for Stripe payment incidents.
            </div>
          )}
        </Panel>
      </div>
      <div className="grid gap-4 xl:grid-cols-2">
        <Panel
          title="Recovery attempts"
          description="Every action is recorded in the incident history"
        >
          {incident.attempts.length ? (
            <div className="space-y-3">
              {incident.attempts.map((a) => (
                <div key={a.id} className="flex gap-3 border-b pb-3 last:border-0 last:pb-0">
                  <div
                    className={`mt-1 size-2 shrink-0 rounded-full ${a.outcome === "success" ? "bg-success" : a.outcome === "failed" || a.outcome === "rejected" ? "bg-error" : "bg-warning"}`}
                  />
                  <div className="min-w-0 flex-1">
                    <div className="flex justify-between gap-2 text-sm font-medium">
                      <span>{a.action}</span>
                      <span className="font-mono text-[10px] text-muted-foreground">
                        {new Date(a.at).toLocaleTimeString()}
                      </span>
                    </div>
                    <p className="mt-1 text-xs text-muted-foreground">{a.detail}</p>
                  </div>
                  <Pill
                    tone={
                      a.outcome === "success"
                        ? "success"
                        : a.outcome === "failed" || a.outcome === "rejected"
                          ? "error"
                          : "warning"
                    }
                  >
                    {a.outcome}
                  </Pill>
                </div>
              ))}
            </div>
          ) : (
            <div className="py-6 text-center text-sm text-muted-foreground">
              No recovery attempts recorded yet.
            </div>
          )}
        </Panel>
        <Panel
          title="Structured log collector"
          description={`${relatedLogs.length} related log entries`}
          actions={
            <Link to="/logs" className="text-xs text-primary">
              Open log explorer →
            </Link>
          }
        >
          {relatedLogs.slice(0, 6).map((l) => (
            <div key={l.id} className="flex gap-3 border-b py-2 last:border-0">
              <span
                className={`w-12 shrink-0 font-mono text-[10px] ${l.level === "ERROR" ? "text-error" : l.level === "WARN" ? "text-warning" : "text-muted-foreground"}`}
              >
                {l.level}
              </span>
              <div className="min-w-0">
                <div className="font-mono text-[10px] text-primary">{l.event}</div>
                <p className="mt-1 break-words text-xs text-muted-foreground">{l.message}</p>
              </div>
            </div>
          ))}
        </Panel>
      </div>
      <Panel
        title="Historical memory & similar failures"
        description="Backend incident records grouped by failure signature"
      >
        {state.incidents.filter(
          (other) => other.id !== incident.id && other.failureType === incident.failureType,
        ).length > 0 ? (
          <div className="space-y-2">
            {state.incidents
              .filter(
                (other) => other.id !== incident.id && other.failureType === incident.failureType,
              )
              .slice(0, 4)
              .map((other) => (
                <Link
                  key={other.id}
                  to="/incidents/$incidentId"
                  params={{ incidentId: other.id }}
                  className="flex items-center justify-between gap-3 rounded-md border p-3 hover:border-primary/40"
                >
                  <div className="min-w-0">
                    <div className="truncate text-sm font-medium">{other.title}</div>
                    <div className="mt-1 text-[10px] text-muted-foreground">
                      {other.id} · {other.failureType.replaceAll("_", " ")}
                    </div>
                  </div>
                  <Pill tone={other.status === "resolved" ? "success" : "warning"}>
                    {other.status === "resolved" ? "Resolved" : "Open"}
                  </Pill>
                </Link>
              ))}
          </div>
        ) : (
          <div className="text-sm text-muted-foreground">
            No matching historical incidents are available yet.
          </div>
        )}
        <div className="mt-3 rounded-md border border-dashed p-3 text-xs text-muted-foreground">
          Similar incidents are matched by the recorded failure type; no external system is queried.
        </div>
      </Panel>
      <div className="flex flex-wrap gap-2">
        {incident.status !== "resolved" && (
          <>
            <Button
              variant="outline"
              onClick={() => actions.requestManualReview(incident.id)}
              disabled={!!busy}
            >
              Escalate to on-call
            </Button>
            <Button
              variant="outline"
              onClick={() => actions.resolveIncident(incident.id)}
              disabled={!!busy}
            >
              Resolve manually
            </Button>
          </>
        )}
      </div>
      {repair && !isStripePaymentFailure && (
        <Panel
          title="Repair proposal"
          description={`Repair ${repair.id} · ${repair.status}`}
          actions={
            <Link to="/repair" className="text-xs text-primary">
              Open Repair Center →
            </Link>
          }
        >
          <div className="grid gap-3 md:grid-cols-3">
            <div className="rounded-md border p-3">
              <div className="text-xs text-muted-foreground">Change</div>
              <div className="mt-1 text-sm font-medium">{repair.summary}</div>
              <div className="mt-1 text-xs text-muted-foreground">{repair.modification}</div>
            </div>
            <div className="rounded-md border p-3">
              <div className="text-xs text-muted-foreground">Blast radius</div>
              <div className="mt-1 text-2xl font-semibold">
                {repair.requiresApproval ? "High" : "Low"}
              </div>
              <div className="text-xs text-muted-foreground">
                {repair.requiresApproval ? "Human approval required" : "Single workflow scope"}
              </div>
            </div>
            <div className="rounded-md border p-3">
              <div className="text-xs text-muted-foreground">Validation checks</div>
              <div className="mt-1 text-2xl font-semibold">
                {repair.checks.filter((c) => c.state === "passed").length}/{repair.checks.length}
              </div>
              <div className="text-xs text-muted-foreground">Passed checks</div>
            </div>
          </div>
          <div className="mt-4 flex flex-wrap gap-2">
            <Button
              variant="outline"
              onClick={() => actions.validateRepair(repair.id)}
              disabled={!!state.busy[repair.id]}
            >
              <ClipboardCheck className="size-4" /> Validate repair
            </Button>
            {!repair.approved && (
              <Button
                variant="outline"
                onClick={() => actions.approveRepair(repair.id)}
                disabled={!!state.busy[repair.id]}
              >
                Approve
              </Button>
            )}
            <Button
              onClick={() => actions.applyRepairAndRetry(repair.id)}
              disabled={
                !!state.busy[repair.id] ||
                repair.status !== "validated" ||
                !repair.approved ||
                repair.checks.some((c) => c.state === "failed")
              }
            >
              <ShieldCheck className="size-4" /> Apply & replay
            </Button>
            <Button
              variant="destructive"
              onClick={() => actions.rejectRepair(repair.id)}
              disabled={
                !!state.busy[repair.id] ||
                repair.status === "applied" ||
                repair.status === "rejected"
              }
            >
              Reject repair
            </Button>
          </div>
        </Panel>
      )}
    </div>
  );
}
