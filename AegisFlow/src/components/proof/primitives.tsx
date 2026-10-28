import type { ReactNode } from "react";
import { cva, type VariantProps } from "class-variance-authority";
import {
  AlertTriangle, CheckCircle2, Circle, CircleDashed, Clock, Loader2, Lock, RotateCw, ShieldAlert, XCircle,
  type LucideIcon,
} from "lucide-react";
import { cn } from "@/lib/utils";
import type { CheckState, IncidentStatus, Severity, StageState, WorkflowStatus } from "@/types";

export type Tone = "success" | "info" | "warning" | "error" | "neutral";

const pill = cva(
  "inline-flex items-center gap-1.5 rounded-md border px-2 py-0.5 text-xs font-medium whitespace-nowrap",
  {
    variants: {
      tone: {
        success: "border-success/30 bg-success/10 text-success",
        info: "border-info/30 bg-info/10 text-info",
        warning: "border-warning/30 bg-warning/10 text-warning",
        error: "border-error/30 bg-error/10 text-error",
        neutral: "border-border bg-elevated text-muted-foreground",
      },
    },
    defaultVariants: { tone: "neutral" },
  },
);

export function Pill({ tone, icon: Icon, children, spin, className }: VariantProps<typeof pill> & { icon?: LucideIcon; children: ReactNode; spin?: boolean; className?: string }) {
  return (
    <span className={cn(pill({ tone }), className)}>
      {Icon && <Icon className={cn("size-3.5", spin && "animate-spin")} />}
      {children}
    </span>
  );
}

export const toneText: Record<Tone, string> = {
  success: "text-success",
  info: "text-info",
  warning: "text-warning",
  error: "text-error",
  neutral: "text-muted-foreground",
};
export const toneBg: Record<Tone, string> = {
  success: "bg-success",
  info: "bg-info",
  warning: "bg-warning",
  error: "bg-error",
  neutral: "bg-muted-foreground",
};

const WF: Record<WorkflowStatus, [Tone, LucideIcon, string]> = {
  healthy: ["success", CheckCircle2, "Healthy"],
  degraded: ["warning", AlertTriangle, "Degraded"],
  failed: ["error", XCircle, "Failed"],
  recovering: ["info", RotateCw, "Recovering"],
};
export function WorkflowStatusPill({ status }: { status: WorkflowStatus }) {
  const [tone, icon, label] = WF[status];
  return <Pill tone={tone} icon={icon} spin={status === "recovering"}>{label}</Pill>;
}

const SEV: Record<Severity, Tone> = { low: "neutral", medium: "warning", high: "error", critical: "error" };
export function SeverityPill({ severity }: { severity: Severity }) {
  return (
    <Pill tone={SEV[severity]} className="uppercase tracking-wide text-[10px]">
      {severity === "critical" && <ShieldAlert className="size-3" />}
      {severity}
    </Pill>
  );
}

const INC: Record<IncidentStatus, [Tone, string]> = {
  open: ["error", "Open"],
  analyzing: ["info", "Analyzing"],
  repair_proposed: ["info", "Repair proposed"],
  awaiting_approval: ["warning", "Awaiting approval"],
  repair_rejected: ["warning", "Repair rejected"],
  resolved: ["success", "Resolved"],
};
export function IncidentStatusPill({ status }: { status: IncidentStatus }) {
  const [tone, label] = INC[status];
  return <Pill tone={tone} icon={status === "analyzing" ? Loader2 : undefined} spin={status === "analyzing"}>{label}</Pill>;
}

export const CHECK: Record<CheckState, [Tone, LucideIcon, string]> = {
  not_run: ["neutral", Circle, "Not run"],
  running: ["info", Loader2, "Running"],
  passed: ["success", CheckCircle2, "Passed"],
  failed: ["error", XCircle, "Failed"],
  review: ["warning", AlertTriangle, "Requires review"],
};

export const STAGE: Record<StageState, [Tone, LucideIcon, string]> = {
  waiting: ["neutral", CircleDashed, "Waiting"],
  in_progress: ["info", Loader2, "In progress"],
  passed: ["success", CheckCircle2, "Passed"],
  failed: ["error", XCircle, "Failed"],
  blocked: ["error", Lock, "Blocked"],
  approval: ["warning", Clock, "Requires approval"],
};

export function Panel({ title, description, actions, children, className, bodyClassName }: { title?: ReactNode; description?: ReactNode; actions?: ReactNode; children: ReactNode; className?: string; bodyClassName?: string }) {
  return (
    <section className={cn("rounded-lg border bg-card", className)}>
      {(title || actions) && (
        <header className="flex items-start justify-between gap-3 border-b px-4 py-3">
          <div className="min-w-0">
            {title && <h2 className="text-sm font-semibold">{title}</h2>}
            {description && <p className="mt-0.5 text-xs text-muted-foreground">{description}</p>}
          </div>
          {actions && <div className="flex shrink-0 items-center gap-2">{actions}</div>}
        </header>
      )}
      <div className={cn("p-4", bodyClassName)}>{children}</div>
    </section>
  );
}

export function PageHeader({ title, subtitle, actions }: { title: string; subtitle?: string; actions?: ReactNode }) {
  return (
    <div className="mb-5 flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
      <div>
        <h1 className="text-xl font-semibold tracking-tight md:text-2xl">{title}</h1>
        {subtitle && <p className="mt-1 text-sm text-muted-foreground">{subtitle}</p>}
      </div>
      {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
    </div>
  );
}

export function DemoBadge() {
  return (
    <span className="inline-flex items-center gap-1.5 rounded-md border border-warning/30 bg-warning/10 px-2 py-1 font-mono text-[10px] font-semibold uppercase tracking-wider text-warning">
      Demo environment
    </span>
  );
}

export function SimulatedNote({ children = "Simulated data" }: { children?: ReactNode }) {
  return (
    <span className="inline-flex items-center gap-1 rounded border border-dashed px-1.5 py-0.5 font-mono text-[10px] uppercase tracking-wide text-muted-foreground">
      {children}
    </span>
  );
}

export function EmptyState({ icon: Icon, title, description, action }: { icon: LucideIcon; title: string; description?: string; action?: ReactNode }) {
  return (
    <div className="flex flex-col items-center justify-center gap-2 px-6 py-12 text-center">
      <div className="rounded-md border bg-elevated p-2.5"><Icon className="size-5 text-muted-foreground" /></div>
      <p className="text-sm font-medium">{title}</p>
      {description && <p className="max-w-sm text-xs text-muted-foreground">{description}</p>}
      {action}
    </div>
  );
}

export function KV({ k, v, mono }: { k: string; v: ReactNode; mono?: boolean }) {
  return (
    <div className="min-w-0">
      <dt className="text-[11px] uppercase tracking-wide text-muted-foreground">{k}</dt>
      <dd className={cn("mt-0.5 truncate text-sm", mono && "font-mono text-xs")}>{v}</dd>
    </div>
  );
}

export const Mono = ({ children, className }: { children: ReactNode; className?: string }) => (
  <span className={cn("font-mono text-xs", className)}>{children}</span>
);

export const pct = (n: number) => `${Math.round(n * 1000) / 10}%`;
