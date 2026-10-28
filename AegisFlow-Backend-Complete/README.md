# AegisFlow backend architecture

This package contains the **backend and supporting architecture only**. It intentionally does not include the React frontend. Copy `backend/`, `contracts/`, `infra/`, `docs/`, `.github/`, and this README beside your existing `frontend/` directory.

## Implemented in this backend

- FastAPI API with health/readiness routes and CORS configuration.
- SQLite persistence for workflows, incidents, executions, repair proposals, logs, metrics source data, and post-mortems.
- Workflow list/create and local sandbox execution.
- Failure injection for `missing_field`, `invalid_type`, `rate_limit`, `timeout`, and `schema_mismatch`.
- Structured log ingestion, search, filters, and JSON-compatible responses.
- Gemini diagnosis and repair proposals using the Google Gen AI SDK. When the key/model is unavailable, a clearly labeled deterministic rule-engine fallback keeps the prototype usable.
- Repair risk score, validation checks, approval/rejection lifecycle, audit attempts, and guarded sandbox replay.
- Error clustering, healing metrics, and post-mortem generation.
- Modular agent wrappers and tests.
- Local-development-only, read-only Salesforce Lead report using OAuth client credentials.

## Run on Windows PowerShell

```powershell
cd backend
py -3.11 -m venv .venv
.\.venv\Scripts\Activate.ps1
python -m pip install --upgrade pip
pip install -r requirements.txt
Copy-Item .env.example .env
notepad .env
uvicorn app.main:app --reload --port 8000
```

Add your Google AI Studio API key to `GEMINI_API_KEY` in `backend/.env`. The requested default model is `gemini-3.6-flash`; Google model IDs change and access varies, so if the API rejects it, set `GEMINI_MODEL` to an exact model ID available to your account. Keep the key in the backend only.

Open `http://127.0.0.1:8000/docs` and `http://127.0.0.1:8000/api/v1/health`.

## API routes

| Method | Route | Purpose |
|---|---|---|
| GET | `/api/v1/health` | Liveness/model configuration |
| GET | `/api/v1/ready` | Readiness |
| GET/POST | `/api/v1/workflows` | List/create workflows |
| GET | `/api/v1/workflows/{id}` | Workflow details |
| POST | `/api/v1/workflows/{id}/execute` | Local sandbox execution |
| GET | `/api/v1/incidents` | Search/filter incidents |
| GET | `/api/v1/incidents/{id}` | Incident detail |
| POST | `/api/v1/incidents/{id}/analyze` | Gemini or rule-engine diagnosis |
| POST | `/api/v1/incidents/{id}/repairs` | Generate repair proposal |
| GET/POST | `/api/v1/logs` | Search/ingest structured logs |
| POST | `/api/v1/simulate/failure` | Create a simulated incident |
| GET | `/api/v1/repairs/{id}` | Repair details |
| POST | `/api/v1/repairs/{id}/validate` | Validate proposed changes |
| POST | `/api/v1/repairs/{id}/approve` | Record human approval |
| POST | `/api/v1/repairs/{id}/reject` | Reject proposal |
| POST | `/api/v1/repairs/{id}/apply` | Guarded sandbox replay |
| GET | `/api/v1/analytics/metrics` | Healing metrics |
| GET | `/api/v1/analytics/clusters` | Failure clusters |
| POST | `/api/v1/analytics/postmortems/{id}` | Generate post-mortem |
| GET | `/api/v1/salesforce/status` | Check backend-only Salesforce configuration |
| POST | `/api/v1/salesforce/leads/report` | Read, validate, and prioritize up to 100 Leads without writing or persisting records |

## Frontend integration

The frontend currently declares `USE_MOCK = true` in `frontend/src/services/api.ts`. This backend does not silently modify your frontend. To use live endpoints, switch that API adapter to real `fetch()` calls and set Vite proxy `/api` to `http://127.0.0.1:8000`. Keep response mapping aligned with the frontend's camelCase types. See `FRONTEND-INTEGRATION.md`.

## Safety boundary

Workflow execution and recovery remain sandbox simulations. The optional Salesforce report is a separate, local-development-only read operation; it fetches a minimal Lead field set and does not persist records or write to Salesforce. Its routes require loopback access. The app has no user authentication, so do not expose the development backend to a network or use this report in a multi-user deployment until authentication and authorization are implemented. A repair must pass validation; risky or non-idempotent workflows require approval.
