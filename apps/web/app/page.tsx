import { ScaffoldCard } from "@eyther/ui";

export default function Home() {
  return (
    <main className="shell">
      <section className="hero">
        <p className="ey-kicker">Eyther GOV-01</p>
        <h1>Product repo scaffold</h1>
        <p>
          Hospital-side cashless claims dashboard foundation. This repository is
          scaffolded only; Phase 0.5 mailbox, claim-file parsing, active-send,
          and deduction recovery logic must land through later PR-governed
          tasks.
        </p>
      </section>

      <div className="grid">
        <ScaffoldCard title="Backend">
          <p>
            apps/api and apps/worker are Railway targets. Live Railway project,
            Postgres, secrets, and deploy permissions remain external
            prerequisites.
          </p>
        </ScaffoldCard>
        <ScaffoldCard title="Frontend">
          <p>
            apps/web is a Vercel-targeted Next.js shell. No production routes,
            patient data, mailbox data, or hospital documents are included.
          </p>
        </ScaffoldCard>
        <ScaffoldCard title="Contracts, DB, UI">
          <p>
            Shared packages are placeholders for later TDD implementation of
            contracts, Railway Postgres schema, and reusable UI primitives.
          </p>
        </ScaffoldCard>
        <ScaffoldCard title="Safety">
          <p>
            Fixtures are synthetic only. No raw MIME, OAuth secrets, app
            passwords, real claim files, or identifiable patient records are
            stored.
          </p>
        </ScaffoldCard>
      </div>
    </main>
  );
}
