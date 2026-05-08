# Vercel Infrastructure Notes

Vercel is the frontend target for `apps/web`. Railway is not the frontend host.

GOV-01 does not deploy. Before any preview, verify `NEXT_PUBLIC_API_BASE_URL`, session-cookie posture, CORS/CSRF expectations, custom domain routing, and synthetic/no-real-PII labelling.

## Project settings

Use the repository root as the Vercel project root so workspace packages resolve correctly.

- Install command: `pnpm install --frozen-lockfile`
- Build command: `pnpm build:web`
- Output directory: `apps/web/.next`
- Framework: Next.js

The root `vercel.json` records these settings for preview consistency.

## Required environment names

Values must be configured in Vercel, not committed:

- `NEXT_PUBLIC_API_BASE_URL=[RAILWAY_API_URL]/api/v1`

Do not create a Vercel preview until the Railway API URL exists. A frontend preview that points at localhost, an unavailable API, or demo fallback does not satisfy Phase 1 deployment evidence.
