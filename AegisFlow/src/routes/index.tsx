import { createFileRoute, Link } from "@tanstack/react-router";
import {
  Activity,
  AlertTriangle,
  ArrowUpRight,
  CheckCircle2,
  Clock3,
  CreditCard,
  GitBranch,
  ShieldCheck,
  Zap,
} from "lucide-react";
import { useMemo } from "react";
import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { Button } from "@/components/ui/button";
import {
  Panel,
  PageHeader,
  Pill,
  SeverityPill,
  WorkflowStatusPill,
  pct,
} from "@/components/proof/primitives";
import { useStore, workflowStats } from "@/store/store";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Overview — AegisFlow" },
      { name: "description", content: "Self-healing workflow reliability console." },
      { property: "og:title", content: "AegisFlow — Workflow Reliability" },
    ],
  }),
  component: OverviewPage,
});

function OverviewPage() {
  const { state, metrics, actions } = useStore();
  const active = state.incidents.filter((i) => i.status !== "resolved");
  const retryCount = metrics.successfulRecoveries + metrics.failedRecoveries;
  const healingRate = retryCount ? metrics.recoverySuccessRate : 0;
  const chartData = useMemo(() => {
    const now = Date.now();
    return Array.from({ length: 6 }, (_, index) => {
      const start = now - (6 - index) * 4 * 60 * 60 * 1000;
      const bucket = state.executions.filter((execution) => {
        const time = Date.parse(execution.startedAt);
        return time >= start && time < start + 4 * 60 * 60 * 1000;
      });
      return {
        time: index === 5 ? "Now" : new Date(start).toLocaleTimeString([], { hour: "2-digit" }),
        success: bucket.filter((execution) => execution.outcome === "success").length,
        failed: bucket.filter((execution) => execution.outcome === "failed").length,
      };
    });
  }, [state.executions]);
  const cards = [
    {
      label: "Monitored workflows",
      value: metrics.workflowsMonitored,
      note: "Loaded from the backend",
      icon: GitBranch,
      tone: "text-info",
    },
    {
      label: "Active incidents",
      value: metrics.activeIncidents,
      note: `${active.filter((i) => i.severity === "critical" || i.severity === "high").length} high-priority`,
      icon: AlertTriangle,
      tone: "text-warning",
    },
    {
      label: "Verified recoveries",
      value: metrics.successfulRecoveries,
      note: "Successful sandbox replays",
      icon: ShieldCheck,
      tone: "text-success",
    },
    {
      label: "Healing success rate",
      value: pct(healingRate),
      note: retryCount ? "Based on backend retry records" : "No retry records yet",
      icon: Activity,
      tone: "text-primary",
    },
  ];
  return (
    <div className="space-y-5">
      <PageHeader
        title="System overview"
        subtitle="Observe workflow health, diagnose failures, and verify recovery."
        actions={
          <>
            <Link to="/workflows">
              <Button variant="outline">
                <GitBranch className="size-4" /> Create workflow
              </Button>
            </Link>
            <Button onClick={() => document.dispatchEvent(new CustomEvent("aegisflow:simulate"))}>
              <Zap className="size-4" /> Inject chaos
            </Button>
          </>
        }
      />
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {cards.map((c) => (
          <div key={c.label} className="rounded-lg border bg-card p-4">
            <div className="flex items-center justify-between">
              <span className="text-xs text-muted-foreground">{c.label}</span>
              <c.icon className={`size-4 ${c.tone}`} />
            </div>
            <div className="mt-3 text-2xl font-semibold tracking-tight tnum">{c.value}</div>
            <div className="mt-1 text-[11px] text-muted-foreground">{c.note}</div>
          </div>
        ))}
      </div>
      <Panel
        title="Stripe test-mode events"
        description="Verified payment-intent events and local failure simulations. No payment actions are available."
        actions={
          <Pill tone={state.stripeStatus.webhookConfigured ? "success" : "warning"}>
            {state.stripeStatus.webhookConfigured ? "Webhook configured" : "Simulation ready"}
          </Pill>
        }
      >
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-start gap-2 text-xs text-muted-foreground">
            <CreditCard className="mt-0.5 size-4 shrink-0 text-primary" />
            <span>
              Test mode · {state.stripeEvents.length} stored events · financial actions disabled
            </span>
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={() => void actions.simulateStripeFailure()}
            disabled={!!state.busy["stripe-simulation"] || state.loading}
          >
            <Zap className="size-4" />
            {state.busy["stripe-simulation"] || "Simulate Stripe failure"}
          </Button>
        </div>
        {state.stripeEvents.length ? (
          <div className="space-y-2">
            {state.stripeEvents.slice(0, 4).map((event) => (
              <div
                key={event.id}
                className="flex flex-wrap items-center justify-between gap-3 rounded-md border p-3"
              >
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2 text-sm font-medium">
                    <span>{event.type.replaceAll(".", " ")}</span>
                    <Pill
                      tone={
                        event.status === "processed"
                          ? "success"
                          : event.status === "failed"
                            ? "error"
                            : "neutral"
                      }
                    >
                      {event.simulated ? "simulated" : "signed webhook"}
                    </Pill>
                  </div>
                  <div className="mt-1 truncate font-mono text-[10px] text-muted-foreground">
                    {event.id} · {event.paymentIntentId || "No payment intent"}
                    {event.failureCode ? ` · ${event.failureCode}` : ""}
                  </div>
                </div>
                {event.incidentId ? (
                  <Link
                    to="/incidents/$incidentId"
                    params={{ incidentId: event.incidentId }}
                    className="text-xs font-medium text-primary hover:underline"
                  >
                    View incident →
                  </Link>
                ) : (
                  <span className="text-xs text-muted-foreground">{event.status}</span>
                )}
              </div>
            ))}
          </div>
        ) : (
          <div className="rounded-md border border-dashed p-5 text-center text-sm text-muted-foreground">
            No Stripe events recorded. Simulate a test failure to verify incident creation without
            Stripe credentials.
          </div>
        )}
      </Panel>
      <div className="grid gap-4 xl:grid-cols-[1.6fr_1fr]">
        <Panel
          title="Execution volume"
          description="Backend executions grouped into four-hour windows"
          actions={<Pill tone="info">Local sandbox</Pill>}
        >
          {state.executions.length ? (
            <div className="h-[250px] w-full">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={chartData} margin={{ top: 8, right: 8, left: -20, bottom: 0 }}>
                  <defs>
                    <linearGradient id="successFill" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="hsl(160 65% 55%)" stopOpacity={0.24} />
                      <stop offset="95%" stopColor="hsl(160 65% 55%)" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid
                    strokeDasharray="3 3"
                    stroke="hsl(215 18% 28% / .55)"
                    vertical={false}
                  />
                  <XAxis
                    dataKey="time"
                    tick={{ fill: "hsl(215 12% 65%)", fontSize: 11 }}
                    axisLine={false}
                    tickLine={false}
                  />
                  <YAxis
                    tick={{ fill: "hsl(215 12% 65%)", fontSize: 11 }}
                    axisLine={false}
                    tickLine={false}
                  />
                  <Tooltip
                    contentStyle={{
                      background: "hsl(220 22% 13%)",
                      border: "1px solid hsl(215 18% 28%)",
                      borderRadius: 8,
                      fontSize: 12,
                    }}
                  />
                  <Area
                    type="monotone"
                    dataKey="success"
                    name="Successful"
                    stroke="hsl(160 65% 55%)"
                    fill="url(#successFill)"
                    strokeWidth={2}
                  />
                  <Area
                    type="monotone"
                    dataKey="failed"
                    name="Failed"
                    stroke="hsl(0 78% 67%)"
                    fill="transparent"
                    strokeWidth={2}
                  />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          ) : (
            <div className="grid h-[250px] place-items-center text-center text-sm text-muted-foreground">
              No execution data yet. Create and run a workflow or simulate a failure.
            </div>
          )}
          <div className="mt-2 flex gap-4 text-xs text-muted-foreground">
            <span className="flex items-center gap-2">
              <i className="size-2 rounded-full bg-primary" /> Successful
            </span>
            <span className="flex items-center gap-2">
              <i className="size-2 rounded-full bg-error" /> Failed
            </span>
          </div>
        </Panel>
        <Panel title="Healing pipeline" description="The control loop behind each recovery">
          <div className="space-y-3">
            {[
              { n: "01", t: "Observe", d: "Record sandbox execution signals", s: "Backend" },
              { n: "02", t: "Diagnose", d: "Correlate errors and context", s: "Gemini via API" },
              { n: "03", t: "Repair", d: "Propose a constrained patch", s: "Policy gated" },
              { n: "04", t: "Verify", d: "Validate and replay safely", s: "Independent" },
            ].map((x, i) => (
              <div key={x.n} className="flex items-start gap-3">
                <div className="grid size-8 shrink-0 place-items-center rounded-md border bg-elevated font-mono text-xs text-primary">
                  {x.n}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center justify-between gap-2">
                    <div className="text-sm font-medium">{x.t}</div>
                    <span className="text-[10px] text-muted-foreground">{x.s}</span>
                  </div>
                  <div className="mt-0.5 text-xs text-muted-foreground">{x.d}</div>
                </div>
                {i < 3 && <span className="sr-only">Next stage</span>}
              </div>
            ))}
          </div>
          <div className="mt-4 rounded-md border border-primary/20 bg-primary/5 p-3 text-xs text-muted-foreground">
            <ShieldCheck className="mr-2 inline size-4 text-primary" /> Repairs never execute until
            independent checks pass.
          </div>
        </Panel>
      </div>
      <div className="grid gap-4 xl:grid-cols-[1.25fr_1fr]">
        <Panel
          title="Workflow health"
          description="Current status across monitored automations"
          actions={
            <Link to="/workflows" className="text-xs text-primary hover:underline">
              View all <ArrowUpRight className="inline size-3" />
            </Link>
          }
        >
          <div className="overflow-x-auto">
            <table className="w-full min-w-[540px] text-left text-sm">
              <thead>
                <tr className="border-b text-[10px] uppercase tracking-wider text-muted-foreground">
                  <th className="pb-2 font-medium">Workflow</th>
                  <th className="pb-2 font-medium">Integration</th>
                  <th className="pb-2 font-medium">Success</th>
                  <th className="pb-2 font-medium">Status</th>
                </tr>
              </thead>
              <tbody>
                {state.workflows.slice(0, 5).map((w) => (
                  <tr key={w.id} className="border-b last:border-0">
                    <td className="py-3">
                      <div className="font-medium">{w.name}</div>
                      <div className="mt-0.5 font-mono text-[10px] text-muted-foreground">
                        {w.id}
                      </div>
                    </td>
                    <td className="py-3 text-xs text-muted-foreground">{w.integration}</td>
                    <td className="py-3 tnum text-xs">
                      {pct(workflowStats(w.id, state.executions).successRate)}
                    </td>
                    <td className="py-3">
                      <WorkflowStatusPill status={w.status} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Panel>
        <Panel
          title="Incident queue"
          description="Failures that need attention"
          actions={
            <Link to="/incidents" className="text-xs text-primary hover:underline">
              All incidents <ArrowUpRight className="inline size-3" />
            </Link>
          }
        >
          <div className="space-y-3">
            {active.slice(0, 4).map((i) => (
              <Link
                key={i.id}
                to="/incidents/$incidentId"
                params={{ incidentId: i.id }}
                className="block rounded-md border p-3 transition-colors hover:border-primary/40 hover:bg-elevated/50"
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="text-sm font-medium leading-snug">{i.title}</div>
                  <SeverityPill severity={i.severity} />
                </div>
                <div className="mt-2 flex items-center justify-between gap-2 text-[11px] text-muted-foreground">
                  <span className="font-mono">{i.id}</span>
                  <span className="flex items-center gap-1">
                    <Clock3 className="size-3" />
                    {`${Math.max(0, Math.round((Date.now() - Date.parse(i.detectedAt)) / 60000))}m ago`}
                  </span>
                </div>
              </Link>
            ))}
            {active.length === 0 && (
              <div className="py-8 text-center text-sm text-muted-foreground">
                <CheckCircle2 className="mx-auto mb-2 size-6 text-success" />
                No active incidents.
              </div>
            )}
          </div>
        </Panel>
      </div>
    </div>
  );
}
