import { describe, expect, it } from "vitest";
import { ACTIVE_SEND_BLOCKED, syntheticIds } from "@eyther/contracts";
import { createPhase1OperationalStore } from "./phase1-operational-store.js";

describe("Phase 1 operational store", () => {
  it("updates onboarding state, hospital profile, evidence, and payer mix without patient data", () => {
    const store = createPhase1OperationalStore();

    const onboarding = store.updateOnboardingState({
      current_step_key: "counterparty",
      skip_reason_sanitized: null,
    });
    const profile = store.updateHospitalProfile({
      display_name: "Lotus Valley Synthetic Hospital",
      city: "Pune",
      state: "Maharashtra",
      insurance_desk_email_masked: "cl***@example.test",
    });
    const artifact = store.addEvidenceArtifact({
      artifact_type: "payer_mix_csv",
      source_label_sanitized: "synthetic onboarding workbook",
      headers: ["counterparty_display_name", "claim_count"],
    });
    const payerMix = store.importPayerMix({
      source_artifact_id: artifact.artifact_id,
      rows: [
        {
          counterparty_display_name: "Example TPA Sandbox",
          counterparty_type: "tpa",
          claim_count: 12,
          claim_value_processed: 100000,
        },
      ],
    });

    expect(onboarding.current_step_key).toBe("counterparty");
    expect(profile.display_name).toBe("Lotus Valley Synthetic Hospital");
    expect(artifact).toMatchObject({
      artifact_type: "payer_mix_csv",
      pii_scan_status: "passed",
    });
    expect(payerMix).toMatchObject({ accepted_rows: 1, rejected_rows: 0 });
    expect(store.listAuditActions()).toEqual([
      "onboarding_update",
      "hospital_profile_update",
      "setup_evidence_upload",
      "payer_mix_import",
    ]);
  });

  it("rejects onboarding evidence and payer-mix headers that look like patient identifiers", () => {
    const store = createPhase1OperationalStore();

    const artifact = store.addEvidenceArtifact({
      artifact_type: "payer_mix_csv",
      source_label_sanitized: "bad synthetic header test",
      headers: ["Patient Name", "counterparty_display_name"],
    });
    const payerMix = store.importPayerMix({
      source_artifact_id: "missing",
      rows: [
        {
          counterparty_display_name: "Patient Linked Row",
          counterparty_type: "tpa",
          claim_count: 1,
          claim_value_processed: 1,
          headers: ["UHID"],
        },
      ],
    });

    expect(artifact).toMatchObject({
      pii_scan_status: "rejected",
      rejected_reason_codes: ["patient_identifier_header"],
    });
    expect(payerMix).toMatchObject({
      accepted_rows: 0,
      rejected_rows: 1,
      rejection_reasons: [
        "source_artifact_not_found",
        "patient_identifier_header",
      ],
    });
  });

  it("creates and mutates synthetic claims, packets, documents, manual routes, and lifecycle events", () => {
    const store = createPhase1OperationalStore();
    const created = store.createClaim({
      patient_ref_masked: "PT-MASKED-0099",
      policy_ref_masked: "POLICY-MASKED-0099",
      counterparty_display_name: "Example TPA Sandbox",
      branch_id: "BRANCH-TEST-0001",
      preauth_requested_amount: 94000,
    });
    const patched = store.updateClaim(created.claim_id, {
      assigned_officer: "Insurance Desk Synthetic User",
      next_follow_up_on: "2026-05-07",
      current_status: "Doctor note pending",
    });
    const packet = store.createPacket(created.claim_id, {
      packet_type: "enhancement",
      requested_amount: 12000,
      trigger_reason: "longer_stay",
    });
    const document = store.attachDocument(created.claim_id, packet.packet_id, {
      document_type: "doctor_note",
      file_name_sanitized: "synthetic-doctor-note.pdf",
      source_label_sanitized: "synthetic upload",
    });
    const replaced = store.replaceDocument(document.document_id, {
      file_name_sanitized: "synthetic-doctor-note-v2.pdf",
      reason_note_sanitized: "clearer synthetic scan",
    });
    const manualRoute = store.downloadManualRoute(
      created.claim_id,
      packet.packet_id,
    );
    const lifecycle = store.addLifecycleEvent(created.claim_id, {
      to_stage: "query",
      to_status: "query_raised",
      reason_note_sanitized: "synthetic query received",
    });

    expect(created.active_send_guard.allowed).toBe(false);
    expect(patched).not.toBeNull();
    expect(patched?.current_status).toBe("Doctor note pending");
    expect(packet.packet_type).toBe("enhancement");
    expect(document.version).toBe(1);
    expect(replaced.version).toBe(2);
    expect(manualRoute).toMatchObject({
      active_send_code: ACTIVE_SEND_BLOCKED,
      portal_manual_tracking_required: true,
    });
    expect(lifecycle).toMatchObject({
      to_stage: "query",
      to_status: "query_raised",
    });
    expect(store.getClaim(created.claim_id)?.timeline).toContainEqual(
      expect.objectContaining({ to_stage: "query" }),
    );
  });

  it("handles manual match candidates, ignore, owner/finance summaries, and exports", () => {
    const store = createPhase1OperationalStore();
    const candidates = store.getMatchCandidates(syntheticIds.emailEventId);
    const ignored = store.ignoreEmailEvent(syntheticIds.emailEventId, {
      reason_note_sanitized: "not related to this synthetic claim",
    });
    const owner = store.getOwnerSummary();
    const finance = store.getFinanceSummary();
    const exportJob = store.createExport({
      export_type: "finance_settlement_csv",
      include_sensitive: false,
      reason_note_sanitized: "synthetic finance review",
    });
    const download = store.downloadExport(exportJob.export_id);

    expect(candidates.items[0]).toMatchObject({
      claim_id: syntheticIds.claimId,
    });
    expect(ignored.match_status).toBe("ignored");
    expect(owner.open_claims).toBeGreaterThan(0);
    expect(finance.outstanding_ageing_inr).toBeGreaterThan(0);
    expect(exportJob).toMatchObject({ status: "ready" });
    expect(download).toMatchObject({ content_type: "text/csv" });
  });
});
