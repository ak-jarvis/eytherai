# Railway Backend Boundary

GOV-01 records Railway as the future backend/API/worker/Postgres target but does not log in, create projects, mutate environments, deploy services, or create databases.

Required later before staging or pilot data:
- AK-provided Railway auth and project access.
- Railway project, environment, service, Postgres plugin, region/data-residency, backup/restore, log access, and secret access review.
- Environment variables stored only in Railway/provider secret store. Use `[REDACTED]` placeholders in docs.
- No real patient data, raw email/MIME, hospital documents, or mailbox credentials until reviewer gate passes.
