import { PrismaClient } from "@prisma/client";

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

export const phase1SyntheticDbIds = {
  tenantId: "00000000-0000-4000-8000-000000000001",
  hospitalId: "00000000-0000-4000-8000-000000000002",
  userId: "00000000-0000-4000-8000-000000000003",
  inviteId: "00000000-0000-4000-8000-000000000004",
  branchScopeId: "00000000-0000-4000-8000-000000000005",
  onboardingStateId: "00000000-0000-4000-8000-000000000020",
  counterpartyId: "00000000-0000-4000-8000-000000000021",
  hospitalCounterpartyId: "00000000-0000-4000-8000-000000000022",
  claimId: "00000000-0000-4000-8000-000000000023",
  claimId2: "00000000-0000-4000-8000-000000000024",
  claimId3: "00000000-0000-4000-8000-000000000025",
  packetId: "00000000-0000-4000-8000-000000000026",
  emailEventId: "00000000-0000-4000-8000-000000000027",
  lifecycleEventId: "00000000-0000-4000-8000-000000000028",
} as const;

export type EytherPrismaClient = PrismaClient;

export function createPrismaClient() {
  return new PrismaClient();
}
