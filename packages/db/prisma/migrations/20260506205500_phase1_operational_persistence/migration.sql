-- Phase 1 operational persistence tables.
-- These tables are synthetic-safe in this milestone: no raw patient documents,
-- raw email bodies, raw MIME, credentials, OAuth tokens, or identifiable
-- fixtures are stored by the verifier.

ALTER TYPE "AuditAction" ADD VALUE IF NOT EXISTS 'onboarding_update';
ALTER TYPE "AuditAction" ADD VALUE IF NOT EXISTS 'hospital_profile_update';
ALTER TYPE "AuditAction" ADD VALUE IF NOT EXISTS 'setup_evidence_upload';
ALTER TYPE "AuditAction" ADD VALUE IF NOT EXISTS 'payer_mix_import';
ALTER TYPE "AuditAction" ADD VALUE IF NOT EXISTS 'counterparty_profile_update';
ALTER TYPE "AuditAction" ADD VALUE IF NOT EXISTS 'rule_set_create';
ALTER TYPE "AuditAction" ADD VALUE IF NOT EXISTS 'test_email_update';
ALTER TYPE "AuditAction" ADD VALUE IF NOT EXISTS 'claim_create';
ALTER TYPE "AuditAction" ADD VALUE IF NOT EXISTS 'claim_update';
ALTER TYPE "AuditAction" ADD VALUE IF NOT EXISTS 'packet_create';
ALTER TYPE "AuditAction" ADD VALUE IF NOT EXISTS 'document_attach';
ALTER TYPE "AuditAction" ADD VALUE IF NOT EXISTS 'document_replace';
ALTER TYPE "AuditAction" ADD VALUE IF NOT EXISTS 'lifecycle_event_create';
ALTER TYPE "AuditAction" ADD VALUE IF NOT EXISTS 'manual_match';
ALTER TYPE "AuditAction" ADD VALUE IF NOT EXISTS 'email_event_ignore';
ALTER TYPE "AuditAction" ADD VALUE IF NOT EXISTS 'email_event_quarantine_release';
ALTER TYPE "AuditAction" ADD VALUE IF NOT EXISTS 'export_create';
ALTER TYPE "AuditAction" ADD VALUE IF NOT EXISTS 'export_download';
ALTER TYPE "AuditAction" ADD VALUE IF NOT EXISTS 'sensitive_reveal_requested';

CREATE TABLE "OnboardingState" (
    "onboardingStateId" UUID NOT NULL,
    "tenantId" UUID NOT NULL,
    "hospitalId" UUID NOT NULL,
    "overallStatus" TEXT NOT NULL DEFAULT 'not_started',
    "currentStepKey" TEXT,
    "profileCardStatus" TEXT NOT NULL DEFAULT 'not_started',
    "mailboxCardStatus" TEXT NOT NULL DEFAULT 'not_started',
    "counterpartyCardStatus" TEXT NOT NULL DEFAULT 'not_started',
    "testEmailCardStatus" TEXT NOT NULL DEFAULT 'not_started',
    "readinessCardStatus" TEXT NOT NULL DEFAULT 'not_started',
    "skipReasonSanitized" TEXT,
    "blockedReasonCodes" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
    "readyForClaimDesk" BOOLEAN NOT NULL DEFAULT false,
    "readyForClaimDeskAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "OnboardingState_pkey" PRIMARY KEY ("onboardingStateId")
);

CREATE TABLE "SetupEvidenceArtifact" (
    "setupEvidenceArtifactId" UUID NOT NULL,
    "publicArtifactId" TEXT NOT NULL,
    "tenantId" UUID NOT NULL,
    "hospitalId" UUID NOT NULL,
    "hospitalCounterpartyId" UUID,
    "artifactType" TEXT NOT NULL,
    "sourceLabelSanitized" TEXT NOT NULL,
    "artifactTextSummarySanitized" TEXT,
    "piiScanStatus" TEXT NOT NULL DEFAULT 'pending',
    "excelHeaderValidationStatus" TEXT,
    "validationStatus" TEXT NOT NULL DEFAULT 'collected',
    "rejectionReasonSanitized" TEXT,
    "rejectedReasonCodes" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
    "createdByUserId" UUID,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "SetupEvidenceArtifact_pkey" PRIMARY KEY ("setupEvidenceArtifactId")
);

