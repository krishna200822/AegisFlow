import { afterEach, describe, expect, it, vi } from "vitest";
import { WORKFLOW_SEEDS } from "@/mock/workflows";
import { api, ApiError, API_BASE, ENDPOINTS } from "./api";

const response = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });

afterEach(() => vi.unstubAllGlobals());

describe("AegisFlow API client", () => {
  it("hydrates the application from backend collections and metrics", async () => {
    expect(API_BASE).toMatch(/\/api\/v1$/);
    const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input);
      if (url === ENDPOINTS.workflows)
        return response({ items: [{ id: "wf-live", name: "Live" }] });
      if (url === ENDPOINTS.stripeStatus)
        return response({
          mode: "test",
          webhookConfigured: true,
          simulationAvailable: true,
          financialActionsEnabled: false,
        });
      if (url === ENDPOINTS.settings) return response({ model: "gemini-3.6-flash" });
      if (url === ENDPOINTS.metrics) return response({ workflowsMonitored: 1, activeIncidents: 0 });
      if (url === ENDPOINTS.clusters || url === ENDPOINTS.postmortems)
        return response({ items: [] });
      return response({ items: [] });
    });
    vi.stubGlobal("fetch", fetchMock);

    const data = await api.getInitialState();

    expect(data.workflows[0].id).toBe("wf-live");
    expect(data.settings.model).toBe("gemini-3.6-flash");
    expect(fetchMock).toHaveBeenCalledTimes(11);
    expect(fetchMock).toHaveBeenCalledWith(
      ENDPOINTS.metrics,
      expect.objectContaining({ headers: expect.any(Object) }),
    );
  });

  it("sends failure simulation and repair approvals only to backend endpoints", async () => {
    const fetchMock = vi
      .fn()
      .mockImplementation(() => Promise.resolve(response({ ok: true, approved: true })));
    vi.stubGlobal("fetch", fetchMock);

    await api.simulateFailure("timeout", WORKFLOW_SEEDS[0]);
    await api.approveRepair("RP-safe");

    expect(fetchMock).toHaveBeenNthCalledWith(
      1,
      ENDPOINTS.simulate,
      expect.objectContaining({
        method: "POST",
        body: expect.stringContaining('"type":"timeout"'),
      }),
    );
    expect(fetchMock).toHaveBeenCalledWith(
      ENDPOINTS.approve("RP-safe"),
      expect.objectContaining({ method: "POST" }),
    );
    expect(JSON.stringify(fetchMock.mock.calls)).not.toContain("GEMINI_API_KEY");
    expect(JSON.stringify(fetchMock.mock.calls)).not.toContain("apiKey");
  });

  it("surfaces backend errors including approval enforcement", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(response({ detail: "Human approval is required." }, 403)),
    );

    await expect(api.applyRepair("RP-unapproved")).rejects.toMatchObject<ApiError>({
      message: "Human approval is required.",
      status: 403,
    });
  });

  it("uses the Stripe local-simulation route without sending financial commands", async () => {
    const fetchMock = vi.fn().mockImplementation(() =>
      Promise.resolve(
        response({
          accepted: true,
          duplicate: false,
          mode: "simulation",
          event: {
            id: "evt_sim_frontend_test",
            type: "payment_intent.payment_failed",
            status: "processed",
            livemode: false,
            simulated: true,
            receivedAt: new Date().toISOString(),
          },
        }),
      ),
    );
    vi.stubGlobal("fetch", fetchMock);

    await api.simulateStripeFailure({ eventId: "evt_sim_frontend_test" });

    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe(ENDPOINTS.simulateStripeFailure);
    expect(init).toMatchObject({ method: "POST" });
    expect(String(init?.body)).toContain('"eventId":"evt_sim_frontend_test"');
    expect(String(init?.body)).not.toMatch(/charge|refund|capture/i);
  });

  it("requests a bounded read-only Salesforce report through the backend", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      response({
        source: "salesforce",
        mode: "live-read-only",
        recordsRead: 1,
        validCount: 1,
        needsReview: 0,
        leads: [],
        validationIssues: [],
        persisted: false,
        writeActionsEnabled: false,
      }),
    );
    vi.stubGlobal("fetch", fetchMock);

    await api.getSalesforceLeadReport(12);

    expect(fetchMock).toHaveBeenCalledWith(
      ENDPOINTS.salesforceLeadReport,
      expect.objectContaining({
        method: "POST",
        body: JSON.stringify({ limit: 12 }),
      }),
    );
    expect(String(fetchMock.mock.calls[0][1]?.body)).not.toMatch(
      /password|client_secret|access_token/i,
    );
  });
});
