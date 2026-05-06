# GOV-01 Scaffold Notes

Owner profile: eythercto / Nilekani.  
Builder runtime/profile: Hermes CLI / eythercto.  
Model/API: openai-codex / gpt-5.5 as shown in session header.  
Reviewer profile: eytherreviewer.  
Kanban task ID: t_855a76d0.

Scope:
- Repo scaffold only for `ak-jarvis/eytherai`.
- pnpm + Turborepo monorepo.
- `apps/api`, `apps/worker`, `apps/web`.
- `packages/contracts`, `packages/db`, `packages/ui`, `packages/config`.
- `tests/e2e`, `tests/fixtures/synthetic`.
- `infra/railway`, `infra/vercel`, `.github`.

Boundaries:
- No AWS scaffold.
- No Railway deploy or project mutation; Railway auth is deferred.
- No Phase 0.5 mailbox feature logic.
- No real patient PII, raw MIME, hospital documents, live mailbox credentials, OAuth secrets, or live send.
