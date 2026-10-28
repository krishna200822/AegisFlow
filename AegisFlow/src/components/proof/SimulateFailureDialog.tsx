import { useEffect, useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import { AlertTriangle, CheckCircle2, Loader2, ShieldCheck, ShieldX, Zap } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { useStore } from "@/store/store";
import { SCENARIOS } from "@/services/engine";
import type { FailureType } from "@/types";
import { Pill } from "./primitives";

const OUTCOME = {
  recoverable: { tone: "success" as const, icon: ShieldCheck, label: "Expected: recoverable" },
  rejected: { tone: "error" as const, icon: ShieldX, label: "Expected: validation rejects" },
  approval: { tone: "warning" as const, icon: AlertTriangle, label: "Expected: approval required" },
};

const STEPS = ["Create incident", "Record error log", "Update workflow status", "Open incident"];

export function SimulateFailureDialog({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
}) {
  const { state, actions } = useStore();
  const navigate = useNavigate();
  const [type, setType] = useState<FailureType>("missing_field");
  const [wfId, setWfId] = useState("wf-cds-01");
  const [step, setStep] = useState(-1);

  useEffect(() => {
    const h = () => onOpenChange(true);
    document.addEventListener("aegisflow:simulate", h);
    return () => document.removeEventListener("aegisflow:simulate", h);
  }, [onOpenChange]);
  useEffect(() => {
    if (open) setStep(-1);
  }, [open]);
  useEffect(() => {
    if (!state.workflows.some((workflow) => workflow.id === wfId) && state.workflows[0]) {
      setWfId(state.workflows[0].id);
    }
  }, [state.workflows, wfId]);

  const run = async () => {
    setStep(0);
    const t = setInterval(() => setStep((s) => Math.min(s + 1, STEPS.length - 1)), 160);
    const id = await actions.simulateFailure(type, wfId);
    clearInterval(t);
    if (!id) {
      setStep(-1);
      return;
    }
    setStep(STEPS.length);
    setTimeout(() => {
      onOpenChange(false);
      navigate({ to: "/incidents/$incidentId", params: { incidentId: id } });
    }, 350);
  };
  const running = step >= 0;

  return (
    <Dialog open={open} onOpenChange={(o) => !running && onOpenChange(o)}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Zap className="size-4 text-primary" /> Simulate Failure
          </DialogTitle>
          <DialogDescription>
            Inject a deterministic failure into a monitored workflow. No external system is called.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div>
            <div className="mb-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">
              Failure scenario
            </div>
            <div className="grid gap-2 sm:grid-cols-2">
              {SCENARIOS.map((s) => {
                const o = OUTCOME[s.expectedOutcome];
                const active = s.type === type;
                return (
                  <button
                    key={s.type}
                    type="button"
                    disabled={running}
                    onClick={() => setType(s.type)}
                    className={cn(
                      "rounded-lg border p-3 text-left transition-colors",
                      active
                        ? "border-primary bg-primary/5"
                        : "bg-elevated/40 hover:border-muted-foreground/40",
                    )}
                  >
                    <div className="text-sm font-medium">{s.label}</div>
                    <p className="mt-1 text-xs text-muted-foreground">{s.description}</p>
                    <Pill tone={o.tone} icon={o.icon} className="mt-2">
                      {o.label}
                    </Pill>
                  </button>
                );
              })}
            </div>
          </div>
          <div>
            <div className="mb-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">
              Affected workflow
            </div>
            <Select
              value={wfId}
              onValueChange={setWfId}
              disabled={running || state.loading || state.workflows.length === 0}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {state.workflows.map((w) => (
                  <SelectItem key={w.id} value={w.id}>
                    {w.name}{" "}
                    <span className="font-mono text-xs text-muted-foreground">· {w.id}</span>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          {running && (
            <ol className="space-y-1.5 rounded-md border bg-elevated/50 p-3">
              {STEPS.map((s, i) => (
                <li key={s} className="flex items-center gap-2 text-xs">
                  {i < step ? (
                    <CheckCircle2 className="size-3.5 text-success" />
                  ) : i === step ? (
                    <Loader2 className="size-3.5 animate-spin text-info" />
                  ) : (
                    <span className="size-3.5 rounded-full border" />
                  )}
                  <span className={i <= step ? "" : "text-muted-foreground"}>{s}</span>
                </li>
              ))}
            </ol>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={running}>
            Cancel
          </Button>
          <Button
            onClick={run}
            disabled={
              running || state.loading || state.workflows.length === 0 || !!state.busy.simulate
            }
          >
            {running ? <Loader2 className="size-4 animate-spin" /> : <Zap className="size-4" />}{" "}
            Start simulation
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
