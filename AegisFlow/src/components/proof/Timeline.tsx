import { Link } from "@tanstack/react-router";
import { useStore } from "@/store/store";
import { fmtTime } from "@/lib/time";
import type { TimelineEvent } from "@/types";
import { cn } from "@/lib/utils";
import { toneBg, toneText } from "./primitives";

const LABEL: Record<TimelineEvent["category"], string> = {
  execution: "Execution",
  anomaly: "Unexpected response",
  detection: "Failure detected",
  diagnosis: "Root cause",
  repair: "Repair proposed",
  validation: "Validation",
  recovery: "Recovery",
  approval: "Approval",
  rejection: "Rejected",
};

export function Timeline({ events, limit = 12 }: { events: TimelineEvent[]; limit?: number }) {
  const { state } = useStore();
  const name = (id: string) => state.workflows.find((w) => w.id === id)?.name ?? id;
  return (
    <ol className="relative">
      {events.slice(0, limit).map((e, i) => (
        <li key={e.id} className="relative flex gap-3 pb-4 last:pb-0">
          {i < Math.min(events.length, limit) - 1 && <span className="absolute left-[5px] top-4 h-full w-px bg-border" />}
          <span className={cn("relative mt-1.5 size-[11px] shrink-0 rounded-full ring-4 ring-card", toneBg[e.tone === "neutral" ? "neutral" : e.tone])} />
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5 text-[11px]">
              <span className="tnum font-mono text-muted-foreground">{fmtTime(e.timestamp)}</span>
              <span className={cn("font-semibold uppercase tracking-wide", toneText[e.tone])}>{LABEL[e.category]}</span>
              {e.incidentId && (
                <Link to="/incidents/$incidentId" params={{ incidentId: e.incidentId }} className="font-mono text-info hover:underline">
                  {e.incidentId}
                </Link>
              )}
            </div>
            <p className="mt-0.5 text-sm leading-snug">{e.description}</p>
            <p className="text-[11px] text-muted-foreground">{name(e.workflowId)}</p>
          </div>
        </li>
      ))}
    </ol>
  );
}
