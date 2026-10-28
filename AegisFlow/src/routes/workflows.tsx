import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import {
  Activity,
  ArrowDown,
  Check,
  CircleDashed,
  Clock3,
  GitBranch,
  Play,
  Plus,
  Sparkles,
  Users,
  Workflow as WorkflowIcon,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Panel, PageHeader, Pill, WorkflowStatusPill, pct } from "@/components/proof/primitives";
import { useStore, workflowStats } from "@/store/store";
import { toast } from "sonner";
import { api, ApiError, type SalesforceLeadReport, type SalesforceStatus } from "@/services/api";

export const Route = createFileRoute("/workflows")({
  head: () => ({ meta: [{ title: "Workflows — AegisFlow" }] }),
  component: WorkflowsPage,
});
type PlanStep = {
  id: string;
  name: string;
  tool: string;
  description: string;
  status: "pending" | "running" | "completed" | "failed";
};

function makePlan(goal: string): PlanStep[] {
  const g = goal.toLowerCase();
  const steps: PlanStep[] = [
    {
      id: "inspect",
      name: "Inspect inputs",
      tool: "inspect_input",
      description: "Read available input and infer its structure.",
      status: "pending",
    },
    {
      id: "validate",
      name: "Validate data",
      tool: "validate_schema",
      description: "Check required fields, types, and business constraints.",
      status: "pending",
    },
  ];
  if (g.includes("lead") || g.includes("customer") || g.includes("priorit"))
    steps.push(
      {
        id: "normalize",
        name: "Normalize records",
        tool: "normalize_records",
        description: "Normalize known aliases and safe formatting differences.",
        status: "pending",
      },
      {
        id: "score",
        name: "Score and classify",
        tool: "score_records",
        description: "Apply deterministic scoring rules to validated records.",
        status: "pending",
      },
    );
  else
    steps.push({
      id: "transform",
      name: "Transform payload",
      tool: "transform_payload",
      description: "Apply the requested transformation using registered tools.",
      status: "pending",
    });
  steps.push(
    {
      id: "verify",
      name: "Verify output",
      tool: "verify_result",
      description: "Check output against the expected result contract.",
      status: "pending",
    },
    {
      id: "report",
      name: "Generate report",
      tool: "generate_report",
      description: "Produce a summary with completed, skipped, and unresolved steps.",
      status: "pending",
    },
  );
  return steps;
}

