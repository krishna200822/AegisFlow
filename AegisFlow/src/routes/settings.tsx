import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { Check, RotateCcw, Save, ShieldCheck, SlidersHorizontal, Waypoints } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Panel, PageHeader, Pill } from "@/components/proof/primitives";
import { useStore } from "@/store/store";
import type { Settings } from "@/types";

export const Route = createFileRoute("/settings")({
  head: () => ({ meta: [{ title: "Settings — AegisFlow" }] }),
  component: SettingsPage,
});

function SettingsPage() {
  const { state, actions } = useStore();
  const [saved, setSaved] = useState(false);
  const settings = state.settings;

  const update = <K extends keyof Settings>(key: K, value: Settings[K]) => {
    actions.updateSettings({ [key]: value });
    setSaved(false);
  };

  const save = async () => setSaved(Boolean(await actions.saveSettings()));
  const verifyModel = () => void actions.checkModelStatus();
  const modelStatus = state.modelStatus;

  return (
    <div className="space-y-5">
      <PageHeader
        title="System settings"
        subtitle="Tune monitoring, recovery policy, validation, and backend AI diagnostics."
        actions={<Pill tone="info">Backend settings</Pill>}
      />
      <div className="grid gap-4 xl:grid-cols-2">
        <Panel
          title="Monitoring preferences"
          description="Stored backend settings for the local sandbox console"
        >
          <div className="space-y-4">
            <div className="flex items-center justify-between gap-4">
              <div>
                <div className="text-sm font-medium">Monitoring indicator enabled</div>
                <div className="mt-1 text-xs text-muted-foreground">
                  This controls the console indicator; external sources are not monitored.
                </div>
              </div>
              <Switch
                checked={settings.monitoringEnabled}
                onCheckedChange={(value) => update("monitoringEnabled", value)}
              />
            </div>
            <div className="grid gap-2 sm:grid-cols-2">
              <label className="text-xs text-muted-foreground">
                Polling interval (seconds)
                <Input
                  type="number"
                  min={5}
                  max={600}
                  value={settings.pollingIntervalSec}
                  onChange={(event) =>
                    update("pollingIntervalSec", Math.max(5, Number(event.target.value) || 5))
                  }
                  className="mt-2"
                />
              </label>
              <label className="text-xs text-muted-foreground">
                Severity threshold preference
                <select
                  value={settings.severityThreshold}
                  onChange={(event) =>
                    update("severityThreshold", event.target.value as Settings["severityThreshold"])
                  }
                  className="mt-2 h-10 w-full rounded-md border bg-background px-3 text-sm"
                >
                  {["low", "medium", "high", "critical"].map((level) => (
                    <option key={level}>{level}</option>
                  ))}
                </select>
              </label>
            </div>
          </div>
        </Panel>

        <Panel
          title="Recovery policy"
          description="The backend always requires explicit approval before replay"
        >
          <div className="space-y-4">
            <div className="grid gap-2 sm:grid-cols-2">
              <label className="text-xs text-muted-foreground">
                Maximum retry attempts
                <Input
                  type="number"
                  min={0}
                  max={5}
                  value={settings.maxRetries}
                  onChange={(event) =>
                    update("maxRetries", Math.min(5, Math.max(0, Number(event.target.value) || 0)))
                  }
                  className="mt-2"
                />
              </label>
              <label className="text-xs text-muted-foreground">
                Retry delay (seconds)
                <Input
                  type="number"
                  min={1}
                  max={600}
                  value={settings.retryDelaySec}
                  onChange={(event) =>
                    update(
                      "retryDelaySec",
                      Math.min(600, Math.max(1, Number(event.target.value) || 1)),
                    )
                  }
                  className="mt-2"
                />
              </label>
            </div>
            <div className="rounded-md border border-primary/20 bg-primary/5 p-3 text-xs text-muted-foreground">
              Human approval is always required by the backend before replay. Automatic recovery is
              disabled; all execution remains a local simulation.
            </div>
          </div>
        </Panel>

        <Panel
          title="Validation rules"
          description="Independent checks performed by the backend before replay"
        >
          <div className="space-y-4">
            <label className="block text-xs text-muted-foreground">
              Fallback required fields for workflows without a schema
              <Input
                value={settings.requiredFields}
                onChange={(event) => update("requiredFields", event.target.value)}
                className="mt-2"
              />
            </label>
            <div className="flex items-center justify-between gap-4">
              <div>
                <div className="text-sm font-medium">Enforce schema data types</div>
                <div className="mt-1 text-xs text-muted-foreground">
                  Reject type mismatches after patching.
                </div>
              </div>
              <Switch
                checked={settings.enforceTypes}
                onCheckedChange={(value) => update("enforceTypes", value)}
              />
            </div>
            <div className="flex items-center justify-between gap-4">
              <div>
                <div className="text-sm font-medium">Run business-rule checks</div>
                <div className="mt-1 text-xs text-muted-foreground">
                  Require review when a proposed payload changes source data.
                </div>
              </div>
              <Switch
                checked={settings.businessRules}
                onCheckedChange={(value) => update("businessRules", value)}
              />
            </div>
          </div>
        </Panel>

        <Panel title="AI diagnostics" description="Model configuration and Gemini API availability">
          <div className="rounded-md border p-3">
            <div className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-2">
                <div className="grid size-9 place-items-center rounded-md bg-primary/10">
                  <SlidersHorizontal className="size-4 text-primary" />
                </div>
                <div>
                  <div className="text-sm font-medium">Google Gemini</div>
                  <div className="mt-1 text-xs text-muted-foreground">
                    Requests are made by the backend only.
                  </div>
                </div>
              </div>
              <Pill
                tone={
                  modelStatus?.verified
                    ? "success"
                    : modelStatus?.configured === false
                      ? "error"
                      : "warning"
                }
              >
                {modelStatus?.verified
                  ? "Verified"
                  : modelStatus?.configured === false
                    ? "Not configured"
                    : modelStatus
                      ? "Unverified"
                      : "Not checked"}
              </Pill>
            </div>
            <label className="mt-4 block text-xs text-muted-foreground">
              Configured model
              <Input value={settings.model} readOnly className="mt-2" />
            </label>
            <div className="mt-3 flex flex-wrap items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={verifyModel}
                disabled={!!state.busy["model-status"]}
              >
                <Waypoints className="size-4" />{" "}
                {state.busy["model-status"] || "Verify model access"}
              </Button>
              {modelStatus && (
                <span className="text-xs text-muted-foreground">{modelStatus.detail}</span>
              )}
            </div>
            <div className="mt-3 flex items-start gap-2 text-xs text-muted-foreground">
              <ShieldCheck className="mt-0.5 size-4 shrink-0 text-primary" />
              API keys are loaded from the backend environment and are never returned to the
              browser.
            </div>
          </div>
        </Panel>
      </div>
      <div className="flex flex-wrap justify-end gap-2">
        <Button variant="outline" onClick={() => void actions.resetDemo()} disabled={state.loading}>
          <RotateCcw className="size-4" /> Reset sandbox data
        </Button>
        <Button onClick={() => void save()} disabled={state.loading}>
          <Save className="size-4" />{" "}
          {saved ? (
            <>
              <Check className="size-4" /> Saved
            </>
          ) : (
            "Save settings"
          )}
        </Button>
      </div>
    </div>
  );
}