CREATE TABLE "AnonymizedPayerMixRow" (
    "payerMixRowId" UUID NOT NULL,
    "tenantId" UUID NOT NULL,
    "hospitalId" UUID NOT NULL,
    "sourceArtifactPublicId" TEXT NOT NULL,
    "counterpartyDisplayName" TEXT NOT NULL,
    "counterpartyType" TEXT NOT NULL,
    "monthBucket" TIMESTAMP(3),
    "claimCount" INTEGER NOT NULL,
    "claimValueProcessed" DECIMAL(14,2),
    "cashlessSharePercent" DECIMAL(5,2),
    "rankInHospital" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "AnonymizedPayerMixRow_pkey" PRIMARY KEY ("payerMixRowId")
);

CREATE TABLE "CounterpartyMaster" (
    "counterpartyId" UUID NOT NULL,
    "publicCounterpartyId" TEXT NOT NULL,
    "counterpartyType" TEXT NOT NULL,
    "displayName" TEXT NOT NULL,
    "normalizedDisplayName" TEXT NOT NULL,
    "publicBaselineStatus" TEXT NOT NULL DEFAULT 'unverified',
    "activeStatus" TEXT NOT NULL DEFAULT 'active',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "CounterpartyMaster_pkey" PRIMARY KEY ("counterpartyId")
);

CREATE TABLE "HospitalCounterpartyProfile" (
    "hospitalCounterpartyId" UUID NOT NULL,
    "publicHospitalCounterpartyId" TEXT NOT NULL,
    "tenantId" UUID NOT NULL,
    "hospitalId" UUID NOT NULL,
    "counterpartyId" UUID,
    "counterpartyDisplayName" TEXT NOT NULL,
    "counterpartyType" TEXT NOT NULL,
    "submissionMode" TEXT NOT NULL DEFAULT 'unknown',
    "acceptedPreauthToEmailMasked" TEXT,
    "whitelistedSenderEmailMasked" TEXT,
    "readinessStatus" TEXT NOT NULL DEFAULT 'draft_configured',
    "hospitalArtifactStatus" TEXT NOT NULL DEFAULT 'not_collected',
    "testEmailStatus" TEXT NOT NULL DEFAULT 'not_sent',
    "liveValidationStatus" TEXT NOT NULL DEFAULT 'not_started',
    "activeForSubmission" BOOLEAN NOT NULL DEFAULT false,
    "blockedReasonCodes" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
    "supportNoteSanitized" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "HospitalCounterpartyProfile_pkey" PRIMARY KEY ("hospitalCounterpartyId")
);

CREATE TABLE "RuleSet" (
    "ruleSetId" UUID NOT NULL,
    "publicRuleSetId" TEXT NOT NULL,
    "tenantId" UUID,
    "hospitalId" UUID,
    "hospitalCounterpartyId" UUID,
    "ruleSetType" TEXT NOT NULL,
    "version" INTEGER NOT NULL DEFAULT 1,
    "rulesPayload" JSONB NOT NULL DEFAULT '{}',
    "ruleSource" TEXT NOT NULL DEFAULT 'synthetic_draft',
    "fieldSourceConfidence" TEXT NOT NULL DEFAULT 'unknown',
    "sourceNoteSanitized" TEXT,
    "createdByUserId" UUID,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "RuleSet_pkey" PRIMARY KEY ("ruleSetId")
);

CREATE TABLE "Claim" (
    "claimId" UUID NOT NULL,
    "eytherClaimNumber" TEXT NOT NULL,
    "tenantId" UUID NOT NULL,
    "hospitalId" UUID NOT NULL,
    "branchId" TEXT,
    "hospitalCounterpartyPublicId" TEXT,
    "patientDisplayName" TEXT NOT NULL,
    "patientRefMasked" TEXT NOT NULL,
    "policyRefMasked" TEXT NOT NULL,
    "counterpartyDisplayName" TEXT NOT NULL,
    "owner" TEXT NOT NULL,
    "assignedOfficer" TEXT,
    "currentStage" TEXT NOT NULL DEFAULT 'draft_preauth',
    "currentStatus" TEXT NOT NULL DEFAULT 'draft',
    "preauthRequestedAmount" DECIMAL(14,2),
    "claimValueInr" DECIMAL(14,2),
    "settledAmount" DECIMAL(14,2),
    "deductionShortPaymentAmount" DECIMAL(14,2),
    "repudiationReasonSanitized" TEXT,
    "nextFollowUpDueAt" TIMESTAMP(3),
    "ageingStartAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "activeStatus" TEXT NOT NULL DEFAULT 'active',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "Claim_pkey" PRIMARY KEY ("claimId")
);

