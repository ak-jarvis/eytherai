import {
  ACTIVE_SEND_BLOCKED,
  sendEligibilitySchema,
  syntheticIds,
} from "@eyther/contracts";
import {
  createPrismaClient,
  phase1SyntheticDbIds,
  type EytherPrismaClient,
} from "@eyther/db";
import { randomUUID } from "node:crypto";

type AnyRecord = Record<string, any>;

const piiHeaderPattern =
  /\b(patient|uhid|mrn|member|admission|aadhaar|aadhar|mobile|phone|address)\b/i;

function nowIso() {
  return new Date().toISOString();
}

function activeSendGuard() {
  return sendEligibilitySchema.parse({
    allowed: false,
    blocked_reason_codes: [
      "missing_empanelment_id",
      "missing_accepted_route",
      "missing_test_email_acknowledgement",
    ],
    required_evidence: [
      "hospital_artifact_status=verified",
      "test_email_status=acknowledged",
      "live_validation_status=acknowledged",
      "mailbox.send_enabled=true",
      "whitelisted_sender_email matched",
    ],
    safe_next_action: "send_test_email",
  });
}

function hasPatientHeader(headers: unknown) {
  return (
    Array.isArray(headers) &&
    headers.some((header) => piiHeaderPattern.test(String(header)))
  );
}

function nextId(prefix: string, value: number) {
  return `${prefix}-TEST-${String(value).padStart(4, "0")}`;
}

