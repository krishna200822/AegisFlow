import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { toast } from "sonner";
import type {
  FailureType,
  Incident,
  LogEntry,
  RepairProposal,
  Settings,
  SystemMetrics,
  TimelineEvent,
  WorkflowExecution,
} from "@/types";
import type { WorkflowSeed } from "@/mock/workflows";
import {
  api,
  type FailureCluster,
  type InitialData,
  type ModelStatus,
  type Postmortem,
  type WorkflowCreateRequest,
} from "@/services/api";

const DEFAULT_SETTINGS: Settings = {
  pollingIntervalSec: 30,
  monitoringEnabled: true,
  severityThreshold: "medium",
  maxRetries: 3,
  retryDelaySec: 30,
  approvalForHighRisk: true,
  autoRetry: false,
  requiredFields: "customer_id, email, plan, seats",
  enforceTypes: true,
  businessRules: true,
  model: "gemini-3.6-flash",
};

const EMPTY_METRICS: SystemMetrics = {
  workflowsMonitored: 0,
  activeIncidents: 0,
  successfulRecoveries: 0,
  failedRecoveries: 0,
  recoverySuccessRate: 0,
};

export interface AppState {
  workflows: WorkflowSeed[];
  executions: WorkflowExecution[];
  incidents: Incident[];
  repairs: RepairProposal[];
  logs: LogEntry[];
  timeline: TimelineEvent[];
  settings: Settings;
  metrics: SystemMetrics;
  clusters: FailureCluster[];
  postmortems: Postmortem[];
  stripeEvents: InitialData["stripeEvents"];
  stripeStatus: InitialData["stripeStatus"];
  modelStatus?: ModelStatus;
  highlightIncidentId?: string;
  busy: Record<string, string | undefined>;
  loading: boolean;
  loadError?: string;
}

function emptyState(): AppState {
  return {
    workflows: [],
    executions: [],
    incidents: [],
    repairs: [],
    logs: [],
    timeline: [],
    settings: DEFAULT_SETTINGS,
    metrics: EMPTY_METRICS,
    clusters: [],
    postmortems: [],
    stripeEvents: [],
    stripeStatus: {
      mode: "test",
      webhookConfigured: false,
      simulationAvailable: true,
      financialActionsEnabled: false,
    },
    busy: {},
    loading: true,
  };
}

export function workflowStats(wfId: string, executions: WorkflowExecution[]) {
  const ex = executions.filter((e) => e.workflowId === wfId);
  const ok = ex.filter((e) => e.outcome === "success").length;
  const last = ex[0];
  return { total: ex.length, successRate: ex.length ? ok / ex.length : 0, last, executions: ex };
}

