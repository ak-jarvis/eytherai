export const eytherScaffold = {
  product: "unified-cashless-claims-dashboard",
  apiBasePath: "/api/v1",
  deployment: {
    backend: "railway",
    frontend: "vercel",
  },
} as const;

export const redactionBoundaries = [
  "patient identifiers",
  "raw email/MIME bodies",
  "prescription photos",
  "claim documents",
  "OAuth secrets",
  "app passwords",
  "tokens",
] as const;

export function nowIso() {
  return new Date().toISOString();
}

export function maskEmail(email: string) {
  const [local, domain] = email.split("@");
  if (!local || !domain) return "***";
  return `${local.slice(0, 2)}***@${domain}`;
}

export function maskPolicy(policyNumber: string) {
  return `***${policyNumber.slice(-4)}`;
}

export function redact(value: string) {
  return value
    .replace(/Test Patient [A-Za-z]+/g, "[redacted patient]")
    .replace(/POLICY-TEST-[A-Z0-9-]+/g, "[redacted policy]");
}
