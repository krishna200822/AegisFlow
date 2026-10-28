# Deployment plan

Local development: frontend + FastAPI + PostgreSQL + Redis. Production: managed PostgreSQL, managed Redis, secrets manager, TLS reverse proxy, worker process, metrics/alerts, and backups. Use separate credentials and databases per environment.
