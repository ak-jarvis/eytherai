import "reflect-metadata";
import { Controller, Get, HttpException, HttpStatus, Module, Param, Post } from "@nestjs/common";
import { NestFactory } from "@nestjs/core";
import { pathToFileURL } from "node:url";
import {
  ACTIVE_SEND_BLOCKED,
  canonicalRoutes,
  type HealthResponse,
  healthResponseSchema,
  sendEligibilitySchema,
  syntheticIds
} from "@eyther/contracts";
import { eytherScaffold, nowIso } from "@eyther/config";

const api = eytherScaffold.apiBasePath;

const claim = {
  claim_id: syntheticIds.claimId,
  packet_id: syntheticIds.packetId,
  patient_display_name: "Test Patient Alpha",
  patient_ref_masked: "UHID-TEST-0001",
  policy_ref_masked: "POLICY-TEST-1234",
  insurer_or_tpa: "Example TPA Sandbox",
  owner: "Insurance Desk Test Owner",
  current_stage: "draft_preauth",
  current_status: "Awaiting evidence",
  claim_value_inr: 125000,
  redaction_level: "masked_default"
};

const emailEvent = {
  email_event_id: syntheticIds.emailEventId,
  subject_sanitized: `Test email acknowledgement for ${syntheticIds.claimId}`,
  body_preview_redacted: "Synthetic acknowledgement only. No patient data.",
  match_status: "needs_review",
  raw_access: "restricted"
};

function correlationId() {
  return `req_${Date.now().toString(36)}`;
}

function ok(data: unknown, permissions = ["phase1:synthetic-read"]) {
  return {
    data,
    meta: { correlation_id: correlationId(), permissions, redaction_level: "masked_default" },
    errors: []
  };
}

function activeSendGuard() {
  return sendEligibilitySchema.parse({
    allowed: false,
    blocked_reason_codes: ["missing_empanelment_id", "missing_accepted_route", "missing_test_email_acknowledgement"],
    required_evidence: [
      "hospital_artifact_status=verified",
      "test_email_status=acknowledged",
      "live_validation_status=acknowledged",
      "mailbox.send_enabled=true",
      "whitelisted_sender_email matched"
    ],
    safe_next_action: "send_test_email"
  });
}

function activeSendBlocked() {
  throw new HttpException(
    {
      code: ACTIVE_SEND_BLOCKED,
      message: "Active Send is blocked until exact hospital x counterparty route evidence and no-patient-data acknowledgement are present.",
      field: null,
      blocked_reason_codes: activeSendGuard().blocked_reason_codes,
      correlation_id: correlationId()
    },
    HttpStatus.LOCKED
  );
}

@Controller(api)
class HealthController {
  @Get("health")
  health(): HealthResponse {
    return healthResponseSchema.parse({ ok: true, service: "api", phase: "phase-1-local" });
  }

  @Get("contract/routes")
  routes() {
    return ok({ base_path: api, canonical_routes: canonicalRoutes });
  }
}

@Controller(api)
class PhaseOneController {
  @Post("auth/login/start")
  loginStart() {
    return ok({ login_challenge_id: "LOGIN-TEST-0001", delivery: "synthetic_email" });
  }

  @Post("auth/login/verify")
  loginVerify() {
    return ok({ user_id: syntheticIds.userId, roles: ["hospital_admin", "claim_officer", "billing_finance"] });
  }

  @Get("invites/:invite_id")
  invite(@Param("invite_id") inviteId: string) {
    return ok({ invite_id: inviteId, status: "pending", hospital: "Lotus Valley Test Hospital" });
  }

  @Post("invites/:invite_id/accept")
  acceptInvite(@Param("invite_id") inviteId: string) {
    return ok({ invite_id: inviteId, invite_status: "accepted" });
  }

  @Get("setup/onboarding-state")
  onboarding() {
    return ok({
      overall_status: "ready_for_claim_desk",
      ready_for_claim_desk: true,
      blocked_reason_codes: activeSendGuard().blocked_reason_codes,
      cards: [
        { key: "profile", status: "ready" },
        { key: "mailbox", status: "test_mode" },
        { key: "counterparty", status: "evidence_gated" },
        { key: "test_email", status: "sent" }
      ]
    });
  }

  @Get("hospital-profile")
  hospitalProfile() {
    return ok({
      tenant_id: syntheticIds.tenantId,
      hospital_id: syntheticIds.hospitalId,
      display_name: "Lotus Valley Test Hospital",
      insurance_desk_email_masked: "in***@example.test",
      redaction_level: "masked_default"
    });
  }

