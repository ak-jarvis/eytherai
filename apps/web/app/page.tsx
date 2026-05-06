import { StatusCard } from '@eyther/ui';

export default function HomePage() {
  return (
    <main className="shell">
      <section>
        <p className="eyebrow">GOV-01 scaffold</p>
        <h1>Eyther hospital cashless claims worklist</h1>
        <p>
          Phase 1 starts with a claim officer dashboard and doctor-owner summary, using synthetic data only until external credentials and PII gates pass.
        </p>
      </section>
      <StatusCard title="Deployment boundary" tone="caution">
        API and worker target Railway later. Web targets Vercel later. This scaffold performs no live Gmail send, no Railway deploy, and stores no real hospital records.
      </StatusCard>
    </main>
  );
}