CREATE TABLE "ClaimApplicationPacket" (
    "packetId" UUID NOT NULL,
    "publicPacketId" TEXT NOT NULL,
    "tenantId" UUID NOT NULL,
    "hospitalId" UUID NOT NULL,
    "claimId" UUID NOT NULL,
    "packetType" TEXT NOT NULL,
    "packetStatus" TEXT NOT NULL DEFAULT 'draft',
    "requestedAmount" DECIMAL(14,2),
    "triggerReason" TEXT,
    "sendBlockedReasonCodes" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
    "createdByUserId" UUID,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "ClaimApplicationPacket_pkey" PRIMARY KEY ("packetId")
);

CREATE TABLE "DocumentAttachment" (
    "documentAttachmentId" UUID NOT NULL,
    "publicDocumentId" TEXT NOT NULL,
    "tenantId" UUID NOT NULL,
    "hospitalId" UUID NOT NULL,
    "claimId" UUID NOT NULL,
    "packetId" UUID,
    "documentType" TEXT NOT NULL,
    "fileNameSanitized" TEXT NOT NULL,
    "sourceLabelSanitized" TEXT NOT NULL,
    "version" INTEGER NOT NULL DEFAULT 1,
    "redactionStatus" TEXT NOT NULL DEFAULT 'redacted',
    "reasonNoteSanitized" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "DocumentAttachment_pkey" PRIMARY KEY ("documentAttachmentId")
);

CREATE TABLE "EmailEvent" (
    "emailEventId" UUID NOT NULL,
    "publicEmailEventId" TEXT NOT NULL,
    "tenantId" UUID NOT NULL,
    "hospitalId" UUID NOT NULL,
    "claimId" UUID,
    "packetIdPublic" TEXT,
    "subjectSanitized" TEXT NOT NULL,
    "bodyPreviewRedacted" TEXT,
    "matchStatus" TEXT NOT NULL DEFAULT 'unmatched',
    "rawAccess" TEXT NOT NULL DEFAULT 'restricted',
    "quarantineStatus" TEXT,
    "reasonNoteSanitized" TEXT,
    "receivedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "EmailEvent_pkey" PRIMARY KEY ("emailEventId")
);

CREATE TABLE "LifecycleStatusEvent" (
    "lifecycleStatusEventId" UUID NOT NULL,
    "publicLifecycleEventId" TEXT NOT NULL,
    "tenantId" UUID NOT NULL,
    "hospitalId" UUID NOT NULL,
    "claimId" UUID NOT NULL,
    "packetId" UUID,
    "fromStage" TEXT,
    "toStage" TEXT NOT NULL,
    "fromStatus" TEXT,
    "toStatus" TEXT NOT NULL,
    "triggerSource" TEXT NOT NULL DEFAULT 'manual',
    "reasonNoteSanitized" TEXT,
    "changedByUserId" UUID,
    "changedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "LifecycleStatusEvent_pkey" PRIMARY KEY ("lifecycleStatusEventId")
);

CREATE TABLE "ExportJob" (
    "exportJobId" UUID NOT NULL,
    "publicExportId" TEXT NOT NULL,
    "tenantId" UUID NOT NULL,
    "hospitalId" UUID NOT NULL,
    "branchId" TEXT,
    "exportType" TEXT NOT NULL,
    "filterPayloadRedacted" JSONB NOT NULL DEFAULT '{}',
    "includeSensitive" BOOLEAN NOT NULL DEFAULT false,
    "status" TEXT NOT NULL DEFAULT 'queued',
    "filename" TEXT NOT NULL,
    "reasonNoteSanitized" TEXT,
    "requestedByUserId" UUID,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "ExportJob_pkey" PRIMARY KEY ("exportJobId")
);

