import type { ReactNode } from "react";

export function ScaffoldCard({
  title,
  children,
}: {
  title: string;
  children: ReactNode;
}) {
  return (
    <section className="scaffold-card">
      <h2>{title}</h2>
      <div>{children}</div>
    </section>
  );
}
