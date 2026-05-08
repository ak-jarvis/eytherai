import { PrismaClient } from "@prisma/client";
import { phase1SyntheticDbIds as ids } from "./index.js";

const prisma = new PrismaClient();

async function main() {
  const onboarding = await prisma.onboardingState.findUnique({
    where: {
      tenantId_hospitalId: {
        tenantId: ids.tenantId,
        hospitalId: ids.hospitalId,
      },
    },
  });
  if (!onboarding?.readyForClaimDesk)
    throw new Error("Persisted onboarding readiness was not found.");
  if (
    !onboarding.blockedReasonCodes.includes(
      "missing_test_email_acknowledgement",
    )
  )
    throw new Error("Active Send blocked reason was not persisted.");

  const claim = await prisma.claim.findUnique({
    where: { eytherClaimNumber: "CLM-TEST-0001" },
    include: { packets: true, lifecycleEvents: true, documents: true },
  });
  if (!claim) throw new Error("Persisted synthetic claim was not found.");
  if (
    !claim.packets.some(
      (packet) => packet.publicPacketId === "PACKET-TEST-0001",
    )
  )
    throw new Error("Persisted packet evidence was not found.");
  if (!claim.lifecycleEvents.length)
    throw new Error("Persisted lifecycle evidence was not found.");

  const counterparty = await prisma.hospitalCounterpartyProfile.findUnique({
    where: { publicHospitalCounterpartyId: "HCP-TEST-0001" },
  });
  if (!counterparty || counterparty.activeForSubmission)
    throw new Error("Hospital counterparty must exist and stay inactive.");

  const emailEvent = await prisma.emailEvent.findUnique({
    where: { publicEmailEventId: "EMAIL-TEST-0001" },
  });
  if (!emailEvent || emailEvent.rawAccess !== "restricted")
    throw new Error("Restricted synthetic email event evidence was not found.");

  const exportJob = await prisma.exportJob.findFirst({
    where: {
      tenantId: ids.tenantId,
      hospitalId: ids.hospitalId,
      exportType: "finance_settlement_csv",
    },
  });
  if (!exportJob || exportJob.includeSensitive)
    throw new Error("Redacted finance export job evidence was not found.");

  const auditActions = new Set(
    (
      await prisma.auditLog.findMany({
        where: {
          tenantId: ids.tenantId,
          hospitalId: ids.hospitalId,
          action: {
            in: [
              "claim_create",
              "packet_create",
              "document_attach",
              "lifecycle_event_create",
              "manual_match",
              "export_create",
            ],
          },
        },
        select: { action: true },
      })
    ).map((entry) => entry.action),
  );

  for (const action of [
    "claim_create",
    "packet_create",
    "document_attach",
    "lifecycle_event_create",
    "manual_match",
    "export_create",
  ]) {
    if (!auditActions.has(action as never))
      throw new Error(`Missing operational audit action: ${action}`);
  }

  console.log(
    "Synthetic Phase 1 operational DB evidence OK: onboarding, counterparty, claim, packet, lifecycle, email, export, and audit persisted.",
  );
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
