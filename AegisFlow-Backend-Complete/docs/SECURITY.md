# Security boundaries

- Every repair replay requires backend-recorded human approval; replay reruns
  independent validation checks before it can proceed.
- Workflow execution, failure injection, and recovery are local simulations. No real
  downstream connector is invoked or modified.
- Gemini is called from the backend using `GEMINI_API_KEY`; the key is never returned
  by API responses or exposed in browser code.
- Model output is treated as untrusted data and cannot execute code or commands.
- Original incident payloads are preserved in repair proposals and recovery attempts
  are recorded with outcomes.

Before exposing this local sandbox to a network, add authentication and role-based
access control, restrict API origins, and apply production data-retention and logging
policies.
