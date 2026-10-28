# Frontend/backend integration

The connected AegisFlow UI is in `../AegisFlow/`. See the architecture root's
[`FRONTEND-INTEGRATION.md`](../FRONTEND-INTEGRATION.md) for the UI-to-endpoint map,
local run instructions, Gemini configuration, and recovery safety contract.

Run this backend from `backend/` with `uvicorn app.main:app --reload --host 127.0.0.1
--port 8000`. Configure `GEMINI_API_KEY` in the backend environment only; retain
`GEMINI_MODEL=gemini-3.6-flash`.

For Stripe webhook tests, configure `STRIPE_WEBHOOK_SECRET` with a test-mode signing
secret. Run `stripe listen --forward-to localhost:8000/api/v1/stripe/webhook` in
Stripe CLI test mode. No Stripe credentials are needed for
`POST /api/v1/stripe/simulate/failure`.
