import type {
  FailureType,
  Incident,
  LogEntry,
  RepairProposal,
  RootCauseDiagnosis,
  Settings,
  StripeEvent,
  StripeStatus,
  SystemMetrics,
  ValidationCheck,
  WorkflowExecution,
} from "@/types";
import type { WorkflowSeed } from "@/mock/workflows";

const configuredApiOrigin = (import.meta.env.VITE_API_BASE_URL ?? "http://localhost:8000").replace(
  /\/+$/,
  "",
);
export const API_BASE = /\/api\/v1$/i.test(configuredApiOrigin)
  ? configuredApiOrigin
  : `${configuredApiOrigin}/api/v1`;

export const ENDPOINTS = {
  workflows: `${API_BASE}/workflows`,
  incidents: `${API_BASE}/incidents`,
  logs: `${API_BASE}/logs`,
  repairs: `${API_BASE}/repairs`,
  executions: `${API_BASE}/analytics/executions`,
  metrics: `${API_BASE}/analytics/metrics`,
  clusters: `${API_BASE}/analytics/clusters`,
  postmortems: `${API_BASE}/analytics/postmortems`,
  settings: `${API_BASE}/settings`,
  modelStatus: `${API_BASE}/settings/model-status`,
  stripeEvents: `${API_BASE}/stripe/events`,
  stripeStatus: `${API_BASE}/stripe/status`,
  simulateStripeFailure: `${API_BASE}/stripe/simulate/failure`,
  salesforceStatus: `${API_BASE}/salesforce/status`,
  salesforceLeadReport: `${API_BASE}/salesforce/leads/report`,
  simulate: `${API_BASE}/simulate/failure`,
  analyze: (id: string) => `${API_BASE}/incidents/${encodeURIComponent(id)}/analyze`,
  propose: (id: string) => `${API_BASE}/incidents/${encodeURIComponent(id)}/repairs`,
  validate: (id: string) => `${API_BASE}/repairs/${encodeURIComponent(id)}/validate`,
  approve: (id: string) => `${API_BASE}/repairs/${encodeURIComponent(id)}/approve`,
  apply: (id: string) => `${API_BASE}/repairs/${encodeURIComponent(id)}/apply`,
  reject: (id: string) => `${API_BASE}/repairs/${encodeURIComponent(id)}/reject`,
} as const;

export class ApiError extends Error {
  constructor(
    message: string,
    readonly status: number,
  ) {
    super(message);
    this.name = "ApiError";
  }
}

export interface SalesforceStatus {
  configured: boolean;
  mode: "live-read-only";
  maxRecordsPerReport: number;
  persisted: false;
  writeActionsEnabled: false;
  detail: string;
}

export interface SalesforceLead {
  name: string;
  company: string;
  status: string;
  rating: string;
  score: number;
  priority: "high" | "medium" | "low";
  reasons: string[];
}

export interface SalesforceLeadReport {
  source: "salesforce";
  mode: "live-read-only";
  recordsRead: number;
  validCount: number;
  needsReview: number;
  leads: SalesforceLead[];
  validationIssues: Array<{ recordNumber: number; missingFields: string[] }>;
  persisted: false;
  writeActionsEnabled: false;
}

async function request<T>(url: string, init?: RequestInit): Promise<T> {
  let response: Response;
  try {
    response = await fetch(url, {
      ...init,
      headers: {
        ...(init?.body ? { "Content-Type": "application/json" } : {}),
        ...init?.headers,
      },
    });
  } catch {
    throw new ApiError(`Could not reach the AegisFlow API at ${API_BASE}.`, 0);
  }

  const contentType = response.headers.get("content-type") ?? "";
  const body: unknown = contentType.includes("application/json")
    ? await response.json()
    : await response.text();
  if (!response.ok) {
    const detail =
      typeof body === "object" && body !== null && "detail" in body
        ? String((body as { detail: unknown }).detail)
        : `Request failed (${response.status}).`;
    throw new ApiError(detail, response.status);
  }
  return body as T;
}

const json = (body: unknown): RequestInit => ({
  method: "POST",
  body: JSON.stringify(body),
});

const items = <T>(result: { items: T[] }) => result.items;

export interface ModelStatus {
  model: string;
  configured: boolean;
  supported: boolean | null;
  verified: boolean;
  detail: string;
}

export interface Postmortem {
  incidentId: string;
  createdAt: string;
  status: string;
  sections: {
    summary: string;
    impact: string;
    rootCause: string;
    evidence: string[];
    correctiveActions: string[];
    prevention: string;
    limitations: string;
  };
}

export interface FailureCluster {
  id: string;
  failureType: string;
  name: string;
  count: number;
}

export interface InitialData {
  workflows: WorkflowSeed[];
  incidents: Incident[];
  repairs: RepairProposal[];
  logs: LogEntry[];
  executions: WorkflowExecution[];
  settings: Settings;
  metrics: SystemMetrics;
  clusters: FailureCluster[];
  postmortems: Postmortem[];
  stripeEvents: StripeEvent[];
  stripeStatus: StripeStatus;
}

