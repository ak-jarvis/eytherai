# Railway Infrastructure Notes

Railway is the approved Phase 0.5 / Phase 1 backend target for `apps/api`, `apps/worker`, and Railway Postgres.

GOV-01 does not deploy. Before any Railway action, verify project ownership, environment names, service names, PostgreSQL version/region, backup posture, logging/redaction, and secret access policy.

Required later environment variables must be stored in Railway environment/secret tooling, never committed here. Use `[REDACTED]` placeholders in docs.
