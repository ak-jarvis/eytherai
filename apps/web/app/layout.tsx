import type { ReactNode } from "react";
import "./globals.css";

export const metadata = {
  title: "Eyther Phase 1",
  description: "Hospital-side unified cashless claims dashboard",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en-IN">
      <body>{children}</body>
    </html>
  );
}
