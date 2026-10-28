import { useState, type ReactNode } from "react";
import { Link, useRouterState } from "@tanstack/react-router";
import {
  Activity,
  BarChart3,
  FileText,
  LayoutDashboard,
  Menu,
  RefreshCcw,
  Settings,
  ShieldAlert,
  Workflow,
  Wrench,
  Zap,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useStore } from "@/store/store";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetTitle } from "@/components/ui/sheet";
import { DemoBadge } from "./primitives";
import { SimulateFailureDialog } from "./SimulateFailureDialog";

const NAV = [
  { to: "/", label: "Overview", icon: LayoutDashboard, exact: true },
  { to: "/workflows", label: "Workflows", icon: Workflow },
  { to: "/incidents", label: "Incidents", icon: ShieldAlert, badge: true },
  { to: "/repair", label: "Repair Center", icon: Wrench },
  { to: "/logs", label: "Execution Logs", icon: FileText },
  { to: "/analytics", label: "Analytics", icon: BarChart3 },
  { to: "/settings", label: "Settings", icon: Settings },
] as const;

function Logo() {
  return (
    <div className="flex items-center gap-2.5">
      <div className="grid size-8 place-items-center rounded-md border border-primary/40 bg-primary/10">
        <RefreshCcw className="size-4 text-primary" strokeWidth={2.5} />
      </div>
      <div className="leading-tight">
        <div className="text-[15px] font-semibold tracking-tight">AegisFlow</div>
        <div className="text-[10px] text-muted-foreground">Detect · Diagnose · Repair · Verify</div>
      </div>
    </div>
  );
}

function SidebarBody({ onNavigate }: { onNavigate?: () => void }) {
  const path = useRouterState({ select: (s) => s.location.pathname });
  const { metrics, state } = useStore();
  return (
    <div className="flex h-full flex-col">
      <div className="px-4 py-4">
        <Logo />
      </div>
      <nav className="flex-1 space-y-0.5 px-2 py-2">
        {NAV.map((n) => {
          const active = "exact" in n ? path === n.to : path.startsWith(n.to);
          return (
            <Link
              key={n.to}
              to={n.to}
              onClick={onNavigate}
              className={cn(
                "group relative flex items-center gap-3 rounded-md px-3 py-2 text-sm transition-colors",
                active
                  ? "bg-sidebar-accent font-medium text-foreground"
                  : "text-muted-foreground hover:bg-sidebar-accent/60 hover:text-foreground",
              )}
            >
              {active && (
                <span className="absolute inset-y-1.5 left-0 w-0.5 rounded-full bg-primary" />
              )}
              <n.icon className={cn("size-4", active && "text-primary")} />
              <span className="flex-1">{n.label}</span>
              {"badge" in n && metrics.activeIncidents > 0 && (
                <span className="tnum rounded bg-error/15 px-1.5 text-[11px] font-semibold text-error">
                  {metrics.activeIncidents}
                </span>
              )}
            </Link>
          );
        })}
      </nav>
      <div className="space-y-3 border-t p-3">
        <div className="rounded-md border bg-card p-3">
          <div className="flex items-center gap-2 text-xs">
            <span
              className={cn(
                "size-2 rounded-full pulse-dot",
                metrics.activeIncidents ? "bg-warning" : "bg-success",
              )}
            />
            <span className="font-medium">
              {metrics.activeIncidents ? "Sandbox incidents active" : "No active sandbox incidents"}
            </span>
          </div>
          <div className="mt-1 text-[11px] text-muted-foreground">
            Preference:{" "}
            {state.settings.monitoringEnabled
              ? `enabled · ${state.settings.pollingIntervalSec}s`
              : "paused"}
          </div>
        </div>
        <DemoBadge />
        <div className="flex items-center gap-2.5 px-1">
          <div className="grid size-8 place-items-center rounded-full bg-elevated text-xs font-semibold">
            DO
          </div>
          <div className="min-w-0 leading-tight">
            <div className="truncate text-sm">Demo Operator</div>
            <div className="truncate text-[11px] text-muted-foreground">Reliability engineer</div>
          </div>
        </div>
      </div>
    </div>
  );
}

export function AppShell({ children }: { children: ReactNode }) {
  const [mobile, setMobile] = useState(false);
  const [sim, setSim] = useState(false);
  const { state, refresh } = useStore();
  return (
    <div className="min-h-screen bg-background">
      <aside className="fixed inset-y-0 left-0 z-30 hidden w-60 border-r bg-sidebar lg:block">
        <SidebarBody />
      </aside>
      <Sheet open={mobile} onOpenChange={setMobile}>
        <SheetContent side="left" className="w-64 bg-sidebar p-0">
          <SheetTitle className="sr-only">Navigation</SheetTitle>
          <SidebarBody onNavigate={() => setMobile(false)} />
        </SheetContent>
      </Sheet>
      <div className="lg:pl-60">
        <header className="sticky top-0 z-20 flex h-14 items-center gap-3 border-b bg-background/90 px-4 backdrop-blur md:px-6">
          <Button
            variant="ghost"
            size="icon"
            className="lg:hidden"
            onClick={() => setMobile(true)}
            aria-label="Open navigation"
          >
            <Menu className="size-5" />
          </Button>
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <Activity className="size-3.5 text-primary" />
            <span className="hidden sm:inline">Backend sandbox</span>
            <span
              className={cn(
                "rounded px-1.5 py-0.5 font-mono text-[10px] font-semibold uppercase",
                state.settings.monitoringEnabled ? "bg-success/10 text-success" : "bg-elevated",
              )}
            >
              {state.settings.monitoringEnabled ? "active" : "paused"}
            </span>
          </div>
          <div className="ml-auto flex items-center gap-2">
            <span className="hidden md:inline">
              <DemoBadge />
            </span>
            <Button size="sm" onClick={() => setSim(true)}>
              <Zap className="size-4" /> Simulate Failure
            </Button>
          </div>
        </header>
        <main className="mx-auto max-w-[1440px] p-4 md:p-6">
          {state.loading && (
            <div
              role="status"
              className="mb-4 rounded-md border bg-card px-4 py-3 text-sm text-muted-foreground"
            >
              Loading workflows, incidents, logs, and settings from the backend…
            </div>
          )}
          {state.loadError && (
            <div
              role="alert"
              className="mb-4 flex flex-wrap items-center justify-between gap-3 rounded-md border border-error/30 bg-error/5 px-4 py-3 text-sm"
            >
              <span>{state.loadError}</span>
              <Button variant="outline" size="sm" onClick={() => void refresh()}>
                Retry API connection
              </Button>
            </div>
          )}
          {children}
        </main>
      </div>
      <SimulateFailureDialog open={sim} onOpenChange={setSim} />
    </div>
  );
}

/** Opens the global simulate dialog from page headers. */
export function useSimulateTrigger() {
  return () => document.dispatchEvent(new CustomEvent("aegisflow:simulate"));
}
