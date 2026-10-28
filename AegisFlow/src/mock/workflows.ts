import type { Workflow } from "@/types";

/** Extra seed info used by the scenario engine (not part of the public Workflow type). */
export interface WorkflowSeed extends Workflow {
  samplePayload: Record<string, unknown>;
  idField: string;
  idAlias: string;
  numberField: string;
  successRate: number; // seed success ratio for generated history
  runsPerHour: number;
}

const steps = (names: [string, string][]) =>
  names.map(([name, description], i) => ({ id: `s${i + 1}`, name, description }));

const schemaOf = (p: Record<string, unknown>) =>
  Object.fromEntries(Object.entries(p).map(([k, v]) => [k, Array.isArray(v) ? "array" : typeof v]));

function wf(
  w: Omit<WorkflowSeed, "inputSchema" | "steps" | "status"> & {
    steps?: [string, string][];
    status?: Workflow["status"];
  },
): WorkflowSeed {
  return {
    ...w,
    status: w.status ?? "healthy",
    inputSchema: schemaOf(w.samplePayload),
    steps: steps(
      w.steps ?? [
        ["Receive payload", "Accept inbound event from trigger"],
        ["Validate required fields", "Check payload against input schema"],
        ["Normalize payload", "Coerce formats and map aliases"],
        ["Write to destination", `Push record to ${w.integration}`],
        ["Verify result", "Read back and compare against expected output"],
      ],
    ),
  };
}

