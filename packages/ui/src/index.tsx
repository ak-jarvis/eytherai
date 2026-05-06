import type { ReactNode } from 'react';

export function StatusCard({ title, children, tone = 'neutral' }: { title: string; children: ReactNode; tone?: 'neutral' | 'caution' }) {
  return (
    <article style={{ border: '1px solid #d9e2f2', borderLeft: tone === 'caution' ? '4px solid #d97706' : '4px solid #2854c5', borderRadius: 12, padding: 20, background: '#fff' }}>
      <h2 style={{ marginTop: 0 }}>{title}</h2>
      <div>{children}</div>
    </article>
  );
}
