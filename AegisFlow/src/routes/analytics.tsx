import { createFileRoute } from "@tanstack/react-router";
import { useMemo } from "react";
import { Activity, AlertTriangle, CheckCircle2, Clock3, FileText } from "lucide-react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { Button } from "@/components/ui/button";
import { Panel, PageHeader, Pill, pct } from "@/components/proof/primitives";
import { useStore } from "@/store/store";

export const Route = createFileRoute("/analytics")({
  head: () => ({ meta: [{ title: "Healing analytics — AegisFlow" }] }),
  component: AnalyticsPage,
});

const COLORS = [
  "hsl(160 65% 55%)",
  "hsl(0 78% 67%)",
  "hsl(42 90% 65%)",
  "hsl(220 90% 70%)",
  "hsl(280 65% 70%)",
];

function AnalyticsPage() {
  const { state, metrics, actions } = useStore();
  const attempts = state.executions.filter((execution) => execution.isRetry);
  const types = state.clusters.map((cluster) => ({
    name: cluster.name,
    value: cluster.count,
    failureType: cluster.failureType,
  }));
  const hourly = useMemo(() => {
    const now = Date.now();
    const buckets = Array.from({ length: 6 }, (_, index) => ({
      h: `${String(new Date(now - (5 - index) * 4 * 60 * 60 * 1000).getHours().padStart(2, "0"))}:00`,
      success: 0,
      failed: 0,
    }));
    for (const execution of state.executions) {
      const age = now - Date.parse(execution.startedAt);
      if (!Number.isFinite(age) || age < 0 || age >= 24 * 60 * 60 * 1000) continue;
      const bucket = Math.min(5, Math.floor((24 * 60 * 60 * 1000 - age) / (4 * 60 * 60 * 1000)));
      if (execution.outcome === "success") buckets[bucket].success += 1;
      else buckets[bucket].failed += 1;
    }
    return buckets;
  }, [state.executions]);
  const average = state.executions.length
    ? state.executions.reduce((total, execution) => total + execution.durationMs, 0) /
      state.executions.length
    : undefined;
  const latestIncident = state.incidents[0];
  const latestReport = state.postmortems[0];

  return (
    <div className="space-y-5">
      <PageHeader
        title="Healing analytics"
        subtitle="Backend metrics, execution outcomes, failure clusters, and incident post-mortems."
        actions={<Pill tone="info">Local sandbox telemetry</Pill>}
      />
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {[
          {
            label: "Healing success",
            value: attempts.length ? pct(metrics.recoverySuccessRate) : "—",
            note: `${metrics.successfulRecoveries} successful / ${attempts.length} simulated retries`,
            icon: CheckCircle2,
          },
          {
            label: "Active incidents",
            value: metrics.activeIncidents,
            note: "Unresolved backend incidents",
            icon: AlertTriangle,
          },
          {
            label: "Avg. execution time",
            value: average === undefined ? "—" : `${(average / 1000).toFixed(2)}s`,
            note: "Across backend execution records",
            icon: Clock3,
          },
          {
            label: "Execution volume",
            value: metrics.workflowsMonitored ? state.executions.length : "—",
            note: "Stored sandbox executions",
            icon: Activity,
          },
        ].map((card) => (
          <div key={card.label} className="rounded-lg border bg-card p-4">
            <card.icon className="size-4 text-primary" />
            <div className="mt-3 text-xs text-muted-foreground">{card.label}</div>
            <div className="mt-1 text-2xl font-semibold tnum">{card.value}</div>
            <div className="mt-1 text-[10px] text-muted-foreground">{card.note}</div>
          </div>
        ))}
      </div>
      <div className="grid gap-4 xl:grid-cols-[1.35fr_.65fr]">
        <Panel
          title="Execution outcomes · last 24 hours"
          description="Counts from backend execution records"
        >
          {state.executions.length ? (
            <div className="h-[300px]">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={hourly} margin={{ top: 8, right: 8, left: -18, bottom: 0 }}>
                  <CartesianGrid
                    strokeDasharray="3 3"
                    stroke="hsl(215 18% 28% / .55)"
                    vertical={false}
                  />
                  <XAxis
                    dataKey="h"
                    tick={{ fill: "hsl(215 12% 65%)", fontSize: 11 }}
                    axisLine={false}
                    tickLine={false}
                  />
                  <YAxis
                    tick={{ fill: "hsl(215 12% 65%)", fontSize: 11 }}
                    axisLine={false}
                    tickLine={false}
                    allowDecimals={false}
                  />
                  <Tooltip
                    contentStyle={{
                      background: "hsl(220 22% 13%)",
                      border: "1px solid hsl(215 18% 28%)",
                      borderRadius: 8,
                      fontSize: 12,
                    }}
                  />
                  <Bar
                    dataKey="success"
                    name="Successful"
                    fill="hsl(160 65% 55%)"
                    radius={[3, 3, 0, 0]}
                  />
                  <Bar dataKey="failed" name="Failed" fill="hsl(0 78% 67%)" radius={[3, 3, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          ) : (
            <div className="grid h-[300px] place-items-center text-center text-sm text-muted-foreground">
              No backend execution records yet. Run a workflow or simulate a failure to populate
              analytics.
            </div>
          )}
        </Panel>
        <Panel title="Failure clusters" description="Counts from the backend cluster endpoint">
          {types.length ? (
            <>
              <div className="h-[220px]">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={types}
                      dataKey="value"
                      nameKey="name"
                      innerRadius={52}
                      outerRadius={78}
                      paddingAngle={3}
                    >
                      {types.map((type, index) => (
                        <Cell key={type.failureType} fill={COLORS[index % COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip
                      contentStyle={{
                        background: "hsl(220 22% 13%)",
                        border: "1px solid hsl(215 18% 28%)",
                        borderRadius: 8,
                        fontSize: 12,
                      }}
                    />
                  </PieChart>
                </ResponsiveContainer>
              </div>
              <div className="space-y-2">
                {types.map((type, index) => (
                  <div key={type.failureType} className="flex items-center justify-between text-xs">
                    <span className="flex items-center gap-2">
                      <i
                        className="size-2 rounded-full"
                        style={{ background: COLORS[index % COLORS.length] }}
                      />
                      {type.name}
                    </span>
                    <span className="font-mono">{type.value}</span>
                  </div>
                ))}
              </div>
            </>
          ) : (
            <div className="py-12 text-center text-sm text-muted-foreground">
              No failure clusters yet.
            </div>
          )}
        </Panel>
      </div>
      <div className="grid gap-4 md:grid-cols-2">
        <Panel title="Failure clusters" description="Backend-grouped incident signatures">
          {types.length ? (
            <div className="space-y-3">
              {types.map((type) => (
                <div
                  key={type.failureType}
                  className="flex items-center justify-between gap-3 rounded-md border p-3"
                >
                  <div>
                    <div className="text-sm font-medium">{type.name}</div>
                    <div className="mt-1 text-xs text-muted-foreground">
                      {type.value} incident records
                    </div>
                  </div>
                  <Pill tone="info">Clustered</Pill>
                </div>
              ))}
            </div>
          ) : (
            <div className="py-8 text-center text-sm text-muted-foreground">
              No incident cluster data available.
            </div>
          )}
        </Panel>
        <Panel title="Post-mortem journal" description="Backend-generated incident reports">
          {latestReport ? (
            <div className="space-y-3">
              <div className="rounded-md border p-3">
                <div className="flex items-center gap-2 font-medium">
                  <FileText className="size-4 text-primary" />
                  {latestReport.incidentId}
                </div>
                <p className="mt-2 text-xs leading-5 text-muted-foreground">
                  {latestReport.sections.summary}
                </p>
                <p className="mt-2 text-xs leading-5 text-muted-foreground">
                  <strong>Root cause:</strong> {latestReport.sections.rootCause}
                </p>
              </div>
              <div className="text-[10px] text-muted-foreground">
                Created {new Date(latestReport.createdAt).toLocaleString()} ·{" "}
                {state.postmortems.length} stored reports
              </div>
            </div>
          ) : (
            <div className="space-y-3">
              <p className="text-sm text-muted-foreground">
                No post-mortem reports have been generated.
              </p>
              {latestIncident && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => void actions.createPostmortem(latestIncident.id)}
                >
                  <FileText className="size-4" /> Generate for {latestIncident.id}
                </Button>
              )}
            </div>
          )}
        </Panel>
      </div>
    </div>
  );
}