CREATE UNIQUE INDEX "OnboardingState_tenantId_hospitalId_key" ON "OnboardingState"("tenantId", "hospitalId");
CREATE INDEX "OnboardingState_hospitalId_updatedAt_idx" ON "OnboardingState"("hospitalId", "updatedAt");
CREATE UNIQUE INDEX "SetupEvidenceArtifact_publicArtifactId_key" ON "SetupEvidenceArtifact"("publicArtifactId");
CREATE INDEX "SetupEvidenceArtifact_tenantId_hospitalId_createdAt_idx" ON "SetupEvidenceArtifact"("tenantId", "hospitalId", "createdAt");
CREATE INDEX "SetupEvidenceArtifact_piiScanStatus_idx" ON "SetupEvidenceArtifact"("piiScanStatus");
CREATE INDEX "AnonymizedPayerMixRow_tenantId_hospitalId_counterpartyDisplayName_idx" ON "AnonymizedPayerMixRow"("tenantId", "hospitalId", "counterpartyDisplayName");
CREATE UNIQUE INDEX "CounterpartyMaster_publicCounterpartyId_key" ON "CounterpartyMaster"("publicCounterpartyId");
CREATE UNIQUE INDEX "HospitalCounterpartyProfile_publicHospitalCounterpartyId_key" ON "HospitalCounterpartyProfile"("publicHospitalCounterpartyId");
CREATE INDEX "HospitalCounterpartyProfile_tenantId_hospitalId_activeForSubmission_idx" ON "HospitalCounterpartyProfile"("tenantId", "hospitalId", "activeForSubmission");
CREATE INDEX "HospitalCounterpartyProfile_readinessStatus_idx" ON "HospitalCounterpartyProfile"("readinessStatus");
CREATE UNIQUE INDEX "RuleSet_publicRuleSetId_key" ON "RuleSet"("publicRuleSetId");
CREATE INDEX "RuleSet_tenantId_hospitalId_ruleSetType_idx" ON "RuleSet"("tenantId", "hospitalId", "ruleSetType");
CREATE UNIQUE INDEX "Claim_eytherClaimNumber_key" ON "Claim"("eytherClaimNumber");
CREATE INDEX "Claim_tenantId_hospitalId_currentStage_idx" ON "Claim"("tenantId", "hospitalId", "currentStage");
CREATE INDEX "Claim_tenantId_hospitalId_ageingStartAt_idx" ON "Claim"("tenantId", "hospitalId", "ageingStartAt");
CREATE UNIQUE INDEX "ClaimApplicationPacket_publicPacketId_key" ON "ClaimApplicationPacket"("publicPacketId");
CREATE INDEX "ClaimApplicationPacket_tenantId_hospitalId_claimId_idx" ON "ClaimApplicationPacket"("tenantId", "hospitalId", "claimId");
CREATE UNIQUE INDEX "DocumentAttachment_publicDocumentId_key" ON "DocumentAttachment"("publicDocumentId");
CREATE INDEX "DocumentAttachment_tenantId_hospitalId_claimId_idx" ON "DocumentAttachment"("tenantId", "hospitalId", "claimId");
CREATE UNIQUE INDEX "EmailEvent_publicEmailEventId_key" ON "EmailEvent"("publicEmailEventId");
CREATE INDEX "EmailEvent_tenantId_hospitalId_matchStatus_idx" ON "EmailEvent"("tenantId", "hospitalId", "matchStatus");
CREATE UNIQUE INDEX "LifecycleStatusEvent_publicLifecycleEventId_key" ON "LifecycleStatusEvent"("publicLifecycleEventId");
CREATE INDEX "LifecycleStatusEvent_tenantId_hospitalId_claimId_changedAt_idx" ON "LifecycleStatusEvent"("tenantId", "hospitalId", "claimId", "changedAt");
CREATE UNIQUE INDEX "ExportJob_publicExportId_key" ON "ExportJob"("publicExportId");
CREATE INDEX "ExportJob_tenantId_hospitalId_createdAt_idx" ON "ExportJob"("tenantId", "hospitalId", "createdAt");

