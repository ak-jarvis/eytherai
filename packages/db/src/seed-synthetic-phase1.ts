import { PrismaClient } from "@prisma/client";
import { phase1SyntheticDbIds as ids } from "./index.js";

const prisma = new PrismaClient();

const activeSendBlockedReasons = [
  "missing_empanelment_id",
  "missing_accepted_route",
  "missing_test_email_acknowledgement",
];

const claims = [
  {
    claimId: ids.claimId,
    eytherClaimNumber: "CLM-TEST-0001",
    patientDisplayName: "Test Patient Alpha",
    patientRefMasked: "UHID-TEST-0001",
    policyRefMasked: "POLICY-TEST-1234",
    currentStage: "draft_preauth",
    currentStatus: "Awaiting evidence",
    claimValueInr: 125000,
    preauthRequestedAmount: 125000,
  },
  {
    claimId: ids.claimId2,
    eytherClaimNumber: "CLM-TEST-0002",
    patientDisplayName: "Test Patient Beta",
    patientRefMasked: "UHID-TEST-0002",
    policyRefMasked: "POLICY-TEST-5678",
    currentStage: "query",
    currentStatus: "Doctor note pending",
    claimValueInr: 84000,
    preauthRequestedAmount: 84000,
  },
  {
    claimId: ids.claimId3,
    eytherClaimNumber: "CLM-TEST-0003",
    patientDisplayName: "Test Patient Gamma",
    patientRefMasked: "UHID-TEST-0003",
    policyRefMasked: "POLICY-TEST-9012",
    currentStage: "final_settlement",
    currentStatus: "Short payment review",
    claimValueInr: 218000,
    preauthRequestedAmount: 218000,
    deductionShortPaymentAmount: 18000,
  },
];

async function main() {
  await prisma.$transaction(async (tx) => {
    await tx.auditLog.deleteMany({
      where: {
        tenantId: ids.tenantId,
        hospitalId: ids.hospitalId,
        action: {
          in: [
            "onboarding_update",
            "hospital_profile_update",
            "setup_evidence_upload",
            "payer_mix_import",
            "counterparty_profile_update",
            "rule_set_create",
            "test_email_update",
            "claim_create",
            "claim_update",
            "packet_create",
            "document_attach",
            "document_replace",
            "lifecycle_event_create",
            "manual_match",
            "email_event_ignore",
            "email_event_quarantine_release",
            "export_create",
            "export_download",
            "sensitive_reveal_requested",
          ],
        },
      },
    });
    await tx.exportJob.deleteMany({ where: { tenantId: ids.tenantId } });
    await tx.lifecycleStatusEvent.deleteMany({
      where: { tenantId: ids.tenantId },
    });
    await tx.emailEvent.deleteMany({ where: { tenantId: ids.tenantId } });
    await tx.documentAttachment.deleteMany({
      where: { tenantId: ids.tenantId },
    });
    await tx.claimApplicationPacket.deleteMany({
      where: { tenantId: ids.tenantId },
    });
    await tx.claim.deleteMany({ where: { tenantId: ids.tenantId } });
    await tx.ruleSet.deleteMany({ where: { tenantId: ids.tenantId } });
    await tx.hospitalCounterpartyProfile.deleteMany({
      where: { tenantId: ids.tenantId },
    });
    await tx.anonymizedPayerMixRow.deleteMany({
      where: { tenantId: ids.tenantId },
    });
    await tx.setupEvidenceArtifact.deleteMany({
      where: { tenantId: ids.tenantId },
    });
    await tx.onboardingState.deleteMany({
      where: { tenantId: ids.tenantId },
    });
    await tx.counterpartyMaster.deleteMany({
      where: { publicCounterpartyId: "COUNTERPARTY-TEST-0001" },
    });

    await tx.onboardingState.create({
      data: {
        onboardingStateId: ids.onboardingStateId,
        tenantId: ids.tenantId,
        hospitalId: ids.hospitalId,
        overallStatus: "ready_for_claim_desk",
        currentStepKey: "claim_desk_ready",
        profileCardStatus: "ready",
        mailboxCardStatus: "test_mode",
        counterpartyCardStatus: "evidence_gated",
        testEmailCardStatus: "sent",
        readinessCardStatus: "blocked_for_live_send",
        blockedReasonCodes: activeSendBlockedReasons,
        readyForClaimDesk: true,
        readyForClaimDeskAt: new Date(),
      },
    });

    await tx.counterpartyMaster.create({
      data: {
        counterpartyId: ids.counterpartyId,
        publicCounterpartyId: "COUNTERPARTY-TEST-0001",
        counterpartyType: "tpa",
        displayName: "Example TPA Sandbox",
        normalizedDisplayName: "example tpa sandbox",
        publicBaselineStatus: "draft_only",
      },
    });

    await tx.hospitalCounterpartyProfile.create({
      data: {
        hospitalCounterpartyId: ids.hospitalCounterpartyId,
        publicHospitalCounterpartyId: "HCP-TEST-0001",
        tenantId: ids.tenantId,
        hospitalId: ids.hospitalId,
        counterpartyId: ids.counterpartyId,
        counterpartyDisplayName: "Example TPA Sandbox",
        counterpartyType: "tpa",
        submissionMode: "email_test_mode",
        readinessStatus: "draft_configured",
        hospitalArtifactStatus: "not_collected",
        testEmailStatus: "sent",
        liveValidationStatus: "not_started",
        activeForSubmission: false,
        blockedReasonCodes: activeSendBlockedReasons,
      },
    });

    for (const claim of claims) {
      await tx.claim.create({
        data: {
          ...claim,
          tenantId: ids.tenantId,
          hospitalId: ids.hospitalId,
          branchId: "BRANCH-TEST-0001",
          hospitalCounterpartyPublicId: "HCP-TEST-0001",
          counterpartyDisplayName: "Example TPA Sandbox",
          owner: "Insurance Desk Test Owner",
          assignedOfficer: "Insurance Desk Test Owner",
        },
      });
    }

    await tx.claimApplicationPacket.create({
      data: {
        packetId: ids.packetId,
        publicPacketId: "PACKET-TEST-0001",
        tenantId: ids.tenantId,
        hospitalId: ids.hospitalId,
        claimId: ids.claimId,
        packetType: "preauth",
        packetStatus: "draft",
        requestedAmount: 125000,
        sendBlockedReasonCodes: activeSendBlockedReasons,
        createdByUserId: ids.userId,
      },
    });

    await tx.lifecycleStatusEvent.create({
      data: {
        lifecycleStatusEventId: ids.lifecycleEventId,
        publicLifecycleEventId: "LIFE-TEST-0001",
        tenantId: ids.tenantId,
        hospitalId: ids.hospitalId,
        claimId: ids.claimId,
        packetId: ids.packetId,
        toStage: "draft_preauth",
        toStatus: "awaiting_evidence",
        triggerSource: "system_seed",
        reasonNoteSanitized: "Synthetic pre-auth draft created.",
        changedByUserId: ids.userId,
      },
    });

    await tx.emailEvent.create({
      data: {
        emailEventId: ids.emailEventId,
        publicEmailEventId: "EMAIL-TEST-0001",
        tenantId: ids.tenantId,
        hospitalId: ids.hospitalId,
        subjectSanitized: "Test email acknowledgement for CLM-TEST-0001",
        bodyPreviewRedacted: "Synthetic acknowledgement only. No patient data.",
        matchStatus: "needs_review",
        rawAccess: "restricted",
      },
    });
  });

  console.log(
    "Synthetic Phase 1 operational seed complete: onboarding, counterparty, claims, packet, lifecycle, and email event only; no real patient data.",
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
