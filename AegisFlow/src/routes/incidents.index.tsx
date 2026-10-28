import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { Search, ShieldAlert } from "lucide-react";
import { Input } from "@/components/ui/input";
import {
  Panel,
  PageHeader,
  IncidentStatusPill,
  SeverityPill,
  Pill,
} from "@/components/proof/primitives";
import { useStore } from "@/store/store";

export const Route = createFileRoute("/incidents/")({
  head: () => ({ meta: [{ title: "Incidents — AegisFlow" }] }),
  component: IncidentsPage,
});
function IncidentsPage() {
  const { state } = useStore();
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState("all");
  const [severity, setSeverity] = useState("all");
  const list = useMemo(
    () =>
      state.incidents
        .filter((i) =>
          `${i.id} ${i.title} ${i.errorMessage} ${i.workflowId}`
            .toLowerCase()
            .includes(query.toLowerCase()),
        )
        .filter((i) => status === "all" || i.status === status)
        .filter((i) => severity === "all" || i.severity === severity)
        .sort((a, b) => b.detectedAt.localeCompare(a.detectedAt)),
    [state.incidents, query, status, severity],
  );
  return (
    <div className="space-y-5">
      <PageHeader
        title="Incident center"
        subtitle="Investigate failures, compare evidence, and track recovery decisions."
        actions={
          <Pill tone="warning" icon={ShieldAlert}>
            {state.incidents.filter((i) => i.status !== "resolved").length} active
          </Pill>
        }
      />
      <Panel
        title="Incident register"
        description="Searchable incident history and current remediation state"
      >
        <div className="mb-4 grid gap-2 md:grid-cols-[1fr_180px_160px]">
          <div className="relative">
            <Search className="absolute left-3 top-2.5 size-4 text-muted-foreground" />
            <Input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search incident, workflow, error…"
              className="pl-9"
            />
          </div>
          <select
            value={status}
            onChange={(e) => setStatus(e.target.value)}
            className="h-10 rounded-md border bg-background px-3 text-sm"
          >
            <option value="all">All statuses</option>
            {[
              "open",
              "analyzing",
              "repair_proposed",
              "awaiting_approval",
              "repair_rejected",
              "resolved",
            ].map((s) => (
              <option key={s} value={s}>
                {s.replaceAll("_", " ")}
              </option>
            ))}
          </select>
          <select
            value={severity}
            onChange={(e) => setSeverity(e.target.value)}
            className="h-10 rounded-md border bg-background px-3 text-sm"
          >
            <option value="all">All severities</option>
            {["critical", "high", "medium", "low"].map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[760px] text-left text-sm">
            <thead>
              <tr className="border-b text-[10px] uppercase tracking-wider text-muted-foreground">
                <th className="pb-2 font-medium">Incident</th>
                <th className="pb-2 font-medium">Severity</th>
                <th className="pb-2 font-medium">Status</th>
                <th className="pb-2 font-medium">Detected</th>
                <th className="pb-2 font-medium">Owner</th>
                <th className="pb-2 font-medium">Action</th>
              </tr>
            </thead>
            <tbody>
              {list.map((i) => (
                <tr key={i.id} className="border-b last:border-0">
                  <td className="py-3">
                    <div className="flex items-center gap-2">
                      <div className="font-medium">{i.title}</div>
                      {i.failureType === "payment_failed" && <Pill tone="info">Stripe test</Pill>}
                    </div>
                    <div className="mt-1 font-mono text-[10px] text-muted-foreground">
                      {i.id} · {i.workflowId}
                    </div>
                    <div className="mt-1 max-w-[420px] truncate text-xs text-muted-foreground">
                      {i.errorMessage}
                    </div>
                  </td>
                  <td className="py-3">
                    <SeverityPill severity={i.severity} />
                  </td>
                  <td className="py-3">
                    <IncidentStatusPill status={i.status} />
                  </td>
                  <td className="py-3 font-mono text-[11px] text-muted-foreground">
                    {new Date(i.detectedAt).toLocaleTimeString([], {
                      hour: "2-digit",
                      minute: "2-digit",
                    })}
                  </td>
                  <td className="py-3 text-xs text-muted-foreground">{i.owner}</td>
                  <td className="py-3">
                    <Link
                      to="/incidents/$incidentId"
                      params={{ incidentId: i.id }}
                      className="text-xs font-medium text-primary hover:underline"
                    >
                      Investigate →
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {list.length === 0 && (
            <div className="py-10 text-center text-sm text-muted-foreground">
              {state.loading ? "Loading incidents…" : "No incidents match these filters."}
            </div>
          )}
        </div>
      </Panel>
    </div>
  );
}