function useAppStore() {
  const [state, setState] = useState<AppState>(emptyState);

  const refresh = useCallback(async (showLoading = false): Promise<InitialData | undefined> => {
    if (showLoading) setState((current) => ({ ...current, loading: true, loadError: undefined }));
    try {
      const data = await api.getInitialState();
      setState((current) => ({
        ...current,
        ...data,
        loading: false,
        loadError: undefined,
      }));
      return data;
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unable to load AegisFlow data.";
      setState((current) => ({ ...current, loading: false, loadError: message }));
      if (!showLoading) toast.error("API request failed", { description: message });
      return undefined;
    }
  }, []);

  useEffect(() => {
    void refresh(true);
  }, [refresh]);

  const setBusy = useCallback((key: string, value?: string) => {
    setState((current) => ({
      ...current,
      busy: { ...current.busy, [key]: value },
    }));
  }, []);

  const reportFailure = useCallback((error: unknown) => {
    const message = error instanceof Error ? error.message : "The API request failed.";
    toast.error("Action could not be completed", { description: message });
    return undefined;
  }, []);

  const simulateFailure = useCallback(
    async (type: FailureType, workflowId: string) => {
      setBusy("simulate", "Injecting failure");
      try {
        const workflow = state.workflows.find((item) => item.id === workflowId);
        if (!workflow) throw new Error("Select an available workflow before simulating a failure.");
        const result = await api.simulateFailure(type, workflow);
        await refresh();
        setState((current) => ({ ...current, highlightIncidentId: result.incident.id }));
        toast.error(`${result.incident.id} opened`, { description: result.incident.errorMessage });
        return result.incident.id;
      } catch (error) {
        return reportFailure(error);
      } finally {
        setBusy("simulate");
      }
    },
    [refresh, reportFailure, setBusy, state.workflows],
  );

  const simulateStripeFailure = useCallback(async () => {
    setBusy("stripe-simulation", "Simulating test payment failure");
    try {
      const result = await api.simulateStripeFailure();
      await refresh();
      if (result.incidentId) {
        setState((current) => ({ ...current, highlightIncidentId: result.incidentId }));
      }
      toast.success(
        result.duplicate ? "Stripe event was already processed" : "Stripe test failure recorded",
        {
          description: result.detail,
        },
      );
      return result.incidentId;
    } catch (error) {
      return reportFailure(error);
    } finally {
      setBusy("stripe-simulation");
    }
  }, [refresh, reportFailure, setBusy]);

  const analyzeIncident = useCallback(
    async (id: string) => {
      setBusy(id, "Analyzing");
      try {
        const diagnosis = await api.analyzeIncident(id);
        await refresh();
        toast.success("Diagnosis completed", {
          description:
            diagnosis.source === "gemini"
              ? "Analyzed by Gemini through the backend."
              : "Backend rule-based diagnosis returned.",
        });
        return diagnosis;
      } catch (error) {
        return reportFailure(error);
      } finally {
        setBusy(id);
      }
    },
    [refresh, reportFailure, setBusy],
  );

  const proposeRepair = useCallback(
    async (id: string) => {
      setBusy(id, "Proposing repair");
      try {
        const diagnosis = state.incidents.find((item) => item.id === id)?.diagnosis;
        if (!diagnosis) await api.analyzeIncident(id);
        const repair = await api.proposeRepair(id);
        await refresh();
        toast.success("Repair proposal created", {
          description: "Validate and approve it before simulated replay.",
        });
        return repair.id;
      } catch (error) {
        return reportFailure(error);
      } finally {
        setBusy(id);
      }
    },
    [refresh, reportFailure, setBusy, state.incidents],
  );

  const validateRepair = useCallback(
    async (repairId: string) => {
      setBusy(repairId, "Validating");
      try {
        const checks = await api.validateRepair(repairId);
        await refresh();
        const failed = checks.filter((check) => check.state === "failed");
        if (failed.length) {
          toast.error("Validation failed", {
            description: failed.map((check) => check.name).join(", "),
          });
        } else {
          toast.success("Validation completed", {
            description: "Backend checks completed. Approval is still required before replay.",
          });
        }
        return checks;
      } catch (error) {
        return reportFailure(error);
      } finally {
        setBusy(repairId);
      }
    },
    [refresh, reportFailure, setBusy],
  );

  const approveRepair = useCallback(
    async (repairId: string) => {
      setBusy(repairId, "Recording approval");
      try {
        await api.approveRepair(repairId);
        await api.validateRepair(repairId);
        await refresh();
        toast.success("Approval recorded", {
          description: "Backend revalidation completed after approval.",
        });
        return true;
      } catch (error) {
        return reportFailure(error);
      } finally {
        setBusy(repairId);
      }
    },
    [refresh, reportFailure, setBusy],
  );

  const applyRepairAndRetry = useCallback(
    async (repairId: string) => {
      const repair = state.repairs.find((item) => item.id === repairId);
      if (!repair || repair.status !== "validated" || !repair.approved) {
        toast.error("Repair cannot be replayed", {
          description: "Run validation and record backend approval before applying.",
        });
        return undefined;
      }
      setBusy(repairId, "Running sandbox replay");
      try {
        const result = await api.applyRepair(repairId);
        await refresh();
        if (result.ok) {
          toast.success("Sandbox recovery verified", { description: result.detail });
        } else {
          toast.error("Sandbox replay did not pass verification", { description: result.detail });
        }
        return result;
      } catch (error) {
        return reportFailure(error);
      } finally {
        setBusy(repairId);
      }
    },
    [refresh, reportFailure, setBusy, state.repairs],
  );

  const rejectRepair = useCallback(
    async (repairId: string) => {
      setBusy(repairId, "Rejecting");
      try {
        await api.rejectRepair(repairId);
        await refresh();
        toast("Repair rejected", { description: "The original payload remains unchanged." });
        return true;
      } catch (error) {
        return reportFailure(error);
      } finally {
        setBusy(repairId);
      }
    },
    [refresh, reportFailure, setBusy],
  );

  const requestManualReview = useCallback(
    async (id: string) => {
      setBusy(id, "Escalating");
      try {
        await api.requestManualReview(id);
        await refresh();
        toast("Incident escalated to on-call.");
        return true;
      } catch (error) {
        return reportFailure(error);
      } finally {
        setBusy(id);
      }
    },
    [refresh, reportFailure, setBusy],
  );

  const resolveIncident = useCallback(
    async (id: string) => {
      setBusy(id, "Resolving");
      try {
        await api.resolveIncident(id);
        await refresh();
        toast.success("Incident resolved");
        return true;
      } catch (error) {
        return reportFailure(error);
      } finally {
        setBusy(id);
      }
    },
    [refresh, reportFailure, setBusy],
  );

  const createWorkflow = useCallback(
    async (workflow: WorkflowCreateRequest) => {
      setBusy("create-workflow", "Creating workflow");
      try {
        const created = await api.createWorkflow(workflow);
        await refresh();
        toast.success("Workflow created in the backend.");
        return created;
      } catch (error) {
        return reportFailure(error);
      } finally {
        setBusy("create-workflow");
      }
    },
    [refresh, reportFailure, setBusy],
  );

  const executeWorkflow = useCallback(
    async (workflowId: string) => {
      setBusy(workflowId, "Running sandbox execution");
      try {
        const result = await api.executeWorkflow(workflowId);
        await refresh();
        toast.success("Sandbox workflow execution completed.", {
          description: `Execution ${result.execution.id}`,
        });
        return result.execution;
      } catch (error) {
        return reportFailure(error);
      } finally {
        setBusy(workflowId);
      }
    },
    [refresh, reportFailure, setBusy],
  );

  const updateSettings = useCallback((partial: Partial<Settings>) => {
    setState((current) => ({
      ...current,
      settings: { ...current.settings, ...partial },
    }));
  }, []);

  const saveSettings = useCallback(async () => {
    try {
      const { model: _model, ...editable } = state.settings;
      await api.updateSettings(editable);
      await refresh();
      toast.success("Settings saved to the backend.");
      return true;
    } catch (error) {
      return reportFailure(error);
    }
  }, [refresh, reportFailure, state.settings]);

  const checkModelStatus = useCallback(async () => {
    setBusy("model-status", "Verifying model");
    try {
      const modelStatus = await api.getModelStatus();
      setState((current) => ({ ...current, modelStatus }));
      if (modelStatus.verified) {
        toast.success(`${modelStatus.model} is available through the Gemini API.`);
      } else {
        toast.error("Model availability could not be verified.", {
          description: modelStatus.detail,
        });
      }
      return modelStatus;
    } catch (error) {
      return reportFailure(error);
    } finally {
      setBusy("model-status");
    }
  }, [reportFailure, setBusy]);

  const createPostmortem = useCallback(
    async (incidentId: string) => {
      try {
        const postmortem = await api.createPostmortem(incidentId);
        await refresh();
        toast.success("Post-mortem generated by the backend.");
        return postmortem;
      } catch (error) {
        return reportFailure(error);
      }
    },
    [refresh, reportFailure],
  );

  const resetDemo = useCallback(async () => {
    try {
      await api.resetDemo();
      await refresh();
      toast("Sandbox data reset.");
      return true;
    } catch (error) {
      return reportFailure(error);
    }
  }, [refresh, reportFailure]);

  const metrics = useMemo(() => state.metrics, [state.metrics]);

  return {
    state,
    metrics,
    refresh: () => refresh(true),
    actions: {
      simulateFailure,
      simulateStripeFailure,
      analyzeIncident,
      proposeRepair,
      validateRepair,
      approveRepair,
      applyRepairAndRetry,
      rejectRepair,
      requestManualReview,
      resolveIncident,
      createWorkflow,
      executeWorkflow,
      updateSettings,
      saveSettings,
      checkModelStatus,
      createPostmortem,
      clearHighlight: () => setState((current) => ({ ...current, highlightIncidentId: undefined })),
      resetDemo,
    },
  };
}

type Store = ReturnType<typeof useAppStore>;
const Ctx = createContext<Store | null>(null);

export function StoreProvider({ children }: { children: ReactNode }) {
  const store = useAppStore();
  return <Ctx.Provider value={store}>{children}</Ctx.Provider>;
}

export function useStore() {
  const store = useContext(Ctx);
  if (!store) throw new Error("useStore must be used inside StoreProvider");
  return store;
}

export const useWorkflow = (id: string) =>
  useStore().state.workflows.find((workflow) => workflow.id === id);
