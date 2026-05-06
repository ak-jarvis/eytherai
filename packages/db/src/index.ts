export const databaseContract = {
  provider: "railway-postgres",
  orm: "prisma",
  realPatientDataAllowed: false,
} as const;

export const syntheticDbSeed = {
  tenant_id: "tenant_demo_001",
  hospital_id: "hospital_demo_001",
  mailbox_connection_id: "mailbox_demo_001",
  note: "Synthetic local Phase 1 seed only; no real patient PII, mailbox credentials, or hospital claim documents.",
} as const;
