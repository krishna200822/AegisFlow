# API routes used by the application

All paths are prefixed with `/api/v1`. OpenAPI is available at `/openapi.json` and
Swagger UI at `/docs`.

| Feature | Routes |
|---|---|
| Health | `GET /health`, `GET /ready` |
| Workflows and executions | `GET/POST /workflows`, `GET /workflows/{id}`, `POST /workflows/{id}/execute`, `GET /workflows/{id}/executions` |
| Incidents | `GET /incidents`, `GET /incidents/{id}`, `POST /incidents/{id}/analyze`, `POST /incidents/{id}/repairs`, `POST /incidents/{id}/review`, `POST /incidents/{id}/resolve` |
| Failure simulation | `POST /simulate/failure` |
| Repair lifecycle | `GET /repairs`, `GET /repairs/{id}`, `POST /repairs/{id}/validate`, `/approve`, `/reject`, `/apply` |
| Logs | `GET/POST /logs` |
| Analytics | `GET /analytics/metrics`, `/analytics/clusters`, `/analytics/executions`, `/analytics/postmortems`; `POST /analytics/postmortems/{incident_id}` |
| Settings and Gemini status | `GET/PATCH /settings`, `GET /settings/model-status`, `POST /settings/reset-demo` |
| Stripe test-mode webhooks and simulation | `POST /stripe/webhook`, `GET /stripe/events`, `GET /stripe/status`, `POST /stripe/simulate/failure` |

Repair application is a simulated sandbox replay. The API reruns validation and
requires explicit approval before replay; no external connector is invoked.

Stripe webhook handling verifies signatures with the official Python SDK, rejects
live-mode events, deduplicates event IDs, and creates incidents for
`payment_intent.payment_failed`. Successful PaymentIntent events are recorded without
creating incidents. No payment, charge, refund, or retry operation is initiated.
