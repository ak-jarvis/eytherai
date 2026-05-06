# Eyther Product

Product-code repository for Eyther Phase 1: a hospital-side unified cashless claims dashboard.

This repo is separate from the Eyther-AI vault. The vault remains the product/company brain at `/Users/arifkhan/Projects/eyther-ai`.

## Phase 1 Status

This branch contains the Phase 1 synthetic local app and release-gate scaffolding. It is built for reviewer-gated local evidence, not production release.

Implemented locally with synthetic/no-patient-data fixtures:

- invite/login/logout user access with protected API session
- onboarding readiness, hospital profile, setup evidence, and anonymised payer mix
- claim filing, packet creation, document metadata attachment/replacement
- live claim detail, lifecycle events, manual route/download, and manual email match
- worklist, owner summary, finance export, and audit/reveal guard surfaces
- Prisma-backed auth and Phase 1 operational persistence paths for Postgres

Still intentionally unbuilt or blocked:

- live Send activation
- real mailbox/OAuth integration
- raw claim-document storage or parser extraction against real documents
- hosted Railway API/worker/Postgres evidence
- Vercel preview wired to Railway API
- non-author reviewer approval and GitHub Actions checks

- Backend/API/workers/Postgres target: Railway.com.
- Frontend target: Vercel.
- Package manager/runtime: pnpm 10, Node.js 22, Turborepo-compatible monorepo.
- Local shells should use Node.js 22 via `.node-version` or `.nvmrc`; Node 25 will run with engine warnings and should not be used as release evidence.
- Fixtures are synthetic only. No real patient records, mailbox screenshots, raw claim files, raw email bodies, raw MIME, OAuth secrets, app passwords, tokens, prescription photos, or identifiable hospital documents.
- Active Send remains blocked until exact hospital x insurer/TPA/scheme authority route evidence and no-patient-data test-email acknowledgement exist.

## Local Verification

```bash
pnpm install --frozen-lockfile
pnpm verify:phase1
```

`pnpm verify:phase1` runs lint, typecheck, tests, build, fixture scan, PII/secret scan, API tests, Prisma validate, deployment config JSON parse, built API/web boot, Active Send backend guard, and Playwright.

For Prisma/Postgres persistence evidence, use a throwaway synthetic Postgres database only:

```bash
API_PORT=3042 DATABASE_URL=postgresql://postgres:postgres@localhost:55433/eyther_synthetic pnpm verify:prisma-phase1
```

For external release gates:

```bash
pnpm verify:external-gates
```

That verifier is expected to fail until GitHub Actions/checks/review, Railway hosted API/worker/Postgres, and Vercel preview evidence are available. It does not read or print Railway variables, credentials, raw email, raw MIME, raw claim documents, or patient data.

## Local URLs

When running the app locally:

- API: `http://localhost:3001/api/v1/health`
- Web: `http://localhost:3000`

The local verifier uses isolated ports by default: API `3021`, web `3020`.

## Release Gates

Before merge/release:

- GitHub Actions must be enabled and PR checks must pass.
- A non-author reviewer must approve or formally block.
- Railway must host API, worker, and Postgres with `EYTHER_AUTH_STORE=prisma` and `EYTHER_PHASE1_STORE=prisma`.
- Vercel preview must use `NEXT_PUBLIC_API_BASE_URL=<Railway API URL>/api/v1`.
- Live Send must remain blocked unless the live-send evidence gate is separately satisfied.