export interface WorkflowCreateRequest {
  name: string;
  description: string;
  integration: string;
  steps: Array<{ id: string; name: string; description: string }>;
  inputSchema: Record<string, string>;
  outputSchema: Record<string, string>;
  retryPolicy: { maxAttempts: number; backoff: string; idempotent: boolean };
}

export const api = {
  async getInitialState(): Promise<InitialData> {
    const [
      workflows,
      incidents,
      repairs,
      logs,
      executions,
      settings,
      metrics,
      clusters,
      postmortems,
      stripeEvents,
      stripeStatus,
    ] = await Promise.all([
      request<{ items: WorkflowSeed[] }>(ENDPOINTS.workflows),
      request<{ items: Incident[] }>(ENDPOINTS.incidents),
      request<{ items: RepairProposal[] }>(ENDPOINTS.repairs),
      request<{ items: LogEntry[] }>(ENDPOINTS.logs),
      request<{ items: WorkflowExecution[] }>(ENDPOINTS.executions),
      request<Settings>(ENDPOINTS.settings),
      request<SystemMetrics>(ENDPOINTS.metrics),
      request<{ items: FailureCluster[] }>(ENDPOINTS.clusters),
      request<{ items: Postmortem[] }>(ENDPOINTS.postmortems),
      request<{ items: StripeEvent[] }>(ENDPOINTS.stripeEvents),
      request<StripeStatus>(ENDPOINTS.stripeStatus),
    ]);

    return {
      workflows: items(workflows),
      incidents: items(incidents),
      repairs: items(repairs),
      logs: items(logs),
      executions: items(executions),
      settings,
      metrics,
      clusters: items(clusters),
      postmortems: items(postmortems),
      stripeEvents: items(stripeEvents),
      stripeStatus,
    };
  },

  getModelStatus: () => request<ModelStatus>(ENDPOINTS.modelStatus),
  getSalesforceStatus: () => request<SalesforceStatus>(ENDPOINTS.salesforceStatus),
  getSalesforceLeadReport: (limit = 20) =>
    request<SalesforceLeadReport>(ENDPOINTS.salesforceLeadReport, json({ limit })),

  createWorkflow: (workflow: WorkflowCreateRequest) =>
    request<WorkflowSeed>(ENDPOINTS.workflows, json(workflow)),

  executeWorkflow: (workflowId: string) =>
    request<{ execution: WorkflowExecution; status: string; mode: "simulation" }>(
      `${ENDPOINTS.workflows}/${encodeURIComponent(workflowId)}/execute`,
      json({}),
    ),

  simulateFailure: (type: FailureType, workflow: WorkflowSeed) =>
    request<{
      incident: Incident;
      execution: WorkflowExecution;
      logs: LogEntry[];
    }>(ENDPOINTS.simulate, json({ type, workflow })),

  analyzeIncident: (id: string) => request<RootCauseDiagnosis>(ENDPOINTS.analyze(id), json({})),

  proposeRepair: (id: string) => request<RepairProposal>(ENDPOINTS.propose(id), json({})),

  validateRepair: async (id: string) => {
    const result = await request<{ checks: ValidationCheck[] }>(ENDPOINTS.validate(id), json({}));
    return result.checks;
  },

  approveRepair: (id: string) => request<{ approved: boolean }>(ENDPOINTS.approve(id), json({})),

  applyRepair: (id: string) =>
    request<{
      ok: boolean;
      status: RepairProposal["status"];
      execution: WorkflowExecution;
      detail: string;
    }>(ENDPOINTS.apply(id), json({})),

  rejectRepair: (id: string) => request<{ ok: boolean }>(ENDPOINTS.reject(id), json({})),

  requestManualReview: (id: string) =>
    request<Incident>(`${ENDPOINTS.incidents}/${encodeURIComponent(id)}/review`, json({})),

  resolveIncident: (id: string) =>
    request<Incident>(`${ENDPOINTS.incidents}/${encodeURIComponent(id)}/resolve`, json({})),

  updateSettings: (settings: Partial<Omit<Settings, "model">>) =>
    request<Settings>(ENDPOINTS.settings, {
      method: "PATCH",
      body: JSON.stringify(settings),
      headers: { "Content-Type": "application/json" },
    }),

  resetDemo: () => request<{ ok: boolean }>(`${ENDPOINTS.settings}/reset-demo`, json({})),

  createPostmortem: (incidentId: string) =>
    request<Postmortem>(`${ENDPOINTS.postmortems}/${encodeURIComponent(incidentId)}`, json({})),

  simulateStripeFailure: (payload?: {
    eventId?: string;
    paymentIntentId?: string;
    amount?: number;
    currency?: string;
    failureCode?: string;
  }) =>
    request<{
      accepted: boolean;
      duplicate: boolean;
      event: StripeEvent;
      incidentId?: string;
      mode: "simulation";
      detail: string;
    }>(ENDPOINTS.simulateStripeFailure, json(payload ?? {})),
};
