import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { Download, Search } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Panel, PageHeader, Pill } from "@/components/proof/primitives";
import { useStore } from "@/store/store";

export const Route = createFileRoute("/logs")({
  head: () => ({ meta: [{ title: "Execution Logs — AegisFlow" }] }),
  component: LogsPage,
});
function LogsPage() {
  const { state } = useStore();
  const [q, setQ] = useState("");
  const [level, setLevel] = useState("all");
  const [workflow, setWorkflow] = useState("all");
  const [expanded, setExpanded] = useState<string | undefined>();
  const rows = useMemo(
    () =>
      state.logs
        .filter((l) =>
          `${l.message} ${l.event} ${l.executionId} ${l.incidentId || ""}`
            .toLowerCase()
            .includes(q.toLowerCase()),
        )
        .filter((l) => level === "all" || l.level === level)
        .filter((l) => workflow === "all" || l.workflowId === workflow)
        .sort((a, b) => b.timestamp.localeCompare(a.timestamp)),
    [state.logs, q, level, workflow],
  );
  const exportLogs = () => {
    const blob = new Blob([JSON.stringify(rows, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "aegisflow-logs.json";
    a.click();
    URL.revokeObjectURL(url);
  };
  return (
    <div className="space-y-5">
      <PageHeader
        title="Structured log collector"
        subtitle="Search execution events, correlate incidents, and inspect structured metadata."
        actions={
          <Button variant="outline" onClick={exportLogs}>
            <Download className="size-4" /> Export JSON
          </Button>
        }
      />
      <div className="grid gap-3 sm:grid-cols-4">
        {[
          { l: "Total events", v: state.logs.length },
          { l: "Errors", v: state.logs.filter((x) => x.level === "ERROR").length },
          { l: "Warnings", v: state.logs.filter((x) => x.level === "WARN").length },
          {
            l: "Correlated incidents",
            v: new Set(state.logs.map((x) => x.incidentId).filter(Boolean)).size,
          },
        ].map((c) => (
          <div key={c.l} className="rounded-lg border bg-card p-4">
            <div className="text-xs text-muted-foreground">{c.l}</div>
            <div className="mt-2 text-2xl font-semibold tnum">{c.v}</div>
          </div>
        ))}
      </div>
      <Panel title="Log explorer" description={`${rows.length} events match the current filters`}>
        <div className="mb-4 grid gap-2 md:grid-cols-[1fr_150px_220px]">
          <div className="relative">
            <Search className="absolute left-3 top-2.5 size-4 text-muted-foreground" />
            <Input
              className="pl-9"
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Search message, event, execution ID…"
            />
          </div>
          <select
            className="h-10 rounded-md border bg-background px-3 text-sm"
            value={level}
            onChange={(e) => setLevel(e.target.value)}
          >
            <option value="all">All levels</option>
            {["ERROR", "WARN", "INFO", "DEBUG"].map((x) => (
              <option key={x}>{x}</option>
            ))}
          </select>
          <select
            className="h-10 rounded-md border bg-background px-3 text-sm"
            value={workflow}
            onChange={(e) => setWorkflow(e.target.value)}
          >
            <option value="all">All workflows</option>
            {state.workflows.map((w) => (
              <option key={w.id} value={w.id}>
                {w.name}
              </option>
            ))}
          </select>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[760px] text-left text-xs">
            <thead>
              <tr className="border-b text-[10px] uppercase tracking-wider text-muted-foreground">
                <th className="pb-2 font-medium">Time</th>
                <th className="pb-2 font-medium">Level</th>
                <th className="pb-2 font-medium">Event</th>
                <th className="pb-2 font-medium">Message</th>
                <th className="pb-2 font-medium">Execution</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((l) => (
                <>
                  <tr
                    key={l.id}
                    onClick={() => setExpanded(expanded === l.id ? undefined : l.id)}
                    className="cursor-pointer border-b hover:bg-elevated/50"
                  >
                    <td className="py-3 font-mono text-[10px] text-muted-foreground">
                      {new Date(l.timestamp).toLocaleTimeString()}
                    </td>
                    <td className="py-3">
                      <Pill
                        tone={
                          l.level === "ERROR"
                            ? "error"
                            : l.level === "WARN"
                              ? "warning"
                              : l.level === "DEBUG"
                                ? "neutral"
                                : "info"
                        }
                      >
                        {l.level}
                      </Pill>
                    </td>
                    <td className="py-3 font-mono text-primary">{l.event}</td>
                    <td className="max-w-[380px] truncate py-3">{l.message}</td>
                    <td className="py-3 font-mono text-[10px] text-muted-foreground">
                      {l.executionId}
                    </td>
                  </tr>
                  {expanded === l.id && (
                    <tr key={`${l.id}-detail`} className="border-b bg-elevated/40">
                      <td colSpan={5} className="p-3">
                        <div className="grid gap-3 md:grid-cols-3">
                          <div>
                            <div className="text-[10px] uppercase text-muted-foreground">
                              Workflow
                            </div>
                            <div className="mt-1 font-mono">{l.workflowId}</div>
                          </div>
                          <div>
                            <div className="text-[10px] uppercase text-muted-foreground">
                              Incident
                            </div>
                            <div className="mt-1 font-mono">{l.incidentId || "—"}</div>
                          </div>
                          <div>
                            <div className="text-[10px] uppercase text-muted-foreground">
                              Timestamp
                            </div>
                            <div className="mt-1 font-mono">{l.timestamp}</div>
                          </div>
                        </div>
                        <pre className="mt-3 overflow-auto rounded border bg-background p-3 text-[11px]">
                          {JSON.stringify(l.metadata, null, 2)}
                        </pre>
                      </td>
                    </tr>
                  )}
                </>
              ))}
            </tbody>
          </table>
          {rows.length === 0 && (
            <div className="py-10 text-center text-sm text-muted-foreground">
              No log entries found.
            </div>
          )}
        </div>
      </Panel>
    </div>
  );
}