export const WORKFLOW_SEEDS: WorkflowSeed[] = [
  wf({
    id: "wf-cds-01",
    name: "Customer Data Synchronization",
    description: "Syncs CRM customer profiles into the billing ledger.",
    integration: "Salesforce → Stripe",
    samplePayload: { customer_id: "CUS-88213", email: "m.ortiz@northwind.io", plan: "growth", seats: 14, country: "US" },
    idField: "customer_id",
    idAlias: "customerId",
    numberField: "seats",
    outputSchema: { ledger_id: "string", synced_at: "string", status: "string" },
    retryPolicy: { maxAttempts: 3, backoff: "exponential · 2s base", idempotent: false },
    successRate: 0.97,
    runsPerHour: 9,
    steps: [
      ["Receive customer payload", "Webhook from Salesforce outbound message"],
      ["Validate required fields", "customer_id, email, plan, seats"],
      ["Normalize the payload", "Lowercase email, map legacy aliases"],
      ["Sync customer record", "Upsert customer in Stripe billing"],
      ["Verify the final result", "Read back record and compare fields"],
    ],
  }),
  wf({
    id: "wf-lep-02",
    name: "Lead Enrichment Pipeline",
    description: "Enriches inbound leads with firmographic data.",
    integration: "HubSpot → Clearbit",
    samplePayload: { lead_id: "LD-30411", email: "j.kim@acme-logistics.com", company: "Acme Logistics", employees: 420 },
    idField: "lead_id",
    idAlias: "leadId",
    numberField: "employees",
    outputSchema: { lead_id: "string", industry: "string", score: "number" },
    retryPolicy: { maxAttempts: 3, backoff: "linear · 5s", idempotent: true },
    successRate: 0.9,
    runsPerHour: 14,
    status: "degraded",
  }),
  wf({
    id: "wf-inv-03",
    name: "Invoice Processing",
    description: "Parses supplier invoices and posts them to accounts payable.",
    integration: "Gmail → NetSuite",
    samplePayload: { invoice_id: "INV-2026-0912", vendor: "Kestrel Supply Co.", amount: 1250.5, currency: "USD", line_items: 6 },
    idField: "invoice_id",
    idAlias: "invoiceNumber",
    numberField: "amount",
    outputSchema: { bill_id: "string", posted: "boolean" },
    retryPolicy: { maxAttempts: 2, backoff: "exponential · 10s base", idempotent: false },
    successRate: 0.95,
    runsPerHour: 4,
  }),
  wf({
    id: "wf-iua-04",
    name: "Inventory Update Automation",
    description: "Propagates warehouse stock counts to the storefront.",
    integration: "ShipBob → Shopify",
    samplePayload: { sku: "SKU-TR-4471", warehouse: "RNO-2", quantity: 38, location: "A-14-03" },
    idField: "sku",
    idAlias: "SKU",
    numberField: "quantity",
    outputSchema: { variant_id: "string", available: "number" },
    retryPolicy: { maxAttempts: 5, backoff: "exponential · 1s base", idempotent: true },
    successRate: 0.96,
    runsPerHour: 20,
  }),
  wf({
    id: "wf-ndp-05",
    name: "Notification Delivery Pipeline",
    description: "Fans out transactional notifications over email and SMS.",
    integration: "Segment → Twilio",
    samplePayload: { message_id: "MSG-771902", recipient: "+14155550142", template: "order_shipped", priority: 2 },
    idField: "message_id",
    idAlias: "messageId",
    numberField: "priority",
    outputSchema: { delivery_id: "string", channel: "string" },
    retryPolicy: { maxAttempts: 4, backoff: "exponential · 2s base", idempotent: true },
    successRate: 0.88,
    runsPerHour: 26,
    status: "degraded",
  }),
  wf({
    id: "wf-ors-06",
    name: "Order Routing Service",
    description: "Routes paid orders to the nearest fulfillment center.",
    integration: "Shopify → ShipBob",
    samplePayload: { order_id: "ORD-55120", region: "us-west", items: 3, priority: 1 },
    idField: "order_id",
    idAlias: "orderId",
    numberField: "items",
    outputSchema: { shipment_id: "string" },
    retryPolicy: { maxAttempts: 3, backoff: "exponential · 2s base", idempotent: true },
    successRate: 0.98,
    runsPerHour: 12,
  }),
  wf({
    id: "wf-pts-07",
    name: "Payment Reconciliation",
    description: "Matches processor payouts against ledger entries.",
    integration: "Stripe → QuickBooks",
    samplePayload: { payout_id: "PO-19920", amount: 48210.75, currency: "USD", transactions: 312 },
    idField: "payout_id",
    idAlias: "payoutId",
    numberField: "transactions",
    outputSchema: { journal_id: "string", matched: "number" },
    retryPolicy: { maxAttempts: 2, backoff: "fixed · 30s", idempotent: false },
    successRate: 0.99,
    runsPerHour: 1,
  }),
  wf({
    id: "wf-tkt-08",
    name: "Support Ticket Triage",
    description: "Classifies inbound tickets and assigns queues.",
    integration: "Zendesk → Slack",
    samplePayload: { ticket_id: "TCK-80122", subject: "Refund not received", priority: 3, channel: "email" },
    idField: "ticket_id",
    idAlias: "ticketId",
    numberField: "priority",
    outputSchema: { queue: "string" },
    retryPolicy: { maxAttempts: 3, backoff: "linear · 3s", idempotent: true },
    successRate: 0.97,
    runsPerHour: 10,
  }),
  wf({
    id: "wf-emp-09",
    name: "Employee Onboarding",
    description: "Provisions accounts for new hires across SaaS tools.",
    integration: "BambooHR → Okta",
    samplePayload: { employee_id: "EMP-2231", email: "r.patel@company.com", department: "Finance", apps: 7 },
    idField: "employee_id",
    idAlias: "employeeId",
    numberField: "apps",
    outputSchema: { okta_user: "string" },
    retryPolicy: { maxAttempts: 2, backoff: "fixed · 60s", idempotent: false },
    successRate: 0.99,
    runsPerHour: 0.5,
  }),
  wf({
    id: "wf-mkt-10",
    name: "Campaign Audience Sync",
    description: "Pushes segment membership to ad platforms.",
    integration: "Segment → Google Ads",
    samplePayload: { audience_id: "AUD-118", name: "Trial expiring 7d", members: 2140 },
    idField: "audience_id",
    idAlias: "audienceId",
    numberField: "members",
    outputSchema: { list_id: "string" },
    retryPolicy: { maxAttempts: 3, backoff: "exponential · 5s base", idempotent: true },
    successRate: 0.98,
    runsPerHour: 2,
  }),
  wf({
    id: "wf-rpt-11",
    name: "Daily Revenue Report",
    description: "Aggregates revenue metrics and posts a daily digest.",
    integration: "Snowflake → Slack",
    samplePayload: { report_id: "RPT-1028", date: "2026-10-27", rows: 18 },
    idField: "report_id",
    idAlias: "reportId",
    numberField: "rows",
    outputSchema: { message_ts: "string" },
    retryPolicy: { maxAttempts: 2, backoff: "fixed · 120s", idempotent: true },
    successRate: 1,
    runsPerHour: 0.5,
  }),
  wf({
    id: "wf-ctr-12",
    name: "Contract Renewal Alerts",
    description: "Flags contracts approaching renewal for account owners.",
    integration: "DocuSign → Salesforce",
    samplePayload: { contract_id: "CTR-4410", account: "Globex Corp", days_remaining: 30 },
    idField: "contract_id",
    idAlias: "contractId",
    numberField: "days_remaining",
    outputSchema: { task_id: "string" },
    retryPolicy: { maxAttempts: 3, backoff: "linear · 10s", idempotent: true },
    successRate: 0.99,
    runsPerHour: 1,
  }),
];
