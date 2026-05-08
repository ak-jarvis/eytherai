# API

NestJS API for Eyther Phase 1.

- Base path: `/api/v1`
- Port: `3001`
- Backend deployment target: Railway
- Default local auth store: synthetic in-memory, no Postgres required
- Railway auth store: set `EYTHER_AUTH_STORE=prisma` with `DATABASE_URL` after the auth migration is applied

No raw patient PII, raw email bodies, raw MIME, real claim documents, or credentials may be logged or returned in normal payloads.