function WorkflowsPage() {
  const { state, actions } = useStore();
  const [goal, setGoal] = useState(
    "Process these customer leads, validate their information, prioritize the best prospects, and generate a summary report.",
  );
  const [plan, setPlan] = useState<PlanStep[] | null>(null);
  const [running, setRunning] = useState(false);
  const [runId, setRunId] = useState("");
  const [selected, setSelected] = useState<string>(state.workflows[0]?.id ?? "");
  const [creating, setCreating] = useState(false);
  const [salesforceStatus, setSalesforceStatus] = useState<SalesforceStatus>();
  const [salesforceReport, setSalesforceReport] = useState<SalesforceLeadReport>();
  const [salesforceLoading, setSalesforceLoading] = useState(true);
  const [salesforceRunning, setSalesforceRunning] = useState(false);
  const [salesforceError, setSalesforceError] = useState("");
  const selectedWorkflow = state.workflows.find((w) => w.id === selected);
  const activeCount = useMemo(
    () => state.workflows.filter((w) => w.status !== "healthy").length,
    [state.workflows],
  );
  useEffect(() => {
    if (!selected && state.workflows[0]) setSelected(state.workflows[0].id);
  }, [selected, state.workflows]);
  useEffect(() => {
    let active = true;
    api
      .getSalesforceStatus()
      .then((status) => {
        if (active) setSalesforceStatus(status);
      })
      .catch((error: unknown) => {
        if (active)
          setSalesforceError(
            error instanceof Error ? error.message : "Could not check Salesforce configuration.",
          );
      })
      .finally(() => {
        if (active) setSalesforceLoading(false);
      });
    return () => {
      active = false;
    };
  }, []);
  const generate = async () => {
    if (!goal.trim()) {
      toast.error("Describe the workflow goal first.");
      return;
    }
    setCreating(true);
    const steps = makePlan(goal);
    const created = await actions.createWorkflow({
      name: goal.trim().slice(0, 160),
      description: goal.trim(),
      integration: "Local sandbox",
      steps: steps.map(({ id, name, description }) => ({ id, name, description })),
      inputSchema: {},
      outputSchema: {},
      retryPolicy: { maxAttempts: 3, backoff: "exponential", idempotent: false },
    });
    setCreating(false);
    if (!created) return;
    setPlan(steps);
    setRunId(created.id);
    setSelected(created.id);
  };
  const execute = async () => {
    if (!plan || !selectedWorkflow || running) return;
    setRunning(true);
    const execution = await actions.executeWorkflow(selectedWorkflow.id);
    setRunning(false);
    if (execution)
      setPlan(
        plan.map((step, index) => ({
          ...step,
          status:
            execution.outcome === "success"
              ? "completed"
              : index === execution.failedStep
                ? "failed"
                : index < (execution.failedStep ?? 0)
                  ? "completed"
                  : "pending",
        })),
      );
  };
  const runSalesforceReport = async () => {
    setSalesforceRunning(true);
    setSalesforceError("");
    setSalesforceReport(undefined);
    try {
      setSalesforceReport(await api.getSalesforceLeadReport());
    } catch (error) {
      setSalesforceError(
        error instanceof ApiError || error instanceof Error
          ? error.message
          : "Salesforce report could not be completed.",
      );
    } finally {
      setSalesforceRunning(false);
    }
  };
  return (
    <div className="space-y-5">
      <PageHeader
        title="Workflow studio"
        subtitle="Describe the outcome. Generate a plan. Execute through registered tools with observable checkpoints."
        actions={
          <Pill tone="info" icon={Sparkles}>
            Deterministic planner
          </Pill>
        }
      />
      <div className="grid gap-4 xl:grid-cols-[1.1fr_.9fr]">
        <Panel
          title="Create a workflow"
          description="Describe the goal to create a durable workflow record, then execute it in the local backend sandbox."
        >
          <label className="mb-2 block text-xs font-medium text-muted-foreground" htmlFor="goal">
            Workflow objective
          </label>
          <Textarea
            id="goal"
            value={goal}
            onChange={(e) => setGoal(e.target.value)}
            className="min-h-28 resize-y"
            placeholder="Describe the task you want the workflow to complete..."
          />
          <div className="mt-3 flex flex-wrap gap-2">
            <Button onClick={generate} disabled={creating || state.loading}>
              <Sparkles className="size-4" />
              {creating ? "Creating…" : "Create workflow"}
            </Button>
            <Button
              variant="outline"
              onClick={() => {
                setGoal(
                  "Validate an invoice payload, check required fields, retry transient API errors safely, and produce an audit summary.",
                );
                setPlan(null);
              }}
            >
              Use example
            </Button>
          </div>
          <div className="mt-4 rounded-md border border-dashed p-3 text-xs text-muted-foreground">
            <span className="font-medium text-foreground">Execution boundary:</span> Created
            workflows are stored by the backend. Execution and failure simulation remain local
            sandbox operations; no external connector is invoked.
          </div>
        </Panel>
        <Panel title="Execution controls" description="Run status and environment summary">
          <div className="grid grid-cols-2 gap-3">
            <div className="rounded-md border p-3">
              <div className="text-xs text-muted-foreground">Monitored workflows</div>
              <div className="mt-2 text-2xl font-semibold tnum">{state.workflows.length}</div>
            </div>
            <div className="rounded-md border p-3">
              <div className="text-xs text-muted-foreground">Needs attention</div>
              <div className="mt-2 text-2xl font-semibold tnum">{activeCount}</div>
            </div>
          </div>
          <div className="mt-4 space-y-2">
            <label className="text-xs font-medium text-muted-foreground">
              Inspect existing workflow
            </label>
            <select
              value={selected}
              onChange={(e) => setSelected(e.target.value)}
              className="h-10 w-full rounded-md border bg-background px-3 text-sm"
            >
              {state.workflows.map((w) => (
                <option key={w.id} value={w.id}>
                  {w.name}
                </option>
              ))}
            </select>
            {selectedWorkflow && (
              <div className="rounded-md border p-3">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-sm font-medium">{selectedWorkflow.name}</span>
                  <WorkflowStatusPill status={selectedWorkflow.status} />
                </div>
                <p className="mt-1 text-xs text-muted-foreground">{selectedWorkflow.description}</p>
                <div className="mt-3 flex items-center justify-between text-xs">
                  <span className="text-muted-foreground">Integration</span>
                  <span>{selectedWorkflow.integration}</span>
                </div>
                <div className="mt-2 flex items-center justify-between text-xs">
                  <span className="text-muted-foreground">Historical success</span>
                  <span className="font-mono">
                    {pct(workflowStats(selectedWorkflow.id, state.executions).successRate)}
                  </span>
                </div>
              </div>
            )}
          </div>
        </Panel>
      </div>
      <Panel
        title="Live Salesforce lead report"
        description="Read-only access to recent, unconverted Salesforce Leads. This does not execute the sandbox workflow or write to Salesforce."
        actions={
          <Pill
            tone={salesforceStatus?.configured ? "success" : salesforceError ? "error" : "warning"}
            icon={Users}
          >
            {salesforceLoading
              ? "Checking connection"
              : salesforceStatus?.configured
                ? "Backend credentials configured"
                : salesforceError
                  ? "Connection status unavailable"
                  : "Setup required"}
          </Pill>
        }
      >
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <p className="max-w-3xl text-xs text-muted-foreground">
            The backend reads only lead name, company, status, and rating. It returns a
            deterministic priority score for this session; fetched records are not saved by
            AegisFlow. Use this only on a trusted local machine.
          </p>
          <Button
            variant="outline"
            onClick={() => void runSalesforceReport()}
            disabled={!salesforceStatus?.configured || salesforceLoading || salesforceRunning}
          >
            <Users className="size-4" />
            {salesforceRunning ? "Reading Salesforce…" : "Run read-only report"}
          </Button>
        </div>
        {!salesforceLoading && !salesforceStatus?.configured && !salesforceError && (
          <p className="mt-3 rounded-md border border-dashed p-3 text-xs text-muted-foreground">
            {salesforceStatus?.detail ||
              "Configure Salesforce OAuth credentials in the backend environment. Do not put credentials in the browser or chat."}
          </p>
        )}
        {salesforceError && (
          <p
            role="alert"
            className="mt-3 rounded-md border border-error/30 bg-error/5 p-3 text-xs text-error"
          >
            {salesforceError}
          </p>
        )}
        {salesforceReport && (
          <div className="mt-4 space-y-3">
            <div className="flex flex-wrap gap-3 text-xs text-muted-foreground">
              <span>{salesforceReport.recordsRead} records read</span>
              <span>{salesforceReport.validCount} valid</span>
              <span>{salesforceReport.needsReview} need review</span>
              <Pill tone="info">Not saved · no write actions</Pill>
            </div>
            {salesforceReport.leads.length ? (
              <div className="overflow-x-auto">
                <table className="w-full min-w-[640px] text-left text-xs">
                  <thead>
                    <tr className="border-b text-[10px] uppercase tracking-wider text-muted-foreground">
                      <th className="pb-2 font-medium">Lead</th>
                      <th className="pb-2 font-medium">Status</th>
                      <th className="pb-2 font-medium">Rating</th>
                      <th className="pb-2 font-medium">Priority</th>
                      <th className="pb-2 font-medium">Reason</th>
                    </tr>
                  </thead>
                  <tbody>
                    {salesforceReport.leads.map((lead, index) => (
                      <tr key={`${lead.company}-${lead.name}-${index}`} className="border-b">
                        <td className="py-2">
                          <div className="font-medium">{lead.name}</div>
                          <div className="text-muted-foreground">{lead.company}</div>
                        </td>
                        <td className="py-2">{lead.status}</td>
                        <td className="py-2">{lead.rating}</td>
                        <td className="py-2">
                          {lead.priority} · {lead.score}
                        </td>
                        <td className="py-2 text-muted-foreground">{lead.reasons.join(" ")}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <p className="rounded-md border border-dashed p-4 text-sm text-muted-foreground">
                No valid leads were returned in this report.
              </p>
            )}
            {salesforceReport.validationIssues.length > 0 && (
              <div className="rounded-md border border-warning/30 bg-warning/5 p-3 text-xs">
                {salesforceReport.validationIssues.map((issue) => (
                  <p key={issue.recordNumber}>
                    Record {issue.recordNumber} needs review: missing{" "}
                    {issue.missingFields.join(", ")}.
                  </p>
                ))}
              </div>
            )}
          </div>
        )}
      </Panel>
      {state.loading && (
        <Panel
          title="Loading workflows"
          description="Retrieving backend workflow and execution data."
        />
      )}
      {!state.loading && state.workflows.length === 0 && (
        <Panel title="No workflows yet" description="Create a workflow to add it to the backend." />
      )}
      {plan && (
        <Panel
          title="Execution plan"
          description={`Workflow: ${runId} · ${plan.length} steps`}
          actions={
            <Button
              size="sm"
              onClick={execute}
              disabled={
                running ||
                !selectedWorkflow ||
                !!state.busy[selectedWorkflow?.id || ""] ||
                plan.every((s) => s.status === "completed")
              }
            >
              <Play className="size-3.5" />
              {running ? "Running…" : "Run workflow"}
            </Button>
          }
        >
          <div className="mb-4 flex flex-wrap gap-2">
            <Pill tone="neutral" icon={GitBranch}>
              Sequential DAG
            </Pill>
            <Pill tone="info">Sandbox simulation</Pill>
            <Pill tone={plan.every((s) => s.status === "completed") ? "success" : "neutral"}>
              {plan.filter((s) => s.status === "completed").length}/{plan.length} completed
            </Pill>
          </div>
          <div className="space-y-2">
            {plan.map((s, i) => (
              <div key={s.id}>
                <div
                  className={`flex items-start gap-3 rounded-lg border p-3 ${s.status === "running" ? "border-primary/60 bg-primary/5" : s.status === "completed" ? "border-success/30" : ""}`}
                >
                  <div className="grid size-8 shrink-0 place-items-center rounded-md border bg-elevated font-mono text-xs">
                    {s.status === "completed" ? (
                      <Check className="size-4 text-success" />
                    ) : s.status === "running" ? (
                      <Activity className="size-4 animate-pulse text-primary" />
                    ) : (
                      <CircleDashed className="size-4 text-muted-foreground" />
                    )}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="text-sm font-medium">{s.name}</span>
                      <Pill
                        tone={
                          s.status === "completed"
                            ? "success"
                            : s.status === "running"
                              ? "info"
                              : "neutral"
                        }
                      >
                        {s.status}
                      </Pill>
                    </div>
                    <p className="mt-1 text-xs text-muted-foreground">{s.description}</p>
                    <code className="mt-2 inline-block rounded bg-elevated px-2 py-1 text-[10px] text-primary">
                      {s.tool}()
                    </code>
                  </div>
                  <span className="font-mono text-[10px] text-muted-foreground">
                    STEP {String(i + 1).padStart(2, "0")}
                  </span>
                </div>
                {i < plan.length - 1 && (
                  <div className="flex h-5 items-center pl-6">
                    <ArrowDown className="size-3.5 text-muted-foreground" />
                  </div>
                )}
              </div>
            ))}
          </div>
          {plan.every((s) => s.status === "completed") && (
            <div className="mt-4 rounded-md border border-success/30 bg-success/5 p-3 text-sm">
              <Check className="mr-2 inline size-4 text-success" />
              Backend recorded a successful sandbox outcome. Individual tool functions and external
              integrations are not executed.
            </div>
          )}
        </Panel>
      )}
      <Panel
        title="Monitored workflows"
        description="Existing workflow definitions and reliability signals"
      >
        <div className="overflow-x-auto">
          <table className="w-full min-w-[650px] text-left text-sm">
            <thead>
              <tr className="border-b text-[10px] uppercase tracking-wider text-muted-foreground">
                <th className="pb-2 font-medium">Workflow</th>
                <th className="pb-2 font-medium">Steps</th>
                <th className="pb-2 font-medium">Retry policy</th>
                <th className="pb-2 font-medium">Last run</th>
                <th className="pb-2 font-medium">Status</th>
              </tr>
            </thead>
            <tbody>
              {state.workflows.map((w) => {
                const lastRun = workflowStats(w.id, state.executions).last;
                return (
                  <tr key={w.id} className="border-b last:border-0">
                    <td className="py-3">
                      <div className="font-medium">{w.name}</div>
                      <div className="text-[10px] text-muted-foreground">{w.integration}</div>
                    </td>
                    <td className="py-3 text-xs">{w.steps.length} steps</td>
                    <td className="py-3 text-xs text-muted-foreground">
                      {w.retryPolicy.maxAttempts} attempts · {w.retryPolicy.backoff}
                    </td>
                    <td className="py-3 text-xs text-muted-foreground">
                      <Clock3 className="mr-1 inline size-3" />
                      {lastRun
                        ? `${new Date(lastRun.startedAt).toLocaleString()} · ${lastRun.outcome}`
                        : "No runs"}
                    </td>
                    <td className="py-3">
                      <WorkflowStatusPill status={w.status} />
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </Panel>
    </div>
  );
}
