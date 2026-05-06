import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'Eyther Cashless Claims Worklist',
  description: 'Synthetic-only GOV-01 scaffold for hospital cashless claims operations.'
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en-IN">
      <body>{children}</body>
    </html>
  );
}
