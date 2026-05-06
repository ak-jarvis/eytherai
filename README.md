# Eyther Product

Product-code repository for Eyther Phase 1: a hospital-side unified cashless claims dashboard.

This repo is separate from the Eyther-AI vault. The vault remains the product/company brain at `/Users/arifkhan/Projects/eyther-ai`.

## GOV-01 Scaffold Boundary

This PR creates repo scaffolding only. It does not implement mailbox ingestion, claim-file parsing, Active Send, deduction recovery, hospital onboarding, or Phase 0.5 feature logic.

- Backend/API/workers/Postgres target: Railway.com.
- Frontend target: Vercel.
- Package manager/runtime: pnpm 10, Node.js 22, Turborepo-compatible monorepo.
- Fixtures are synthetic only. No real patient records, mailbox screenshots, raw claim files, raw email bodies, raw MIME, OAuth secrets, app passwords, tokens, prescription photos, or identifiable hospital documents.
- Active Send remains blocked until a later feature PR implements the backend guard with hospital x insurer/TPA/scheme authority evidence and no-patient-data test-email acknowledgement.

## Local Commands

```bash
pnpm install --frozen-lockfile
pnpm lint
pnpm typecheck
pnpm test
pnpm build
pnpm fixtures:scan
pnpm pii:scan
```

Local URLs after app code is running:

- API: `http://localhost:3001/api/v1/health`
- Web: `http://localhost:3000`
