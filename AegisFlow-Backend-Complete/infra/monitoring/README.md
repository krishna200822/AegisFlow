# Monitoring integration

The backend currently writes structured application logs and exposes operational metrics at `/api/v1/analytics/metrics`. `prometheus.yml` is a starter scrape configuration, not a complete production observability stack.

For production, instrument FastAPI with Prometheus/OpenTelemetry middleware, configure a scrape target reachable from the Prometheus container, and add alert rules for elevated 5xx responses, growing unresolved incident counts, Gemini quota errors, and repeated replay failures. Do not expose the metrics endpoint publicly without an access-control policy.