function asNumber(value: unknown) {
  if (value === null || value === undefined) return null;
  if (typeof value === "number") return value;
  if (typeof value === "object" && "toNumber" in value) {
    return (value as { toNumber(): number }).toNumber();
  }
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function auditPayload(source: string, details: AnyRecord = {}) {
  return { source, ...details };
}

export function createPhase1OperationalStore() {
  let artifactCounter = 1;
  let claimCounter = 100;
  let packetCounter = 100;
  let documentCounter = 100;
  let lifecycleCounter = 1;
  let exportCounter = 1;
  const auditActions: string[] = [];
  const artifacts = new Map<string, AnyRecord>();
  const packets = new Map<string, AnyRecord>();
  const documents = new Map<string, AnyRecord>();
  const emailEvents = new Map<string, AnyRecord>();

  let onboardingState = {
    overall_status: "ready_for_claim_desk",
    ready_for_claim_desk: true,
    current_step_key: "claim_desk_ready",
    blocked_reason_codes: activeSendGuard().blocked_reason_codes,
    cards: [
      { key: "profile", status: "ready" },
      { key: "mailbox", status: "test_mode" },
      { key: "counterparty", status: "evidence_gated" },
      { key: "test_email", status: "sent" },
    ],
    updated_at: nowIso(),
  };

  let hospitalProfile = {
    tenant_id: syntheticIds.tenantId,
    hospital_id: syntheticIds.hospitalId,
    display_name: "Lotus Valley Test Hospital",
    legal_name: "Lotus Valley Test Hospital Private Limited",
    city: "Indore",
    state: "Madhya Pradesh",
    insurance_desk_email_masked: "in***@example.test",
    redaction_level: "masked_default",
    updated_at: nowIso(),
  };

  const baseClaim = {
    claim_id: syntheticIds.claimId,
    packet_id: syntheticIds.packetId,
    patient_display_name: "Test Patient Alpha",
    patient_ref_masked: "UHID-TEST-0001",
    policy_ref_masked: "POLICY-TEST-1234",
    insurer_or_tpa: "Example TPA Sandbox",
    counterparty_display_name: "Example TPA Sandbox",
    owner: "Insurance Desk Test Owner",
    assigned_officer: "Insurance Desk Test Owner",
    current_stage: "draft_preauth",
    current_status: "Awaiting evidence",
    claim_value_inr: 125000,
    preauth_requested_amount: 125000,
    branch_id: "BRANCH-TEST-0001",
    redaction_level: "masked_default",
    active_send_guard: activeSendGuard(),
    timeline: [
      {
        lifecycle_event_id: nextId("LIFE", 1),
        to_stage: "draft_preauth",
        to_status: "awaiting_evidence",
        reason_note_sanitized: "Synthetic pre-auth draft created.",
        created_at: nowIso(),
      },
    ],
  };

  const claims = new Map<string, AnyRecord>([
    [baseClaim.claim_id, { ...baseClaim, timeline: [...baseClaim.timeline] }],
    [
      "CLM-TEST-0002",
      {
        ...baseClaim,
        claim_id: "CLM-TEST-0002",
        patient_display_name: "Test Patient Beta",
        current_stage: "query",
        current_status: "Doctor note pending",
        claim_value_inr: 84000,
      },
    ],
    [
      "CLM-TEST-0003",
      {
        ...baseClaim,
        claim_id: "CLM-TEST-0003",
        patient_display_name: "Test Patient Gamma",
        current_stage: "final_settlement",
        current_status: "Short payment review",
        claim_value_inr: 218000,
      },
    ],
  ]);

  emailEvents.set(syntheticIds.emailEventId, {
    email_event_id: syntheticIds.emailEventId,
    subject_sanitized: `Test email acknowledgement for ${syntheticIds.claimId}`,
    body_preview_redacted: "Synthetic acknowledgement only. No patient data.",
    match_status: "needs_review",
    raw_access: "restricted",
    received_at: nowIso(),
  });

  function record(action: string) {
    auditActions.push(action);
  }

  function findClaim(claimId: string) {
    return claims.get(claimId) ?? claims.get(syntheticIds.claimId);
  }

  return {
    listAuditActions() {
      return [...auditActions];
    },

    getOnboardingState() {
      return onboardingState;
    },

    updateOnboardingState(input: AnyRecord) {
      onboardingState = {
        ...onboardingState,
        ...input,
        updated_at: nowIso(),
      };
      record("onboarding_update");
      return onboardingState;
    },

    getHospitalProfile() {
      return hospitalProfile;
    },

    updateHospitalProfile(input: AnyRecord) {
      hospitalProfile = {
        ...hospitalProfile,
        ...input,
        redaction_level: "masked_default",
        updated_at: nowIso(),
      };
      record("hospital_profile_update");
      return hospitalProfile;
    },

    addEvidenceArtifact(input: AnyRecord) {
      const artifactId = nextId("ARTIFACT", artifactCounter++);
      const rejected = hasPatientHeader(input.headers);
      const artifact = {
        artifact_id: artifactId,
        artifact_type: input.artifact_type ?? "setup_evidence",
        source_label_sanitized:
          input.source_label_sanitized ?? "synthetic setup evidence",
        pii_scan_status: rejected ? "rejected" : "passed",
        rejected_reason_codes: rejected ? ["patient_identifier_header"] : [],
        redaction_level: "masked_default",
        created_at: nowIso(),
      };
      artifacts.set(artifactId, artifact);
      record("setup_evidence_upload");
      return artifact;
    },

    importPayerMix(input: AnyRecord) {
      let acceptedRows = 0;
      let rejectedRows = 0;
      const reasons = new Set<string>();
      if (!artifacts.has(String(input.source_artifact_id))) {
        reasons.add("source_artifact_not_found");
      }
      for (const row of input.rows ?? []) {
        if (hasPatientHeader(row.headers)) {
          rejectedRows += 1;
          reasons.add("patient_identifier_header");
        } else if (!artifacts.has(String(input.source_artifact_id))) {
          rejectedRows += 1;
        } else {
          acceptedRows += 1;
        }
      }
      const result = {
        source_artifact_id: input.source_artifact_id ?? null,
        accepted_rows: acceptedRows,
        rejected_rows: rejectedRows,
        rejection_reasons: [...reasons],
        imported_at: nowIso(),
      };
      record("payer_mix_import");
      return result;
    },

    createHospitalCounterparty(input: AnyRecord) {
      const id = input.hospital_counterparty_id ?? nextId("HCP", 1);
      return {
        hospital_counterparty_id: id,
        counterparty_type: input.counterparty_type ?? "tpa",
        display_name: input.display_name ?? "Example TPA Sandbox",
        active_for_submission: false,
        active_send_guard: activeSendGuard(),
        rule_set_version: null,
      };
    },

    updateHospitalCounterparty(id: string, input: AnyRecord) {
      return {
        hospital_counterparty_id: id,
        ...input,
        active_for_submission: false,
        active_send_guard: activeSendGuard(),
      };
    },

    createRuleSet(id: string, input: AnyRecord) {
      return {
        hospital_counterparty_id: id,
        rule_set_id: nextId("RULESET", 1),
        rule_set_status: "draft",
        source_confidence: input.source_confidence ?? "synthetic_draft",
        active_for_submission: false,
        active_send_guard: activeSendGuard(),
      };
    },

    markTestEmailFailed(id: string, input: AnyRecord = {}) {
      return {
        email_event_id: id,
        status: "failed",
        failed_reason_sanitized:
          input.failed_reason_sanitized ?? "synthetic no-patient-data failure",
        no_patient_data: true,
        updated_at: nowIso(),
      };
    },

    createClaim(input: AnyRecord) {
      const claimId = input.claim_id ?? nextId("CLM", claimCounter++);
      const created = {
        ...baseClaim,
        ...input,
        claim_id: claimId,
        patient_display_name: input.patient_display_name ?? "Masked Patient",
        owner: input.owner ?? "Insurance Desk Test Owner",
        current_stage: input.current_stage ?? "draft_preauth",
        current_status: input.current_status ?? "Draft saved",
        claim_value_inr:
          input.claim_value_inr ?? input.preauth_requested_amount ?? 0,
        active_send_guard: activeSendGuard(),
        timeline: [
          {
            lifecycle_event_id: nextId("LIFE", lifecycleCounter++),
            to_stage: input.current_stage ?? "draft_preauth",
            to_status: input.current_status ?? "draft_saved",
            reason_note_sanitized: "Synthetic claim draft created.",
            created_at: nowIso(),
          },
        ],
      };
      claims.set(claimId, created);
      record("claim_create");
      return created;
    },

    getClaim(claimId: string): AnyRecord | null {
      const claim = findClaim(claimId);
      if (!claim) return null;
      return { ...claim, active_send_guard: activeSendGuard() };
    },

    updateClaim(claimId: string, input: AnyRecord): AnyRecord | null {
      const existing = findClaim(claimId);
      if (!existing) return null;
      const updated = {
        ...existing,
        ...input,
        claim_id: existing.claim_id,
        active_send_guard: activeSendGuard(),
        updated_at: nowIso(),
      };
      claims.set(existing.claim_id, updated);
      record("claim_update");
      return updated;
    },

    createPacket(claimId: string, input: AnyRecord) {
      const packetId = input.packet_id ?? nextId("PACKET", packetCounter++);
      const packet = {
        packet_id: packetId,
        claim_id: claimId,
        packet_type: input.packet_type ?? "preauth",
        requested_amount: input.requested_amount ?? null,
        trigger_reason: input.trigger_reason ?? null,
        packet_status: "draft",
        active_send_guard: activeSendGuard(),
        created_at: nowIso(),
      };
      packets.set(packetId, packet);
      record("packet_create");
      return packet;
    },

    attachDocument(claimId: string, packetId: string, input: AnyRecord) {
      const documentId = input.document_id ?? nextId("DOC", documentCounter++);
      const document = {
        document_id: documentId,
        claim_id: claimId,
        packet_id: packetId,
        document_type: input.document_type ?? "supporting_document",
        file_name_sanitized:
          input.file_name_sanitized ?? "synthetic-document.pdf",
        source_label_sanitized:
          input.source_label_sanitized ?? "synthetic upload",
        version: 1,
        redaction_status: "redacted",
        created_at: nowIso(),
      };
      documents.set(documentId, document);
      record("document_attach");
      return document;
    },

    replaceDocument(documentId: string, input: AnyRecord) {
      const existing = documents.get(documentId);
      const replaced = {
        ...(existing ?? {
          document_id: documentId,
          claim_id: syntheticIds.claimId,
          packet_id: syntheticIds.packetId,
          document_type: "supporting_document",
          version: 1,
        }),
        file_name_sanitized:
          input.file_name_sanitized ?? "synthetic-document-v2.pdf",
        reason_note_sanitized:
          input.reason_note_sanitized ?? "synthetic replacement",
        version: (existing?.version ?? 1) + 1,
        redaction_status: "redacted",
        updated_at: nowIso(),
      };
      documents.set(documentId, replaced);
      record("document_replace");
      return replaced;
    },

    downloadManualRoute(claimId: string, packetId: string) {
      return {
        claim_id: claimId,
        packet_id: packetId,
        filename: `manual-route-${claimId}-${packetId}.pdf`,
        content_type: "application/pdf",
        active_send_code: ACTIVE_SEND_BLOCKED,
        portal_manual_tracking_required: true,
        acknowledgement_required: true,
        redaction_status: "redacted",
        generated_at: nowIso(),
      };
    },

    addLifecycleEvent(claimId: string, input: AnyRecord) {
      const claim = findClaim(claimId);
      if (!claim) return null;
      const event = {
        lifecycle_event_id: nextId("LIFE", lifecycleCounter++),
        claim_id: claim.claim_id,
        to_stage: input.to_stage ?? "query",
        to_status: input.to_status ?? "query_raised",
        reason_note_sanitized:
          input.reason_note_sanitized ?? "synthetic lifecycle movement",
        created_at: nowIso(),
      };
      const updated = {
        ...claim,
        current_stage: event.to_stage,
        current_status: event.to_status,
        timeline: [...(claim.timeline ?? []), event],
      };
      claims.set(claim.claim_id, updated);
      record("lifecycle_event_create");
      return event;
    },

    getWorklist() {
      return { items: [...claims.values()] };
    },

    getManualMatchQueue() {
      return { items: [...emailEvents.values()] };
    },

    getMatchCandidates(emailEventId: string) {
      return {
        email_event_id: emailEventId,
        items: [
          {
            claim_id: syntheticIds.claimId,
            confidence: 0.74,
            reason_codes: ["subject_claim_id_match", "counterparty_hint"],
          },
        ],
      };
    },

    manualMatchEmail(emailEventId: string, input: AnyRecord = {}) {
      const event = {
        ...(emailEvents.get(emailEventId) ?? { email_event_id: emailEventId }),
        claim_id: input.claim_id ?? syntheticIds.claimId,
        match_status: "manual_matched",
        audit_action: "match_email",
        updated_at: nowIso(),
      };
      emailEvents.set(emailEventId, event);
      record("manual_match");
      return event;
    },

    ignoreEmailEvent(emailEventId: string, input: AnyRecord = {}) {
      const event = {
        ...(emailEvents.get(emailEventId) ?? { email_event_id: emailEventId }),
        match_status: "ignored",
        reason_note_sanitized:
          input.reason_note_sanitized ?? "synthetic ignored event",
        updated_at: nowIso(),
      };
      emailEvents.set(emailEventId, event);
      record("email_event_ignore");
      return event;
    },

    quarantineRelease(emailEventId: string, input: AnyRecord = {}) {
      const event = {
        ...(emailEvents.get(emailEventId) ?? { email_event_id: emailEventId }),
        quarantine_status: "released",
        reason_note_sanitized:
          input.reason_note_sanitized ?? "synthetic quarantine release",
        updated_at: nowIso(),
      };
      emailEvents.set(emailEventId, event);
      record("email_event_quarantine_release");
      return event;
    },

    getOwnerSummary() {
      return {
        owner: "Insurance Desk Test Owner",
        open_claims: claims.size + 11,
        outstanding_value_inr: 1840000,
        ageing_buckets: [
          { bucket: "0-2 days", claim_count: 8, value_inr: 520000 },
          { bucket: "3-7 days", claim_count: 4, value_inr: 710000 },
          { bucket: "8+ days", claim_count: 2, value_inr: 610000 },
        ],
        redaction_level: "aggregate_masked",
      };
    },

    getFinanceSummary() {
      return {
        settlement_total_inr: 690000,
        outstanding_ageing_inr: 1840000,
        short_payment_review_inr: 218000,
        payment_advice_status: "synthetic_redacted",
      };
    },

    createExport(input: AnyRecord = {}) {
      const exportId = input.export_id ?? nextId("EXPORT", exportCounter++);
      const exportJob = {
        export_id: exportId,
        export_type: input.export_type ?? "finance_settlement_csv",
        include_sensitive: false,
        status: "ready",
        filename: "synthetic-finance-export.csv",
        expires_at: nowIso(),
        redaction_status: "redacted",
      };
      record("export_create");
      return exportJob;
    },

    downloadExport(exportId: string) {
      record("export_download");
      return {
        export_id: exportId,
        filename: "synthetic-finance-export.csv",
        content_type: "text/csv",
        redaction_status: "redacted",
      };
    },

    revealStub(entityType: string, entityId: string, input: AnyRecord = {}) {
      if (!input.reason_note_sanitized) {
        return {
          status: "validation_error",
          code: "REVEAL_REASON_REQUIRED",
        };
      }
      record(`${entityType}_reveal_requested`);
      return {
        status: "blocked",
        entity_type: entityType,
        entity_id: entityId,
        reveal_allowed: false,
        blocked_reason_codes: ["raw_artifact_not_available_in_synthetic_build"],
        redaction_status: "redacted",
      };
    },
  };
}

export class PrismaPhase1OperationalStore {
  constructor(private readonly prisma: EytherPrismaClient) {}

  private readonly ids = phase1SyntheticDbIds;

  async listAuditActions() {
    const rows = await (this.prisma as any).auditLog.findMany({
      where: {
        tenantId: this.ids.tenantId,
        hospitalId: this.ids.hospitalId,
      },
      orderBy: { createdAt: "asc" },
      select: { action: true },
    });
    return rows.map((row: AnyRecord) => row.action);
  }

  async getOnboardingState() {
    const state = await (this.prisma as any).onboardingState.findUnique({
      where: {
        tenantId_hospitalId: {
          tenantId: this.ids.tenantId,
          hospitalId: this.ids.hospitalId,
        },
      },
    });

    return this.onboardingView(state);
  }

  async updateOnboardingState(input: AnyRecord) {
    const state = await (this.prisma as any).onboardingState.upsert({
      where: {
        tenantId_hospitalId: {
          tenantId: this.ids.tenantId,
          hospitalId: this.ids.hospitalId,
        },
      },
      update: {
        overallStatus: input.overall_status ?? undefined,
        currentStepKey: input.current_step_key ?? undefined,
        skipReasonSanitized: input.skip_reason_sanitized ?? undefined,
        blockedReasonCodes: Array.isArray(input.blocked_reason_codes)
          ? input.blocked_reason_codes.map(String)
          : undefined,
        readyForClaimDesk:
          typeof input.ready_for_claim_desk === "boolean"
            ? input.ready_for_claim_desk
            : undefined,
        readyForClaimDeskAt:
          input.ready_for_claim_desk === true ? new Date() : undefined,
      },
      create: {
        onboardingStateId: randomUUID(),
        tenantId: this.ids.tenantId,
        hospitalId: this.ids.hospitalId,
        overallStatus: input.overall_status ?? "ready_for_claim_desk",
        currentStepKey: input.current_step_key ?? "claim_desk_ready",
        profileCardStatus: "ready",
        mailboxCardStatus: "test_mode",
        counterpartyCardStatus: "evidence_gated",
        testEmailCardStatus: "sent",
        readinessCardStatus: "blocked_for_live_send",
        blockedReasonCodes: activeSendGuard().blocked_reason_codes,
        readyForClaimDesk: input.ready_for_claim_desk ?? true,
        readyForClaimDeskAt: new Date(),
      },
    });
    await this.audit(
      "onboarding_update",
      "onboarding_state",
      state.onboardingStateId,
    );
    return this.onboardingView(state);
  }

  async getHospitalProfile() {
    const hospital = await (this.prisma as any).hospital.findUnique({
      where: { hospitalId: this.ids.hospitalId },
    });
    return {
      tenant_id: this.ids.tenantId,
      hospital_id: this.ids.hospitalId,
      display_name: hospital?.displayName ?? "Lotus Valley Test Hospital",
      legal_name:
        hospital?.legalName ?? "Lotus Valley Test Hospital Private Limited",
      city: hospital?.city ?? "Indore",
      state: hospital?.state ?? "Madhya Pradesh",
      insurance_desk_email_masked: "in***@example.test",
      redaction_level: "masked_default",
      updated_at: (hospital?.updatedAt ?? new Date()).toISOString(),
    };
  }

  async updateHospitalProfile(input: AnyRecord) {
    const hospital = await (this.prisma as any).hospital.update({
      where: { hospitalId: this.ids.hospitalId },
      data: {
        displayName: input.display_name ?? undefined,
        legalName: input.legal_name ?? undefined,
        city: input.city ?? undefined,
        state: input.state ?? undefined,
      },
    });
    await this.audit(
      "hospital_profile_update",
      "hospital",
      hospital.hospitalId,
    );
    return this.getHospitalProfile();
  }

  async addEvidenceArtifact(input: AnyRecord) {
    const artifactId = input.artifact_id ?? `ARTIFACT-${randomUUID()}`;
    const rejected = hasPatientHeader(input.headers);
    const artifact = await (this.prisma as any).setupEvidenceArtifact.create({
      data: {
        setupEvidenceArtifactId: randomUUID(),
        publicArtifactId: artifactId,
        tenantId: this.ids.tenantId,
        hospitalId: this.ids.hospitalId,
        artifactType: input.artifact_type ?? "setup_evidence",
        sourceLabelSanitized:
          input.source_label_sanitized ?? "synthetic setup evidence",
        piiScanStatus: rejected ? "rejected" : "passed",
        excelHeaderValidationStatus: rejected ? "rejected" : "passed",
        validationStatus: rejected ? "rejected" : "collected",
        rejectionReasonSanitized: rejected ? "patient_identifier_header" : null,
        rejectedReasonCodes: rejected ? ["patient_identifier_header"] : [],
      },
    });
    await this.audit(
      "setup_evidence_upload",
      "setup_evidence_artifact",
      artifact.publicArtifactId,
      { pii_scan_status: artifact.piiScanStatus },
    );
    return this.artifactView(artifact);
  }

  async importPayerMix(input: AnyRecord) {
    const sourceArtifactId = String(input.source_artifact_id ?? "");
    const source = await (this.prisma as any).setupEvidenceArtifact.findUnique({
      where: { publicArtifactId: sourceArtifactId },
    });
    let acceptedRows = 0;
    let rejectedRows = 0;
    const reasons = new Set<string>();

    if (!source) reasons.add("source_artifact_not_found");

    for (const row of input.rows ?? []) {
      if (hasPatientHeader(row.headers)) {
        rejectedRows += 1;
        reasons.add("patient_identifier_header");
        continue;
      }
      if (!source) {
        rejectedRows += 1;
        continue;
      }

      await (this.prisma as any).anonymizedPayerMixRow.create({
        data: {
          payerMixRowId: randomUUID(),
          tenantId: this.ids.tenantId,
          hospitalId: this.ids.hospitalId,
          sourceArtifactPublicId: sourceArtifactId,
          counterpartyDisplayName:
            row.counterparty_display_name ?? "Example TPA Sandbox",
          counterpartyType: row.counterparty_type ?? "tpa",
          claimCount: Number(row.claim_count ?? 0),
          claimValueProcessed: row.claim_value_processed ?? null,
          cashlessSharePercent: row.cashless_share_percent ?? null,
          rankInHospital: row.rank_in_hospital ?? null,
        },
      });
      acceptedRows += 1;
    }

    await this.audit(
      "payer_mix_import",
      "setup_evidence_artifact",
      sourceArtifactId,
      {
        accepted_rows: acceptedRows,
        rejected_rows: rejectedRows,
      },
    );

    return {
      source_artifact_id: input.source_artifact_id ?? null,
      accepted_rows: acceptedRows,
      rejected_rows: rejectedRows,
      rejection_reasons: [...reasons],
      imported_at: nowIso(),
    };
  }

  async createHospitalCounterparty(input: AnyRecord) {
    const publicId = input.hospital_counterparty_id ?? `HCP-${randomUUID()}`;
    const profile = await (
      this.prisma as any
    ).hospitalCounterpartyProfile.create({
      data: {
        hospitalCounterpartyId: randomUUID(),
        publicHospitalCounterpartyId: publicId,
        tenantId: this.ids.tenantId,
        hospitalId: this.ids.hospitalId,
        counterpartyDisplayName: input.display_name ?? "Example TPA Sandbox",
        counterpartyType: input.counterparty_type ?? "tpa",
        submissionMode: input.submission_mode ?? "unknown",
        activeForSubmission: false,
        blockedReasonCodes: activeSendGuard().blocked_reason_codes,
      },
    });
    await this.audit(
      "counterparty_profile_update",
      "hospital_counterparty_profile",
      profile.publicHospitalCounterpartyId,
    );
    return this.counterpartyView(profile);
  }

  async updateHospitalCounterparty(id: string, input: AnyRecord) {
    const profile = await (
      this.prisma as any
    ).hospitalCounterpartyProfile.update({
      where: { publicHospitalCounterpartyId: id },
      data: {
        counterpartyDisplayName: input.display_name ?? undefined,
        counterpartyType: input.counterparty_type ?? undefined,
        submissionMode: input.submission_mode ?? undefined,
        acceptedPreauthToEmailMasked:
          input.accepted_preauth_to_email_masked ?? undefined,
        whitelistedSenderEmailMasked:
          input.whitelisted_sender_email_masked ?? undefined,
        supportNoteSanitized: input.support_note_sanitized ?? undefined,
        activeForSubmission: false,
        blockedReasonCodes: activeSendGuard().blocked_reason_codes,
      },
    });
    await this.audit(
      "counterparty_profile_update",
      "hospital_counterparty_profile",
      profile.publicHospitalCounterpartyId,
    );
    return this.counterpartyView(profile);
  }

  async createRuleSet(id: string, input: AnyRecord) {
    const profile = await (
      this.prisma as any
    ).hospitalCounterpartyProfile.findUnique({
      where: { publicHospitalCounterpartyId: id },
    });
    const ruleSet = await (this.prisma as any).ruleSet.create({
      data: {
        ruleSetId: randomUUID(),
        publicRuleSetId: `RULESET-${randomUUID()}`,
        tenantId: this.ids.tenantId,
        hospitalId: this.ids.hospitalId,
        hospitalCounterpartyId: profile?.hospitalCounterpartyId ?? null,
        ruleSetType: input.rule_set_type ?? "document_checklist",
        version: 1,
        rulesPayload: input.rules_payload ?? {},
        ruleSource: input.rule_source ?? "synthetic_draft",
        fieldSourceConfidence: input.source_confidence ?? "synthetic_draft",
      },
    });
    await this.audit("rule_set_create", "rule_set", ruleSet.publicRuleSetId);
    return {
      hospital_counterparty_id: id,
      rule_set_id: ruleSet.publicRuleSetId,
      rule_set_status: "draft",
      source_confidence: ruleSet.fieldSourceConfidence,
      active_for_submission: false,
      active_send_guard: activeSendGuard(),
    };
  }

  async markTestEmailFailed(id: string, input: AnyRecord = {}) {
    await this.audit("test_email_update", "email_event", id, {
      status: "failed",
    });
    return {
      email_event_id: id,
      status: "failed",
      failed_reason_sanitized:
        input.failed_reason_sanitized ?? "synthetic no-patient-data failure",
      no_patient_data: true,
      updated_at: nowIso(),
    };
  }

  async createClaim(input: AnyRecord) {
    const claimNumber = input.claim_id ?? `CLM-${randomUUID()}`;
    const created = await (this.prisma as any).$transaction(async (tx: any) => {
      const claim = await tx.claim.create({
        data: {
          claimId: randomUUID(),
          eytherClaimNumber: claimNumber,
          tenantId: this.ids.tenantId,
          hospitalId: this.ids.hospitalId,
          branchId: input.branch_id ?? "BRANCH-TEST-0001",
          hospitalCounterpartyPublicId:
            input.hospital_counterparty_id ?? "HCP-TEST-0001",
          patientDisplayName: input.patient_display_name ?? "Masked Patient",
          patientRefMasked: input.patient_ref_masked ?? "PT-MASKED-0001",
          policyRefMasked: input.policy_ref_masked ?? "POLICY-MASKED-0001",
          counterpartyDisplayName:
            input.counterparty_display_name ?? "Example TPA Sandbox",
          owner: input.owner ?? "Insurance Desk Test Owner",
          assignedOfficer:
            input.assigned_officer ?? "Insurance Desk Test Owner",
          currentStage: input.current_stage ?? "draft_preauth",
          currentStatus: input.current_status ?? "Draft saved",
          preauthRequestedAmount:
            input.preauth_requested_amount ?? input.claim_value_inr ?? 0,
          claimValueInr:
            input.claim_value_inr ?? input.preauth_requested_amount ?? 0,
        },
      });
      await tx.lifecycleStatusEvent.create({
        data: {
          lifecycleStatusEventId: randomUUID(),
          publicLifecycleEventId: `LIFE-${randomUUID()}`,
          tenantId: this.ids.tenantId,
          hospitalId: this.ids.hospitalId,
          claimId: claim.claimId,
          toStage: claim.currentStage,
          toStatus: claim.currentStatus,
          triggerSource: "manual",
          reasonNoteSanitized: "Synthetic claim draft created.",
          changedByUserId: this.ids.userId,
        },
      });
      await tx.auditLog.create({
        data: this.auditData("claim_create", "claim", claim.eytherClaimNumber),
      });
      return claim;
    });

    return this.getClaim(created.eytherClaimNumber);
  }

  async getClaim(claimId: string): Promise<AnyRecord | null> {
    const claim = await this.findClaim(claimId);
    if (!claim) return null;
    return this.claimView(claim);
  }

  async updateClaim(
    claimId: string,
    input: AnyRecord,
  ): Promise<AnyRecord | null> {
    const existing = await this.findClaim(claimId);
    if (!existing) return null;
    const updated = await (this.prisma as any).claim.update({
      where: { claimId: existing.claimId },
      data: {
        assignedOfficer: input.assigned_officer ?? undefined,
        owner: input.owner ?? undefined,
        currentStatus: input.current_status ?? undefined,
        preauthRequestedAmount: input.preauth_requested_amount ?? undefined,
        claimValueInr: input.claim_value_inr ?? undefined,
      },
      include: this.claimInclude(),
    });
    await this.audit("claim_update", "claim", updated.eytherClaimNumber);
    return this.claimView(updated);
  }

  async createPacket(claimId: string, input: AnyRecord) {
    const claim = await this.findClaim(claimId);
    if (!claim) return null;
    const packet = await (this.prisma as any).claimApplicationPacket.create({
      data: {
        packetId: randomUUID(),
        publicPacketId: input.packet_id ?? `PACKET-${randomUUID()}`,
        tenantId: this.ids.tenantId,
        hospitalId: this.ids.hospitalId,
        claimId: claim.claimId,
        packetType: input.packet_type ?? "preauth",
        packetStatus: "draft",
        requestedAmount: input.requested_amount ?? null,
        triggerReason: input.trigger_reason ?? null,
        sendBlockedReasonCodes: activeSendGuard().blocked_reason_codes,
        createdByUserId: this.ids.userId,
      },
    });
    await this.audit(
      "packet_create",
      "claim_application_packet",
      packet.publicPacketId,
    );
    return this.packetView(packet, claim.eytherClaimNumber);
  }

  async attachDocument(claimId: string, packetId: string, input: AnyRecord) {
    const claim = await this.findClaim(claimId);
    if (!claim) return null;
    const packet = await (this.prisma as any).claimApplicationPacket.findFirst({
      where: {
        publicPacketId: packetId,
        claimId: claim.claimId,
        tenantId: this.ids.tenantId,
        hospitalId: this.ids.hospitalId,
      },
    });
    const document = await (this.prisma as any).documentAttachment.create({
      data: {
        documentAttachmentId: randomUUID(),
        publicDocumentId: input.document_id ?? `DOC-${randomUUID()}`,
        tenantId: this.ids.tenantId,
        hospitalId: this.ids.hospitalId,
        claimId: claim.claimId,
        packetId: packet?.packetId ?? null,
        documentType: input.document_type ?? "supporting_document",
        fileNameSanitized:
          input.file_name_sanitized ?? "synthetic-document.pdf",
        sourceLabelSanitized:
          input.source_label_sanitized ?? "synthetic upload",
        version: 1,
        redactionStatus: "redacted",
      },
    });
    await this.audit(
      "document_attach",
      "document_attachment",
      document.publicDocumentId,
    );
    return this.documentView(document, claim.eytherClaimNumber, packetId);
  }

  async replaceDocument(documentId: string, input: AnyRecord) {
    const existing = await (this.prisma as any).documentAttachment.findUnique({
      where: { publicDocumentId: documentId },
      include: { claim: true, packet: true },
    });
    if (!existing) return null;
    const replaced = await (this.prisma as any).documentAttachment.update({
      where: { publicDocumentId: documentId },
      data: {
        fileNameSanitized:
          input.file_name_sanitized ?? "synthetic-document-v2.pdf",
        reasonNoteSanitized:
          input.reason_note_sanitized ?? "synthetic replacement",
        version: { increment: 1 },
        redactionStatus: "redacted",
      },
      include: { claim: true, packet: true },
    });
    await this.audit("document_replace", "document_attachment", documentId);
    return this.documentView(
      replaced,
      replaced.claim.eytherClaimNumber,
      replaced.packet?.publicPacketId ?? null,
    );
  }

  downloadManualRoute(claimId: string, packetId: string) {
    return {
      claim_id: claimId,
      packet_id: packetId,
      filename: `manual-route-${claimId}-${packetId}.pdf`,
      content_type: "application/pdf",
      active_send_code: ACTIVE_SEND_BLOCKED,
      portal_manual_tracking_required: true,
      acknowledgement_required: true,
      redaction_status: "redacted",
      generated_at: nowIso(),
    };
  }

  async addLifecycleEvent(claimId: string, input: AnyRecord) {
    const claim = await this.findClaim(claimId);
    if (!claim) return null;
    const event = await (this.prisma as any).$transaction(async (tx: any) => {
      const lifecycle = await tx.lifecycleStatusEvent.create({
        data: {
          lifecycleStatusEventId: randomUUID(),
          publicLifecycleEventId: `LIFE-${randomUUID()}`,
          tenantId: this.ids.tenantId,
          hospitalId: this.ids.hospitalId,
          claimId: claim.claimId,
          fromStage: claim.currentStage,
          fromStatus: claim.currentStatus,
          toStage: input.to_stage ?? "query",
          toStatus: input.to_status ?? "query_raised",
          triggerSource: input.trigger_source ?? "manual",
          reasonNoteSanitized:
            input.reason_note_sanitized ?? "synthetic lifecycle movement",
          changedByUserId: this.ids.userId,
        },
      });
      await tx.claim.update({
        where: { claimId: claim.claimId },
        data: {
          currentStage: lifecycle.toStage,
          currentStatus: lifecycle.toStatus,
        },
      });
      await tx.auditLog.create({
        data: this.auditData(
          "lifecycle_event_create",
          "lifecycle_status_event",
          lifecycle.publicLifecycleEventId,
        ),
      });
      return lifecycle;
    });
    return {
      lifecycle_event_id: event.publicLifecycleEventId,
      claim_id: claim.eytherClaimNumber,
      to_stage: event.toStage,
      to_status: event.toStatus,
      reason_note_sanitized: event.reasonNoteSanitized,
      created_at: event.changedAt.toISOString(),
    };
  }

  async getWorklist() {
    const claims = await (this.prisma as any).claim.findMany({
      where: {
        tenantId: this.ids.tenantId,
        hospitalId: this.ids.hospitalId,
        activeStatus: "active",
      },
      include: this.claimInclude(),
      orderBy: { updatedAt: "desc" },
    });
    return { items: claims.map((claim: AnyRecord) => this.claimView(claim)) };
  }

  async getManualMatchQueue() {
    const items = await (this.prisma as any).emailEvent.findMany({
      where: {
        tenantId: this.ids.tenantId,
        hospitalId: this.ids.hospitalId,
        matchStatus: { in: ["needs_review", "unmatched"] },
      },
      orderBy: { receivedAt: "desc" },
    });
    return {
      items: items.map((event: AnyRecord) => this.emailEventView(event)),
    };
  }

  getMatchCandidates(emailEventId: string) {
    return {
      email_event_id: emailEventId,
      items: [
        {
          claim_id: syntheticIds.claimId,
          confidence: 0.74,
          reason_codes: ["subject_claim_id_match", "counterparty_hint"],
        },
      ],
    };
  }

  async manualMatchEmail(emailEventId: string, input: AnyRecord = {}) {
    const claim = await this.findClaim(input.claim_id ?? syntheticIds.claimId);
    const event = await (this.prisma as any).emailEvent.update({
      where: { publicEmailEventId: emailEventId },
      data: {
        claimId: claim?.claimId ?? null,
        matchStatus: "manual_matched",
      },
    });
    await this.audit("manual_match", "email_event", emailEventId);
    return {
      ...this.emailEventView(event),
      claim_id:
        claim?.eytherClaimNumber ?? input.claim_id ?? syntheticIds.claimId,
      audit_action: "match_email",
      updated_at: event.updatedAt.toISOString(),
    };
  }

  async ignoreEmailEvent(emailEventId: string, input: AnyRecord = {}) {
    const event = await (this.prisma as any).emailEvent.update({
      where: { publicEmailEventId: emailEventId },
      data: {
        matchStatus: "ignored",
        reasonNoteSanitized:
          input.reason_note_sanitized ?? "synthetic ignored event",
      },
    });
    await this.audit("email_event_ignore", "email_event", emailEventId);
    return {
      ...this.emailEventView(event),
      reason_note_sanitized: event.reasonNoteSanitized,
      updated_at: event.updatedAt.toISOString(),
    };
  }

  async quarantineRelease(emailEventId: string, input: AnyRecord = {}) {
    const event = await (this.prisma as any).emailEvent.update({
      where: { publicEmailEventId: emailEventId },
      data: {
        quarantineStatus: "released",
        reasonNoteSanitized:
          input.reason_note_sanitized ?? "synthetic quarantine release",
      },
    });
    await this.audit(
      "email_event_quarantine_release",
      "email_event",
      emailEventId,
    );
    return {
      ...this.emailEventView(event),
      quarantine_status: "released",
      reason_note_sanitized: event.reasonNoteSanitized,
      updated_at: event.updatedAt.toISOString(),
    };
  }

  async getOwnerSummary() {
    const claims = await (this.prisma as any).claim.findMany({
      where: { tenantId: this.ids.tenantId, hospitalId: this.ids.hospitalId },
    });
    const total = claims.reduce(
      (sum: number, claim: AnyRecord) =>
        sum + (asNumber(claim.claimValueInr) ?? 0),
      0,
    );
    return {
      owner: "Insurance Desk Test Owner",
      open_claims: claims.length,
      outstanding_value_inr: total,
      ageing_buckets: [
        { bucket: "0-2 days", claim_count: claims.length, value_inr: total },
        { bucket: "3-7 days", claim_count: 0, value_inr: 0 },
        { bucket: "8+ days", claim_count: 0, value_inr: 0 },
      ],
      redaction_level: "aggregate_masked",
    };
  }

  async getFinanceSummary() {
    const claims = await (this.prisma as any).claim.findMany({
      where: { tenantId: this.ids.tenantId, hospitalId: this.ids.hospitalId },
    });
    const outstanding = claims.reduce(
      (sum: number, claim: AnyRecord) =>
        sum + (asNumber(claim.claimValueInr) ?? 0),
      0,
    );
    const shortPayment = claims.reduce(
      (sum: number, claim: AnyRecord) =>
        sum + (asNumber(claim.deductionShortPaymentAmount) ?? 0),
      0,
    );
    return {
      settlement_total_inr: 0,
      outstanding_ageing_inr: outstanding,
      short_payment_review_inr: shortPayment,
      payment_advice_status: "synthetic_redacted",
    };
  }

  async createExport(input: AnyRecord = {}) {
    const exportJob = await (this.prisma as any).exportJob.create({
      data: {
        exportJobId: randomUUID(),
        publicExportId: input.export_id ?? `EXPORT-${randomUUID()}`,
        tenantId: this.ids.tenantId,
        hospitalId: this.ids.hospitalId,
        exportType: input.export_type ?? "finance_settlement_csv",
        filterPayloadRedacted: input.filter_payload_redacted ?? {},
        includeSensitive: false,
        status: "ready",
        filename: "synthetic-finance-export.csv",
        reasonNoteSanitized: input.reason_note_sanitized ?? null,
        requestedByUserId: this.ids.userId,
        expiresAt: new Date(Date.now() + 60 * 60 * 1000),
      },
    });
    await this.audit("export_create", "export_job", exportJob.publicExportId);
    return {
      export_id: exportJob.publicExportId,
      export_type: exportJob.exportType,
      include_sensitive: false,
      status: exportJob.status,
      filename: exportJob.filename,
      expires_at: exportJob.expiresAt.toISOString(),
      redaction_status: "redacted",
    };
  }

  async downloadExport(exportId: string) {
    await this.audit("export_download", "export_job", exportId);
    const exportJob = await (this.prisma as any).exportJob.findUnique({
      where: { publicExportId: exportId },
    });
    return {
      export_id: exportId,
      filename: exportJob?.filename ?? "synthetic-finance-export.csv",
      content_type: "text/csv",
      redaction_status: "redacted",
    };
  }

  async revealStub(
    entityType: string,
    entityId: string,
    input: AnyRecord = {},
  ) {
    if (!input.reason_note_sanitized) {
      return {
        status: "validation_error",
        code: "REVEAL_REASON_REQUIRED",
      };
    }
    await this.audit("sensitive_reveal_requested", entityType, entityId, {
      reveal_allowed: false,
    });
    return {
      status: "blocked",
      entity_type: entityType,
      entity_id: entityId,
      reveal_allowed: false,
      blocked_reason_codes: ["raw_artifact_not_available_in_synthetic_build"],
      redaction_status: "redacted",
    };
  }

  private onboardingView(state: AnyRecord | null) {
    return {
      overall_status: state?.overallStatus ?? "ready_for_claim_desk",
      ready_for_claim_desk: state?.readyForClaimDesk ?? true,
      current_step_key: state?.currentStepKey ?? "claim_desk_ready",
      blocked_reason_codes:
        state?.blockedReasonCodes ?? activeSendGuard().blocked_reason_codes,
      cards: [
        { key: "profile", status: state?.profileCardStatus ?? "ready" },
        { key: "mailbox", status: state?.mailboxCardStatus ?? "test_mode" },
        {
          key: "counterparty",
          status: state?.counterpartyCardStatus ?? "evidence_gated",
        },
        { key: "test_email", status: state?.testEmailCardStatus ?? "sent" },
      ],
      updated_at: (state?.updatedAt ?? new Date()).toISOString(),
    };
  }

  private artifactView(artifact: AnyRecord) {
    return {
      artifact_id: artifact.publicArtifactId,
      artifact_type: artifact.artifactType,
      source_label_sanitized: artifact.sourceLabelSanitized,
      pii_scan_status: artifact.piiScanStatus,
      rejected_reason_codes: artifact.rejectedReasonCodes,
      redaction_level: "masked_default",
      created_at: artifact.createdAt.toISOString(),
    };
  }

  private counterpartyView(profile: AnyRecord) {
    return {
      hospital_counterparty_id: profile.publicHospitalCounterpartyId,
      counterparty_type: profile.counterpartyType,
      display_name: profile.counterpartyDisplayName,
      submission_mode: profile.submissionMode,
      active_for_submission: false,
      active_send_guard: activeSendGuard(),
      rule_set_version: null,
    };
  }

  private claimInclude() {
    return {
      lifecycleEvents: { orderBy: { changedAt: "asc" } },
      packets: { orderBy: { createdAt: "desc" } },
      documents: { orderBy: { createdAt: "desc" } },
    };
  }

  private async findClaim(claimId: string) {
    return (this.prisma as any).claim.findUnique({
      where: { eytherClaimNumber: claimId },
      include: this.claimInclude(),
    });
  }

  private claimView(claim: AnyRecord) {
    const latestPacket = claim.packets?.[0];
    return {
      claim_id: claim.eytherClaimNumber,
      packet_id: latestPacket?.publicPacketId ?? syntheticIds.packetId,
      patient_display_name: claim.patientDisplayName,
      patient_ref_masked: claim.patientRefMasked,
      policy_ref_masked: claim.policyRefMasked,
      insurer_or_tpa: claim.counterpartyDisplayName,
      counterparty_display_name: claim.counterpartyDisplayName,
      owner: claim.owner,
      assigned_officer: claim.assignedOfficer,
      current_stage: claim.currentStage,
      current_status: claim.currentStatus,
      claim_value_inr: asNumber(claim.claimValueInr),
      preauth_requested_amount: asNumber(claim.preauthRequestedAmount),
      branch_id: claim.branchId,
      redaction_level: "masked_default",
      active_send_guard: activeSendGuard(),
      timeline: (claim.lifecycleEvents ?? []).map((event: AnyRecord) => ({
        lifecycle_event_id: event.publicLifecycleEventId,
        to_stage: event.toStage,
        to_status: event.toStatus,
        reason_note_sanitized: event.reasonNoteSanitized,
        created_at: event.changedAt.toISOString(),
      })),
    };
  }

  private packetView(packet: AnyRecord, claimNumber: string) {
    return {
      packet_id: packet.publicPacketId,
      claim_id: claimNumber,
      packet_type: packet.packetType,
      requested_amount: asNumber(packet.requestedAmount),
      trigger_reason: packet.triggerReason,
      packet_status: packet.packetStatus,
      active_send_guard: activeSendGuard(),
      created_at: packet.createdAt.toISOString(),
    };
  }

  private documentView(
    document: AnyRecord,
    claimNumber: string,
    packetPublicId: string | null,
  ) {
    return {
      document_id: document.publicDocumentId,
      claim_id: claimNumber,
      packet_id: packetPublicId,
      document_type: document.documentType,
      file_name_sanitized: document.fileNameSanitized,
      source_label_sanitized: document.sourceLabelSanitized,
      version: document.version,
      redaction_status: document.redactionStatus,
      created_at: document.createdAt.toISOString(),
    };
  }

  private emailEventView(event: AnyRecord) {
    return {
      email_event_id: event.publicEmailEventId,
      subject_sanitized: event.subjectSanitized,
      body_preview_redacted: event.bodyPreviewRedacted,
      match_status: event.matchStatus,
      raw_access: event.rawAccess,
      received_at: event.receivedAt.toISOString(),
    };
  }

  private auditData(
    action: string,
    entityType: string,
    entityId: string,
    details: AnyRecord = {},
  ) {
    return {
      auditLogId: randomUUID(),
      tenantId: this.ids.tenantId,
      hospitalId: this.ids.hospitalId,
      actorUserId: this.ids.userId,
      action,
      entityType,
      entityId,
      metadataRedacted: auditPayload("phase1_operational_store", details),
    };
  }

  private async audit(
    action: string,
    entityType: string,
    entityId: string,
    details: AnyRecord = {},
  ) {
    await (this.prisma as any).auditLog.create({
      data: this.auditData(action, entityType, entityId, details),
    });
  }
}

export function createPhase1OperationalStoreFromEnv(
  env: NodeJS.ProcessEnv = process.env,
) {
  if (env.EYTHER_PHASE1_STORE === "prisma") {
    if (!env.DATABASE_URL)
      throw new Error("EYTHER_PHASE1_STORE=prisma requires DATABASE_URL.");
    return new PrismaPhase1OperationalStore(createPrismaClient());
  }
  return createPhase1OperationalStore();
}
