# AegisFlow

AegisFlow is a hackathon prototype for a workflow reliability console. It demonstrates
how an operator can observe workflow runs, inspect failures, request a diagnosis, review
a constrained repair proposal, validate it, and record a guarded recovery simulation.

> **Prototype boundary:** seeded workflows and customer-like payloads are demo data.
> Standard workflow runs, injected failures, repair replays, and Stripe failure
> simulations run in the local sandbox. They do not update Salesforce, Stripe, or any
> other external business system.

## Contents

- [What is included](#what-is-included)
- [Architecture](#architecture)
- [Deploy frontend and backend on Render](#deploy-frontend-and-backend-on-render)
- [Run the application on Windows](#run-the-application-on-windows)
- [Walk through the demo](#walk-through-the-demo)
- [Features by page](#features-by-page)
- [Failure and recovery lifecycle](#failure-and-recovery-lifecycle)
- [Optional backend integrations](#optional-backend-integrations)
- [API overview](#api-overview)
- [Configuration](#configuration)
- [Tests and build](#tests-and-build)
- [Troubleshooting](#troubleshooting)
- [Security and limitations](#security-and-limitations)

## What is included

- **React frontend:** existing dashboard and operator console in `AegisFlow/`.
- **FastAPI backend:** API, application services, and tests in
  `AegisFlow-Backend-Complete/backend/`.
- **SQLite storage:** local records for workflows, incidents, repairs, executions,
  logs, analytics source data, settings, post-mortems, and Stripe test events.
- **Deterministic demo data:** predefined workflows and sample payloads used to make
  the prototype demonstrable without connecting a CRM or payment provider.
- **Optional AI diagnosis and repair planning:** Gemini requests are made by the
  backend only. A deterministic rules-based result is used when Gemini is not
  configured or unavailable; the UI labels the source.
- **Optional Stripe test webhook:** signature-verified test-mode events can be stored,
  with failure events creating incidents. A local simulator works without Stripe
  credentials.
- **Optional Salesforce read-only Lead report:** a separate local-development-only
  report can read a bounded set of Leads when backend OAuth credentials are configured.
  It is not the standard workflow executor.

## Architecture

```text
Browser (React / Vite, localhost:5173)
            |
            | HTTP JSON, /api/v1
            v
FastAPI backend (localhost:8000)
            |
            +-- SQLite local application records
            +-- Gemini API (optional, backend key only)
            +-- Stripe test webhooks (optional; verification only)
            +-- Salesforce OAuth and read-only Lead query (optional)
```

The frontend API base defaults to `http://localhost:8000/api/v1`. The backend enables
CORS for the local Vite origins `http://localhost:5173` and
`http://127.0.0.1:5173`.

## Deploy frontend and backend on Render

Create two Render **Web Services** from this repository.

### Frontend service

- **Root Directory:** `AegisFlow`
- **Build Command:** `npm ci && npm run build`
- **Start Command:** `npm start`
- **Environment Variable:** `VITE_API_BASE_URL` = the backend service URL, without `/api/v1`

The start script serves the TanStack Start server-rendered app and its built client assets.

### Backend service

- **Root Directory:** `AegisFlow-Backend-Complete/backend`
- **Build Command:** `pip install -r requirements.txt`
- **Start Command:** `uvicorn app.main:app --host 0.0.0.0 --port $PORT`
- **Environment Variable:** `CORS_ORIGINS` = the exact frontend service URL

Set the frontend API variable before building so Vite includes the backend URL in the
client bundle. If either URL changes, update the corresponding environment variable and
redeploy. This prototype has no user authentication; do not use it with sensitive data
or expose it for multi-user use.

## Run the application on Windows

Use two PowerShell terminals and keep both servers running while you use the website.

### 1. Start the backend

From the project root:

```powershell
cd C:\Users\krish\Desktop\AegisFlow-Architecture-Ready\AegisFlow-Backend-Complete\backend
..\.venv\Scripts\Activate.ps1
uvicorn app.main:app --reload --host 127.0.0.1 --port 8000
```

If the existing virtual environment is unavailable, create one and install the
backend requirements:

```powershell
cd C:\Users\krish\Desktop\AegisFlow-Architecture-Ready\AegisFlow-Backend-Complete\backend
py -3.11 -m venv ..\.venv
..\.venv\Scripts\Activate.ps1
python -m pip install --upgrade pip
pip install -r requirements.txt
uvicorn app.main:app --reload --host 127.0.0.1 --port 8000
```

Check backend health at <http://127.0.0.1:8000/> or open the interactive API docs at
<http://127.0.0.1:8000/docs>.

### 2. Start the frontend

In another PowerShell terminal:

```powershell
cd C:\Users\krish\Desktop\AegisFlow-Architecture-Ready\AegisFlow
npm install
npm run dev
```

Open the URL Vite prints, normally <http://localhost:5173/>.

### 3. Optional environment file

The active backend reads settings from `AegisFlow-Backend-Complete/backend/.env`
(and the backend package parent `.env`). Start from
`AegisFlow-Backend-Complete/backend/.env.example` if you need optional integrations.
Create a private `.env`; do not overwrite or commit `.env.example`.

If there is not already a `.env` in the active backend directory, create one in
PowerShell with:

```powershell
cd C:\Users\krish\Desktop\AegisFlow-Architecture-Ready\AegisFlow-Backend-Complete\backend
if (-not (Test-Path .env)) { Copy-Item .env.example .env }
```

If `.env` already exists, edit it carefully and keep its existing private values.

With no API credentials configured, the demo app still runs. Gemini uses its labeled
rules-based fallback. Salesforce live reports stay disabled. Stripe local simulations
still work without Stripe credentials.

## Walk through the demo

### Five-minute presentation

1. **Overview:** explain that the dashboard summarizes demo workflow health, incidents,
   recorded runs, and recovery attempts.
2. **Workflows:** open **Customer Data Synchronization**, review its steps and retry
   policy, and run a sandbox execution if an execution plan is available.
3. **Inject a failure:** use **Simulate Failure** or **Inject chaos**, choose a failure
   type, and inspect the incident that appears.
4. **Investigate:** open the incident. Point out the error evidence, preserved payload,
   diagnosis source, and correlated logs.
5. **Repair Center:** review the repair proposal and validation results. Explain that
   failed checks or required review stop the repair from being applied.
6. **Logs and Analytics:** show the recorded events, filters, metrics, and failure
   groupings.
7. **Stripe demo:** on Overview, use **Simulate Stripe failure** to show a test-mode
   event linked to an incident. It does not create or retry a payment.
8. **Salesforce panel:** explain that it is optional. If credentials are not configured,
   the report button remains disabled; do not describe it as a live connection.

### Example sample workflow objective

On **Workflows**, use this objective:

> Process these customer leads, validate their information, prioritize the best
> prospects, and generate a summary report.

Select **Create workflow** to save a workflow definition and generate a deterministic
plan. The **Run workflow** control records a sandbox execution. It does not fetch leads
or execute the described business actions.

### Example failure scenario

Use an `invalid_type` failure on **Customer Data Synchronization**. The demo can
produce a payload where a number field contains a string such as `NOT_A_NUMBER`.
Diagnosis explains the mismatch. A repair may flag the record for manual review instead
of inventing a numeric value. If the proposed payload still violates the workflow
schema, validation should fail and block replay.

Other supported local failure types are `missing_field`, `rate_limit`, `timeout`, and
`schema_mismatch`. The simulation creates a demo incident and execution record; it
does not intentionally make a real service fail.

## Features by page

### Overview

- Counts for monitored workflows, active incidents, verified sandbox recoveries, and
  healing success rate.
- Execution volume chart and workflow-health summary.
- Incident queue with links to incident details.
- Stripe test-mode event history and a local test-failure simulator.

### Workflows

- Create a workflow from a text objective using the deterministic planner.
- Inspect seeded and created workflow definitions, steps, retry policies, and recent
  execution history.
- Run a sandbox execution and inspect whether it completed or failed.
- Optionally display a Salesforce Lead report when backend OAuth configuration exists.
  This report is separate from the sandbox workflow run.

### Incidents

- Search and filter incidents by status and severity.
- Inspect the captured failure, original payload, workflow, and execution evidence.
- Request backend diagnosis and review the reported source, confidence, evidence,
  alternatives, and next step.
- Escalate an incident for manual review or resolve it manually.
- Stripe payment incidents are investigation-only; repair and replay are unavailable.

### Repair Center

- Create and inspect constrained repair proposals.
- Compare original and proposed payloads and review operations, risk, and reasons.
- Run backend validation for required fields, types, source-data preservation,
  change risk, and replay safety.
- Record approval or rejection. The backend enforces approval and successful validation
  before a simulated replay is allowed.
- The replay is still local simulation and does not apply data to an external provider.

### Execution Logs

- Search recorded log messages and event names.
- Filter by severity and workflow.
- Expand entries to inspect associated metadata.
- Export the filtered log set as JSON.

### Analytics

- Review execution and recovery metrics, failure clusters, and post-mortem summaries.
- Metrics are based on locally stored prototype records, not production telemetry.

### Settings

- Adjust prototype monitoring preferences and local recovery/validation policy values.
- Check Gemini model configuration and availability through the backend.
- A setting does not establish a connection to an external workflow source.

## Failure and recovery lifecycle

1. A failure is injected locally or received through a supported test event.
2. The backend stores an incident with a workflow and execution reference.
3. Logs associated with the execution and incident are available for inspection.
4. Diagnosis uses Gemini through the backend if configured; otherwise it returns a
   labeled deterministic fallback.
5. A repair proposal is reviewed and independently validated.
6. Failed validation blocks the repair. A human approval is still required where
   applicable.
7. An allowed replay is simulated and recorded locally.

The app intentionally does not silently coerce invalid or ambiguous customer values.
Operators must confirm a correction from a trusted source before using it.

## Optional backend integrations

### Gemini diagnosis

Set these in the backend `.env` to enable Gemini requests:

```dotenv
GEMINI_API_KEY=your_backend_api_key
GEMINI_MODEL=gemini-3.6-flash
```

The API key is backend-only and must never be placed in a `VITE_...` variable. Check
model configuration in **Settings** or call `GET /api/v1/settings/model-status`. If
Gemini is unavailable, diagnosis/repair planning may use the labeled deterministic
fallback.

### Stripe test mode

The dashboard simulator requires no Stripe credentials. It creates a local simulated
test event and incident.

For signed test webhooks, configure a Stripe **test-mode** webhook signing secret only
in the backend `.env`:

```dotenv
STRIPE_WEBHOOK_SECRET=whsec_test_mode_secret
```

Forward Stripe CLI test events to:

```powershell
stripe listen --forward-to localhost:8000/api/v1/stripe/webhook
```

The backend verifies signatures, rejects events marked as live mode, and deduplicates
event IDs. It does not create charges, refunds, or payment retries. Stripe payment
incidents cannot be repaired or replayed through AegisFlow.

### Salesforce read-only Lead report

This feature is optional and disabled until configured. It is not necessary for the
hackathon demo, which can use seeded data.

To enable it, a Salesforce administrator must create/configure an OAuth Connected App
with the client-credentials flow and a least-privilege Run As user with API and read
permissions for Salesforce Lead fields `Name`, `Company`, `Status`, and `Rating`.
Configure only the backend `.env`:

```dotenv
SALESFORCE_CLIENT_ID=your_consumer_key
SALESFORCE_CLIENT_SECRET=your_consumer_secret
SALESFORCE_LOGIN_URL=https://test.salesforce.com
SALESFORCE_API_VERSION=v62.0
```

Use `https://test.salesforce.com` for a Salesforce sandbox, or
`https://login.salesforce.com` for production Salesforce. Restart the backend after
changing `.env`. On **Workflows**, check the Salesforce status and choose
**Run read-only report** when configured.

The report is restricted to local development and loopback clients, reads at most 100
unconverted leads, and queries only the fields listed above. It validates required
display fields, assigns deterministic priority scores using Salesforce rating and
status, and returns the report to the local browser. AegisFlow does not persist the
fetched records or write to Salesforce.

The project has no application user authentication. Do not expose this development
backend or the live Salesforce report over a network or deploy it for multiple users
without adding authentication and authorization first. A local browser displays lead
names and company names, so use only a trusted machine and an appropriately permissioned
Salesforce account.

## API overview

All API routes use the `/api/v1` prefix. Open `/docs` on the running backend for the
complete, current OpenAPI schema.

| Area | Routes | Purpose |
|---|---|---|
| Health | `GET /health`, `GET /ready` | Service and dependency readiness |
| Workflows | `GET/POST /workflows`, `GET /workflows/{id}`, `GET /workflows/{id}/executions`, `POST /workflows/{id}/execute` | List, create, inspect, and simulate workflows |
| Failure simulation | `POST /simulate/failure` | Create a local demo incident |
| Incidents | `GET /incidents`, `GET /incidents/{id}`, `POST /incidents/{id}/analyze`, `POST /incidents/{id}/repairs`, `POST /incidents/{id}/review`, `POST /incidents/{id}/resolve` | Investigate incidents and create proposals |
| Repairs | `GET /repairs`, `GET /repairs/{id}`, `POST /repairs/{id}/validate`, `POST /repairs/{id}/approve`, `POST /repairs/{id}/reject`, `POST /repairs/{id}/apply` | Validate and approval-gate sandbox recovery |
| Logs | `GET/POST /logs` | Search and record structured log entries |
| Analytics | `GET /analytics/metrics`, `/analytics/executions`, `/analytics/clusters`, `/analytics/postmortems`, `POST /analytics/postmortems/{incident_id}` | Metrics, failure groupings, and post-mortems |
| Settings | `GET/PATCH /settings`, `GET /settings/model-status`, `POST /settings/reset-demo` | Read/update settings, check Gemini, reset demo records |
| Stripe | `GET /stripe/status`, `GET /stripe/events`, `POST /stripe/webhook`, `POST /stripe/simulate/failure` | Stripe test-mode event handling and simulator |
| Salesforce | `GET /salesforce/status`, `POST /salesforce/leads/report` | Local-only read-only Lead report |

Collection responses generally use `{ "items": [...], "total": n }`. The local
Salesforce report request accepts `{"limit": 20}`; the limit is bounded to 1–100.

## Configuration

Common backend settings:

| Variable | Purpose | Default |
|---|---|---|
| `APP_NAME` | API display name | `AegisFlow API` |
| `ENVIRONMENT` | Backend environment; Salesforce report requires local/development | `development` |
| `API_PREFIX` | API route prefix | `/api/v1` |
| `CORS_ORIGINS` | Comma-separated browser origins | Local development origins |
| `GEMINI_API_KEY` | Backend-only Gemini key | Empty |
| `GEMINI_MODEL` | Gemini model ID | `gemini-3.6-flash` |
| `STRIPE_WEBHOOK_SECRET` | Stripe test webhook signing secret | Empty |
| `SALESFORCE_CLIENT_ID` | Salesforce Connected App client ID | Empty |
| `SALESFORCE_CLIENT_SECRET` | Salesforce Connected App client secret | Empty |
| `SALESFORCE_LOGIN_URL` | Salesforce sandbox or production login URL | `https://login.salesforce.com` |
| `SALESFORCE_API_VERSION` | Salesforce REST API version | `v62.0` |
| `DATABASE_PATH` | SQLite database location | `./data/aegisflow.sqlite3` |
| `MAX_REQUEST_BYTES` | Maximum accepted Stripe webhook size | `1048576` |

Frontend API URL can be overridden with `VITE_API_BASE_URL`. It must point to the
backend origin or full `/api/v1` URL. Never put secrets in frontend environment
variables.

## Tests and build

### Frontend

```powershell
cd C:\Users\krish\Desktop\AegisFlow-Architecture-Ready\AegisFlow
npm test
npm run build
npm run lint
```

### Backend

The active backend source is `AegisFlow-Backend-Complete/backend/`. In PowerShell:

```powershell
cd C:\Users\krish\Desktop\AegisFlow-Architecture-Ready\AegisFlow-Backend-Complete\backend
$env:PYTHONPATH = (Get-Location).Path
..\.venv\Scripts\pytest.exe -q
..\.venv\Scripts\python.exe -m compileall -q app tests
```

Backend tests include workflow/repair behavior, Stripe signature verification and
deduplication, and Salesforce report behavior using mocked Salesforce HTTP responses.
They do **not** authenticate to a real Salesforce or Stripe account.

The latest recorded verification for this prototype was **20 backend tests passed**,
**6 frontend tests passed**, and a successful frontend production build. Focused
frontend lint and backend Python compilation also completed successfully. These checks
verify code and mocked/local behavior, not real provider credentials or live customer
data.

## Troubleshooting

### Frontend says it cannot reach the API

- Confirm the backend terminal is still running.
- Visit <http://127.0.0.1:8000/> and check for a healthy response.
- Confirm the frontend uses `http://localhost:8000/api/v1` or set
  `VITE_API_BASE_URL` to the correct backend origin.
- If changing Vite environment variables, restart the frontend development server.

### Workflows or incidents are empty/loading

- Start the backend and refresh the browser.
- Check the browser notification and backend terminal for the API error.
- Inspect <http://127.0.0.1:8000/docs> for route availability.

### Repair validation fails

Read each validation result. A schema-type failure means the proposed payload still
does not match the workflow contract. A review result is not a pass; it signals an
operator decision is needed. Correct source data only from a trusted source; do not
guess values to make the check pass.

### Gemini says unavailable or uses backend rules

Check `GEMINI_API_KEY`, `GEMINI_MODEL`, key permissions, quota, network access, and
**Settings → AI diagnostics**. Restart the backend after environment changes. The
prototype remains usable with the clearly labeled rule-based fallback.

### Salesforce report says setup required

The optional Salesforce variables must be present in the active backend `.env`, the
Connected App must allow client-credentials flow, and its Run As user must have API
and Lead read permissions. Restart FastAPI after editing `.env`. Never share the client
secret in a screenshot, chat, source file, or browser setting.

### Reset demo records

`POST /api/v1/settings/reset-demo` resets local incidents, logs, repairs, executions,
post-mortems, settings, and Stripe event records, then reseeds built-in workflows.
Treat this as a destructive operation for local demo history. It does not delete or
modify Salesforce data.

## Security and limitations

- This is a local-development hackathon prototype, not a production-ready operations
  platform.
- There is no user login, role-based access control, or multi-user tenant isolation.
  Keep the backend bound to loopback (`127.0.0.1`) and do not expose it to a network.
- Keep all integration credentials in the backend environment. Do not commit `.env`
  files, paste secrets into chat, or use frontend `VITE_` variables for secrets.
- Standard workflows and recovery are simulations. The optional Salesforce report is
  read-only and separate; Stripe support is limited to verified test-mode events and a
  local simulator.
- Validation and approval are enforced in the backend for simulated repair replay.
- The UI is not a substitute for checking source-system state or operator review.
- Before production use, add authentication and authorization, secret management,
  audit controls, monitoring, rate limits, integration-specific threat modeling,
  privacy review, and independently tested access policies.
