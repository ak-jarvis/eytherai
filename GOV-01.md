# GOV-01 Release Gate Notes

## Original Scaffold Provenance

Owner profile: eythercto / Nilekani.
Builder runtime/profile: Hermes CLI / eythercto.
Model/API: openai-codex / gpt-5.5 as shown in session header.
Reviewer profile: eytherreviewer.
Kanban task ID: t_855a76d0.

Initial scope:
- Repo scaffold for `ak-jarvis/eytherai`.
- pnpm + Turborepo monorepo.
- `apps/api`, `apps/worker`, `apps/web`.
- `packages/contracts`, `packages/db`, `packages/ui`, `packages/config`.
- `tests/e2e`, `tests/fixtures/synthetic`.
- `infra/railway`, `infra/vercel`, `.github`.

Initial boundaries:
- No AWS scaffold.
- No Railway deploy or project mutation; Railway auth is deferred.
- No Phase 0.5 mailbox feature logic.
- No real patient PII, raw MIME, hospital documents, live mailbox credentials, OAuth secrets, or live send.

## Phase 1 Overlay

On 2026-05-08, the scaffold branch was upgraded with the verified Phase 1 local app tree from `feat/t_855a76d0-gov-01-scaffold` because that full build branch had no shared Git history with `ak-jarvis/main`.

The overlay keeps the PR branch based on `ak-jarvis/main` and carries the Phase 1 implementation as a normal reviewable PR update:
- invite/login session flow
- role-scoped access shell
- onboarding readiness and no-PII setup evidence
- claim creation and packet assembly surfaces
- worklist, owner summary, finance export, unmatched mailbox, and audit surfaces
- Active Send guard kept blocked until live hospital x insurer/TPA/scheme authority evidence exists
- Prisma-backed auth and Phase 1 operational persistence path
- Railway API/worker config, Vercel web config, and external release gate verifier

The scaffold-only Playwright config check is superseded by `scripts/verify-phase1-local-ci.sh`, which starts the built API and web app on checked local ports and runs the full synthetic Playwright journey.
