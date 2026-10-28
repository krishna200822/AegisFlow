import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import {
  AlertOctagon,
  ArrowRight,
  CheckCircle2,
  ClipboardCheck,
  GitBranch,
  LockKeyhole,
  ShieldCheck,
  ShieldX,
  Wrench,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Panel, PageHeader, Pill, IncidentStatusPill } from "@/components/proof/primitives";
import { useStore } from "@/store/store";
import { toast } from "sonner";

export const Route = createFileRoute("/repair")({
  head: () => ({ meta: [{ title: "Repair Center — AegisFlow" }] }),
  component: RepairCenterPage,
});
function RepairCenterPage() {
  const { state, actions } = useStore();
  const repairs = state.repairs;
  const [selectedId, setSelectedId] = useState(repairs[0]?.id || "");
  const selected = repairs.find((r) => r.id === selectedId) || repairs[0];
  const incident = state.incidents.find((i) => i.id === selected?.incidentId);
  const workflow = state.workflows.find((w) => w.id === incident?.workflowId);
  const unhandled = useMemo(
    () => state.incidents.filter((i) => i.status !== "resolved" && !i.repairId),
    [state.incidents],
  );
  const [target, setTarget] = useState(unhandled[0]?.id || "");
  const risk =
    selected?.risk?.score ??
    (selected ? (selected.requiresApproval ? 78 : selected.risks.length > 1 ? 52 : 24) : 0);
  useEffect(() => {
    if (!selectedId && repairs[0]) setSelectedId(repairs[0].id);
  }, [selectedId, repairs]);
  useEffect(() => {
    if (!target && unhandled[0]) setTarget(unhandled[0].id);
  }, [target, unhandled]);
  const checks = selected?.checks || [];
  const statusSteps = useMemo(
    () => [
      { name: "Failure detected", state: "passed" },
      { name: "Cause identified", state: incident?.diagnosis ? "passed" : "waiting" },
      { name: "Repair proposed", state: selected ? "passed" : "waiting" },
      {
        name: "Safety validation",
        state:
          selected?.status === "validated" || selected?.status === "applied"
            ? "passed"
            : selected?.status === "failed_validation"
              ? "failed"
              : "waiting",
      },
      {
        name: "Workflow replay",
        state:
          selected?.status === "applied"
            ? "passed"
            : selected?.status === "replay_failed"
              ? "failed"
              : "waiting",
      },
      { name: "Recovery verified", state: incident?.status === "resolved" ? "passed" : "waiting" },
    ],
    [incident, selected],
  );
  const createProposal = async () => {
    if (!target) {
      toast.error("Select an incident first.");
      return;
    }
    const id = await actions.proposeRepair(target);
    if (id) setSelectedId(id);
  };
  return (
    <div className="space-y-5">
      <PageHeader
        title="Repair center"
        subtitle="Every repair must pass independent validation before it can execute."
        actions={
          <Pill tone="info" icon={ShieldCheck}>
            Policy-gated recovery
          </Pill>
        }
      />
      <Panel title="Recovery lifecycle" description="Progress for the selected repair">
        <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-6">
          {statusSteps.map((s, i) => (
            <div
              key={s.name}
              className={`rounded-md border p-3 ${s.state === "passed" ? "border-success/30 bg-success/5" : s.state === "failed" ? "border-error/30 bg-error/5" : ""}`}
            >
              <div className="flex items-center justify-between">
                <span className="font-mono text-[10px] text-muted-foreground">0{i + 1}</span>
                {s.state === "passed" ? (
                  <CheckCircle2 className="size-4 text-success" />
                ) : s.state === "failed" ? (
                  <ShieldX className="size-4 text-error" />
                ) : (
                  <span className="size-2 rounded-full bg-muted-foreground/40" />
                )}
              </div>
              <div className="mt-3 text-xs font-medium">{s.name}</div>
              <div className="mt-1 text-[10px] uppercase text-muted-foreground">
                {s.state.replaceAll("_", " ")}
              </div>
            </div>
          ))}
        </div>
      </Panel>
      {!selected && (
        <Panel
          title="Create a repair proposal"
          description="Choose an active incident to diagnose and propose a constrained repair."
        >
          {unhandled.length ? (
            <div className="flex flex-col gap-3 sm:flex-row">
              <select
                className="h-10 flex-1 rounded-md border bg-background px-3 text-sm"
                value={target}
                onChange={(e) => setTarget(e.target.value)}
              >
                <option value="">Select incident…</option>
                {unhandled.map((i) => (
                  <option key={i.id} value={i.id}>
                    {i.id} · {i.title}
                  </option>
                ))}
              </select>
              <Button onClick={createProposal} disabled={!target || !!state.busy[target]}>
                <Wrench className="size-4" /> Propose repair
              </Button>
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">
              {state.loading
                ? "Loading incidents…"
                : "No unresolved incident without a repair proposal is available."}
            </p>
          )}
        </Panel>
      )}
      {selected && incident && (
        <div className="grid gap-4 xl:grid-cols-[1.05fr_.95fr]">
          <Panel
            title="Active repair proposal"
            description={`${selected.id} · ${incident.title}`}
            actions={
              <Pill
                tone={
                  selected.status === "validated" || selected.status === "applied"
                    ? "success"
                    : selected.status === "failed_validation"
                      ? "error"
                      : "warning"
                }
              >
                {selected.status.replaceAll("_", " ")}
              </Pill>
            }
          >
            <div className="mb-4 flex flex-wrap gap-2">
              {repairs.map((r) => (
                <button
                  key={r.id}
                  onClick={() => setSelectedId(r.id)}
                  className={`rounded-md border px-3 py-2 text-xs ${r.id === selected.id ? "border-primary bg-primary/10 text-primary" : "text-muted-foreground hover:text-foreground"}`}
                >
                  {r.id}
                </button>
              ))}
            </div>
            <div className="rounded-md border p-3">
              <div className="text-xs text-muted-foreground">Proposed change</div>
              <div className="mt-1 text-sm font-semibold">{selected.summary}</div>
              <p className="mt-1 text-xs text-muted-foreground">{selected.reason}</p>
              <div className="mt-3 flex flex-wrap gap-2">
                {selected.operations.map((op, i) => (
                  <Pill key={i} tone="info">
                    {op.op} · {op.path}
                  </Pill>
                ))}
              </div>
            </div>
            <div className="mt-4 grid gap-3 md:grid-cols-2">
              <div>
                <div className="mb-2 text-xs font-medium text-muted-foreground">
                  Original payload
                </div>
                <pre className="max-h-64 overflow-auto rounded-md border bg-elevated p-3 text-[11px] leading-5">
                  {JSON.stringify(selected.originalPayload, null, 2)}
                </pre>
              </div>
              <div>
                <div className="mb-2 text-xs font-medium text-muted-foreground">
                  Proposed payload
                </div>
                <pre className="max-h-64 overflow-auto rounded-md border border-primary/25 bg-primary/5 p-3 text-[11px] leading-5">
                  {JSON.stringify(selected.proposedPayload, null, 2)}
                </pre>
              </div>
            </div>
            <div className="mt-4 flex flex-wrap gap-2">
              <Button
                variant="outline"
                onClick={() => actions.validateRepair(selected.id)}
                disabled={!!state.busy[selected.id]}
              >
                <ClipboardCheck className="size-4" /> Validate repair
              </Button>
              {!selected.approved && (
                <Button
                  variant="outline"
                  onClick={() => actions.approveRepair(selected.id)}
                  disabled={!!state.busy[selected.id]}
                >
                  <LockKeyhole className="size-4" /> Approve
                </Button>
              )}
              <Button
                onClick={() => actions.applyRepairAndRetry(selected.id)}
                disabled={
                  !!state.busy[selected.id] ||
                  selected.status !== "validated" ||
                  !selected.approved ||
                  checks.some((c) => c.state === "failed")
                }
              >
                <ArrowRight className="size-4" /> Apply & replay
              </Button>
              <Button
                variant="destructive"
                onClick={() => actions.rejectRepair(selected.id)}
                disabled={
                  !!state.busy[selected.id] ||
                  selected.status === "applied" ||
                  selected.status === "rejected"
                }
              >
                Reject
              </Button>
            </div>
          </Panel>
          <div className="space-y-4">
            <Panel
              title="Blast radius estimator"
              description="Prototype risk estimate based on scope and action type"
            >
              <div className="flex items-end justify-between">
                <div>
                  <div className="text-3xl font-semibold tnum">
                    {risk}
                    <span className="text-base text-muted-foreground">/100</span>
                  </div>
                  <div className="mt-1 text-xs text-muted-foreground">
                    {risk >= 70
                      ? "High risk · approval required"
                      : risk >= 40
                        ? "Moderate risk · review recommended"
                        : "Low risk · constrained change"}
                  </div>
                </div>
                <Pill tone={risk >= 70 ? "error" : risk >= 40 ? "warning" : "success"}>
                  {risk >= 70 ? "High" : risk >= 40 ? "Moderate" : "Low"}
                </Pill>
              </div>
              <div className="mt-3 h-2 overflow-hidden rounded-full bg-elevated">
                <div
                  className={`h-full rounded-full ${risk >= 70 ? "bg-error" : risk >= 40 ? "bg-warning" : "bg-success"}`}
                  style={{ width: `${risk}%` }}
                />
              </div>
              <div className="mt-4 space-y-2 text-xs">
                {[
                  {
                    label: "Scope",
                    value: selected.requiresApproval
                      ? "Potentially non-idempotent"
                      : "Single workflow",
                  },
                  {
                    label: "Reversibility",
                    value: selected.reversible ? "Reversible" : "Needs review",
                  },
                  {
                    label: "Approval",
                    value: selected.requiresApproval
                      ? selected.approved
                        ? "Approved"
                        : "Required"
                      : "Not required",
                  },
                ].map((x) => (
                  <div key={x.label} className="flex justify-between gap-3">
                    <span className="text-muted-foreground">{x.label}</span>
                    <span>{x.value}</span>
                  </div>
                ))}
              </div>
            </Panel>
            <Panel
              title="Independent validation"
              description="Individual checks, not a single opaque score"
            >
              {checks.map((c) => (
                <div key={c.id} className="flex items-start gap-2 border-b py-2 last:border-0">
                  <div className="mt-0.5">
                    {c.state === "passed" ? (
                      <CheckCircle2 className="size-4 text-success" />
                    ) : c.state === "failed" ? (
                      <AlertOctagon className="size-4 text-error" />
                    ) : (
                      <span className="block size-4 rounded-full border" />
                    )}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="text-xs font-medium">{c.name}</div>
                    <div className="mt-0.5 text-[11px] text-muted-foreground">
                      {c.detail || c.description}
                    </div>
                  </div>
                  <span className="text-[10px] uppercase text-muted-foreground">
                    {c.state.replaceAll("_", " ")}
                  </span>
                </div>
              ))}
            </Panel>
            <Panel title="Repair evidence pack" description="Auditable recovery context">
              <div className="space-y-2 text-xs">
                <div className="flex items-center gap-2">
                  <GitBranch className="size-3.5 text-primary" /> Workflow:{" "}
                  {workflow?.name || incident.workflowId}
                </div>
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="size-3.5 text-primary" />{" "}
                  {checks.filter((c) => c.state === "passed").length} validation checks passed
                </div>
                <div className="flex items-center gap-2">
                  <ShieldCheck className="size-3.5 text-primary" /> Replay status:{" "}
                  {selected.status === "applied"
                    ? "Verified"
                    : selected.status === "replay_failed"
                      ? "Failed"
                      : "Not executed"}
                </div>
                <div className="mt-3 rounded-md border border-dashed p-3 text-muted-foreground">
                  Backend-generated validation and replay records. Replay affects only the local
                  sandbox.
                </div>
              </div>
            </Panel>
          </div>
        </div>
      )}
      {selected && (
        <Panel
          title="Other incidents awaiting repair"
          description="Create proposals for unresolved incidents"
        >
          <div className="space-y-2">
            {unhandled
              .filter((i) => i.id !== incident?.id)
              .slice(0, 4)
              .map((i) => (
                <div
                  key={i.id}
                  className="flex flex-wrap items-center justify-between gap-3 rounded-md border p-3"
                >
                  <div>
                    <div className="text-sm font-medium">{i.title}</div>
                    <div className="mt-1 text-xs text-muted-foreground">
                      {i.id} · {i.status.replaceAll("_", " ")}
                    </div>
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={async () => {
                      const id = await actions.proposeRepair(i.id);
                      setSelectedId(id);
                    }}
                  >
                    <Wrench className="size-3.5" /> Propose
                  </Button>
                </div>
              ))}
            {unhandled.length === 0 && (
              <div className="text-sm text-muted-foreground">
                No additional incidents need a repair proposal.
              </div>
            )}
          </div>
        </Panel>
      )}
    </div>
  );
}