  @Get("counterparties/master")
  counterparties() {
    return ok({
      items: [
        { counterparty_id: "COUNTERPARTY-TEST-0001", counterparty_type: "tpa", display_name: "Example TPA Sandbox" },
        { counterparty_id: "COUNTERPARTY-TEST-0002", counterparty_type: "insurer", display_name: "Example Insurer Desk" },
        { counterparty_id: "COUNTERPARTY-TEST-0003", counterparty_type: "scheme_authority", display_name: "Example Scheme Authority" }
      ]
    });
  }

  @Get("hospital-counterparties/:hospital_counterparty_id/readiness")
  readiness(@Param("hospital_counterparty_id") id: string) {
    return ok({ hospital_counterparty_id: id, guard: activeSendGuard(), active_for_submission: false });
  }

  @Post("hospital-counterparties/:hospital_counterparty_id/activate-submission")
  activateSubmission() {
    activeSendBlocked();
  }

  @Get("mailboxes")
  mailboxes() {
    return ok({ items: [{ mailbox_connection_id: syntheticIds.mailboxConnectionId, connection_status: "connected", send_enabled: false, read_enabled: true }] });
  }

  @Post("test-emails/send")
  sendTestEmail() {
    return ok({ email_event_id: syntheticIds.emailEventId, status: "sent", no_patient_data: true });
  }

  @Post("test-emails/:email_event_id/mark-acknowledged")
  acknowledgeTestEmail(@Param("email_event_id") id: string) {
    return ok({ email_event_id: id, status: "acknowledged", no_patient_data: true, acknowledged_at: nowIso() });
  }

  @Get("claims/:claim_id")
  claimDetail(@Param("claim_id") id: string) {
    return ok({ ...claim, claim_id: id, active_send_guard: activeSendGuard() });
  }

  @Get("claims/:claim_id/packets/:packet_id/send-eligibility")
  sendEligibility() {
    return ok(activeSendGuard());
  }

  @Post("claims/:claim_id/packets/:packet_id/send")
  sendPacket() {
    activeSendBlocked();
  }

  @Post("claims/:claim_id/packets/:packet_id/retry-send")
  retrySend() {
    activeSendBlocked();
  }

  @Get("worklist")
  worklist() {
    return ok({
      items: [
        claim,
        { ...claim, claim_id: "CLM-TEST-0002", patient_display_name: "Test Patient Beta", current_status: "Doctor note pending", claim_value_inr: 84000 },
        { ...claim, claim_id: "CLM-TEST-0003", patient_display_name: "Test Patient Gamma", current_status: "Short payment review", claim_value_inr: 218000 }
      ]
    });
  }

  @Get("email-events/manual-match-queue")
  manualMatchQueue() {
    return ok({ items: [emailEvent] });
  }

  @Post("email-events/:email_event_id/manual-match")
  manualMatch(@Param("email_event_id") id: string) {
    return ok({ email_event_id: id, claim_id: syntheticIds.claimId, match_status: "manual_matched", audit_action: "match_email" });
  }

  @Post("parser-runs/:parser_run_id/review")
  parserReview(@Param("parser_run_id") id: string) {
    return ok({ parser_run_id: id, confidence: "low", requires_manual_review: true, low_confidence_guard: "no terminal settlement mutation" });
  }

  @Get("owner-summary")
  ownerSummary() {
    return ok({ owner: claim.owner, open_claims: 14, outstanding_value_inr: 1840000, redaction_level: "aggregate_masked" });
  }

  @Get("finance-summary")
  financeSummary() {
    return ok({ settlement_total_inr: 690000, short_payment_review_inr: 218000, payment_advice_status: "synthetic_redacted" });
  }

  @Post("exports")
  createExport() {
    return ok({ export_id: syntheticIds.exportId, status: "ready", filename: "synthetic-finance-export.csv", expires_at: nowIso() });
  }

  @Get("exports/:export_id/download")
  downloadExport(@Param("export_id") id: string) {
    return ok({ export_id: id, filename: "synthetic-finance-export.csv", content_type: "text/csv", redaction_status: "redacted" });
  }
}

@Module({ controllers: [HealthController, PhaseOneController] })
class AppModule {}

export async function createApp() {
  const app = await NestFactory.create(AppModule, { logger: ["error", "warn", "log"] });
  app.enableCors({ origin: ["http://localhost:3000", "http://127.0.0.1:3000"], credentials: true });
  return app;
}

async function bootstrap() {
  const app = await createApp();
  const port = Number(process.env.PORT ?? 3001);
  await app.listen(port, "0.0.0.0");
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  void bootstrap();
}
