# Railway Infrastructure Notes

Railway is the approved Phase 0.5 / Phase 1 backend target for `apps/api`, `apps/worker`, and Railway Postgres.

GOV-01 does not deploy. Before any Railway action, verify project ownership, environment names, service names, PostgreSQL version/region, backup posture, logging/redaction, and secret access policy.

Required later environment variables must be stored in Railway environment/secret tooling, never committed here. Use `[REDACTED]` placeholders in docs.

## Service config paths

Configure each Railway service with an explicit config file path:

- API service: `/infra/railway/api.railway.json`
- Worker service: `/infra/railway/worker.railway.json`
- Database: Railway Postgres, PostgreSQL 16 if available

The API service must expose `PORT` and pass `GET /api/v1/health` before routing traffic.

## Required environment names

Values must be configured in Railway, not committed:

- `NODE_ENV=production`
- `PORT` supplied by Railway
- `DATABASE_URL=[REDACTED]`
- `EYTHER_AUTH_STORE=prisma`
- `CORS_ORIGINS=[VERCEL_PREVIEW_OR_PRODUCTION_ORIGIN]`
- Future mailbox/OAuth/secret references only after reviewer approval

Do not add real patient data, raw email, raw MIME, raw claim documents, mailbox screenshots, OAuth tokens, app passwords, or credentials to Railway variables, logs, fixtures, PRs, or vault evidence.

Before enabling `EYTHER_AUTH_STORE=prisma`, apply the checked-in Prisma migration to Railway Postgres and seed only synthetic/no-patient-data hospital users, roles, branch scope, and invites.
