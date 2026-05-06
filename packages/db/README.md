# DB

Prisma schema, migrations, seed scripts, and DB client boundary.

Phase 1 target is Railway Postgres. Local Phase 0.5 may run synthetic in-memory API data until Postgres credentials are configured.

Auth persistence has a checked-in migration at `prisma/migrations/20260506192500_auth_persistence_schema/migration.sql`.

Required verification before a Railway-backed auth claim:

- `pnpm --filter @eyther/db prisma:validate`
- `pnpm --filter @eyther/db test`
- `DATABASE_URL=[REDACTED] pnpm --filter @eyther/db exec prisma migrate deploy --schema prisma/schema.prisma`

Do not seed real patient data, raw claim documents, raw email bodies, mailbox credentials, or identifiable hospital fixtures.
