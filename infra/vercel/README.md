# Vercel Frontend Boundary

`apps/web` is the only Vercel target. Backend/API/worker/Postgres deployment belongs to Railway after external auth is provided.

Required later:
- Vercel project/env ownership verification.
- `NEXT_PUBLIC_API_BASE_URL=[REDACTED]` for preview/production.
- Cookie, CORS, CSRF, custom domain, and synthetic/no-real-PII preview labelling review.