ALTER TABLE "OnboardingState" ADD CONSTRAINT "OnboardingState_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("tenantId") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "OnboardingState" ADD CONSTRAINT "OnboardingState_hospitalId_fkey" FOREIGN KEY ("hospitalId") REFERENCES "Hospital"("hospitalId") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "SetupEvidenceArtifact" ADD CONSTRAINT "SetupEvidenceArtifact_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("tenantId") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "SetupEvidenceArtifact" ADD CONSTRAINT "SetupEvidenceArtifact_hospitalId_fkey" FOREIGN KEY ("hospitalId") REFERENCES "Hospital"("hospitalId") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "AnonymizedPayerMixRow" ADD CONSTRAINT "AnonymizedPayerMixRow_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("tenantId") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "AnonymizedPayerMixRow" ADD CONSTRAINT "AnonymizedPayerMixRow_hospitalId_fkey" FOREIGN KEY ("hospitalId") REFERENCES "Hospital"("hospitalId") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "HospitalCounterpartyProfile" ADD CONSTRAINT "HospitalCounterpartyProfile_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("tenantId") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "HospitalCounterpartyProfile" ADD CONSTRAINT "HospitalCounterpartyProfile_hospitalId_fkey" FOREIGN KEY ("hospitalId") REFERENCES "Hospital"("hospitalId") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "HospitalCounterpartyProfile" ADD CONSTRAINT "HospitalCounterpartyProfile_counterpartyId_fkey" FOREIGN KEY ("counterpartyId") REFERENCES "CounterpartyMaster"("counterpartyId") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "RuleSet" ADD CONSTRAINT "RuleSet_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("tenantId") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "RuleSet" ADD CONSTRAINT "RuleSet_hospitalId_fkey" FOREIGN KEY ("hospitalId") REFERENCES "Hospital"("hospitalId") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "RuleSet" ADD CONSTRAINT "RuleSet_hospitalCounterpartyId_fkey" FOREIGN KEY ("hospitalCounterpartyId") REFERENCES "HospitalCounterpartyProfile"("hospitalCounterpartyId") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "Claim" ADD CONSTRAINT "Claim_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("tenantId") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "Claim" ADD CONSTRAINT "Claim_hospitalId_fkey" FOREIGN KEY ("hospitalId") REFERENCES "Hospital"("hospitalId") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "ClaimApplicationPacket" ADD CONSTRAINT "ClaimApplicationPacket_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("tenantId") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "ClaimApplicationPacket" ADD CONSTRAINT "ClaimApplicationPacket_hospitalId_fkey" FOREIGN KEY ("hospitalId") REFERENCES "Hospital"("hospitalId") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "ClaimApplicationPacket" ADD CONSTRAINT "ClaimApplicationPacket_claimId_fkey" FOREIGN KEY ("claimId") REFERENCES "Claim"("claimId") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "DocumentAttachment" ADD CONSTRAINT "DocumentAttachment_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("tenantId") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "DocumentAttachment" ADD CONSTRAINT "DocumentAttachment_hospitalId_fkey" FOREIGN KEY ("hospitalId") REFERENCES "Hospital"("hospitalId") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "DocumentAttachment" ADD CONSTRAINT "DocumentAttachment_claimId_fkey" FOREIGN KEY ("claimId") REFERENCES "Claim"("claimId") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "DocumentAttachment" ADD CONSTRAINT "DocumentAttachment_packetId_fkey" FOREIGN KEY ("packetId") REFERENCES "ClaimApplicationPacket"("packetId") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "EmailEvent" ADD CONSTRAINT "EmailEvent_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("tenantId") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "EmailEvent" ADD CONSTRAINT "EmailEvent_hospitalId_fkey" FOREIGN KEY ("hospitalId") REFERENCES "Hospital"("hospitalId") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "EmailEvent" ADD CONSTRAINT "EmailEvent_claimId_fkey" FOREIGN KEY ("claimId") REFERENCES "Claim"("claimId") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "LifecycleStatusEvent" ADD CONSTRAINT "LifecycleStatusEvent_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("tenantId") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "LifecycleStatusEvent" ADD CONSTRAINT "LifecycleStatusEvent_hospitalId_fkey" FOREIGN KEY ("hospitalId") REFERENCES "Hospital"("hospitalId") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "LifecycleStatusEvent" ADD CONSTRAINT "LifecycleStatusEvent_claimId_fkey" FOREIGN KEY ("claimId") REFERENCES "Claim"("claimId") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "LifecycleStatusEvent" ADD CONSTRAINT "LifecycleStatusEvent_packetId_fkey" FOREIGN KEY ("packetId") REFERENCES "ClaimApplicationPacket"("packetId") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "ExportJob" ADD CONSTRAINT "ExportJob_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("tenantId") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "ExportJob" ADD CONSTRAINT "ExportJob_hospitalId_fkey" FOREIGN KEY ("hospitalId") REFERENCES "Hospital"("hospitalId") ON DELETE RESTRICT ON UPDATE CASCADE;
