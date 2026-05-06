import {
  ACTIVE_SEND_BLOCKED,
  sendEligibilitySchema,
  syntheticIds,
} from "@eyther/contracts";

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
