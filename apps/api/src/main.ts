import "reflect-metadata";
import {
  Body,
  CanActivate,
  Controller,
  ExecutionContext,
  Get,
  HttpException,
  HttpStatus,
  Injectable,
  Module,
  Param,
  Post,
  Req,
  Res,
  SetMetadata,
} from "@nestjs/common";
import { NestFactory, Reflector } from "@nestjs/core";
import { pathToFileURL } from "node:url";
import {
  ACTIVE_SEND_BLOCKED,
  AUTH_SESSION_COOKIE,
  canonicalRoutes,
  type HealthResponse,
  healthResponseSchema,
  sendEligibilitySchema,
  syntheticIds,
} from "@eyther/contracts";
import { eytherScaffold, nowIso } from "@eyther/config";
import { createAuthStoreFromEnv } from "./auth-store.js";

const api = eytherScaffold.apiBasePath;
const isPublicKey = "eyther:isPublic";
const requiredRolesKey = "eyther:requiredRoles";
const authStore = createAuthStoreFromEnv();

const Public = () => SetMetadata(isPublicKey, true);
const Roles = (...roles: string[]) => SetMetadata(requiredRolesKey, roles);

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
  redaction_level: "masked_default",
};

const emailEvent = {
  email_event_id: syntheticIds.emailEventId,
  subject_sanitized: `Test email acknowledgement for ${syntheticIds.claimId}`,
  body_preview_redacted: "Synthetic acknowledgement only. No patient data.",
  match_status: "needs_review",
  raw_access: "restricted",
};

function correlationId() {
  return `req_${Date.now().toString(36)}`;
}

function ok(data: unknown, permissions = ["phase1:synthetic-read"]) {
  return {
    data,
    meta: {
      correlation_id: correlationId(),
      permissions,
      redaction_level: "masked_default",
    },
    errors: [],
  };
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

function apiError(
  code: string,
  message: string,
  status: HttpStatus,
  blockedReasonCodes: string[] = [],
): never {
  throw new HttpException(
    {
      code,
      message,
      field: null,
      blocked_reason_codes: blockedReasonCodes,
      correlation_id: correlationId(),
    },
    status,
  );
}

function parseCookieHeader(cookieHeader: string | undefined) {
  return Object.fromEntries(
    (cookieHeader ?? "")
      .split(";")
      .map((part) => part.trim())
      .filter(Boolean)
      .map((part) => {
        const [name, ...valueParts] = part.split("=");
        return [name, valueParts.join("=")];
      }),
  );
}

function setCookie(
  response: { setHeader(name: string, value: string): void },
  value: string,
  maxAgeSeconds: number,
) {
  const attributes = [
    `${AUTH_SESSION_COOKIE}=${value}`,
    "HttpOnly",
    "SameSite=Lax",
    "Path=/",
    `Max-Age=${maxAgeSeconds}`,
  ];
  if (process.env.NODE_ENV === "production") attributes.push("Secure");
  response.setHeader("Set-Cookie", attributes.join("; "));
}

function setSessionCookie(
  response: { setHeader(name: string, value: string): void },
  token: string,
) {
  setCookie(response, token, 8 * 60 * 60);
}

@Injectable()
class SessionGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  async canActivate(context: ExecutionContext) {
    const isPublic = this.reflector.getAllAndOverride<boolean>(isPublicKey, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (isPublic) return true;

    const request = context
      .switchToHttp()
      .getRequest<{ headers: { cookie?: string }; auth?: unknown }>();
    const token = parseCookieHeader(request.headers.cookie)[
      AUTH_SESSION_COOKIE
    ];
    const session = await authStore.getSessionByToken(token);
    if (!session) {
      apiError(
        "UNAUTHENTICATED",
        "Login session is required.",
        HttpStatus.UNAUTHORIZED,
      );
    }

    request.auth = session.user;
    const requiredRoles =
      this.reflector.getAllAndOverride<string[]>(requiredRolesKey, [
        context.getHandler(),
        context.getClass(),
      ]) ?? [];
    if (
      requiredRoles.length &&
      !requiredRoles.some((role) => session.user.roles.includes(role))
    ) {
      apiError(
        "FORBIDDEN",
        "Your role cannot perform this action.",
        HttpStatus.FORBIDDEN,
      );
    }

    return true;
  }
}

function activeSendBlocked() {
  throw new HttpException(
    {
      code: ACTIVE_SEND_BLOCKED,
      message:
        "Active Send is blocked until exact hospital x counterparty route evidence and no-patient-data acknowledgement are present.",
      field: null,
      blocked_reason_codes: activeSendGuard().blocked_reason_codes,
      correlation_id: correlationId(),
    },
    HttpStatus.LOCKED,
  );
}

@Controller(api)
class HealthController {
  @Public()
  @Get("health")
  health(): HealthResponse {
    return healthResponseSchema.parse({
      ok: true,
      service: "api",
      phase: "phase-1-local",
    });
  }

  @Public()
  @Get("contract/routes")
  routes() {
    return ok({ base_path: api, canonical_routes: canonicalRoutes });
  }
}

@Controller(api)
class PhaseOneController {
  @Public()
  @Post("auth/login/start")
  async loginStart(@Body() body: { email?: string }) {
    const challenge = await authStore.startLogin(body.email);
    if (!challenge) {
      apiError(
        "UNAUTHENTICATED",
        "Only named invited users can start login.",
        HttpStatus.UNAUTHORIZED,
      );
    }

    return ok(challenge);
  }

  @Public()
  @Post("auth/login/verify")
  async loginVerify(
    @Body() body: { login_challenge_id?: string; otp?: string },
    @Res({ passthrough: true })
    response: { setHeader(name: string, value: string): void },
  ) {
    const session = await authStore.verifyLogin(
      body.login_challenge_id,
      body.otp,
    );
    if (!session) {
      apiError(
        "UNAUTHENTICATED",
        "Login code could not be verified.",
        HttpStatus.UNAUTHORIZED,
      );
    }

    setSessionCookie(response, session.token);
    return ok(
      { user: session.user, session_fresh_until: session.session_fresh_until },
      ["auth:login", "role:claim_officer", "branch:all"],
    );
  }

  @Post("auth/logout")
  async logout(
    @Req() request: { headers: { cookie?: string } },
    @Res({ passthrough: true })
    response: { setHeader(name: string, value: string): void },
  ) {
    await authStore.revokeSessionByToken(
      parseCookieHeader(request.headers.cookie)[AUTH_SESSION_COOKIE],
    );
    setCookie(response, "", 0);
    return ok({ session_status: "revoked", audit_action: "logout" }, [
      "auth:logout",
    ]);
  }

  @Public()
  @Get("invites/:invite_id")
  async invite(@Param("invite_id") inviteId: string) {
    const invite = await authStore.getInvite(inviteId);
    if (!invite) {
      apiError("NOT_FOUND", "Invite was not found.", HttpStatus.NOT_FOUND);
    }

    return ok(invite);
  }

  @Public()
  @Post("invites/:invite_id/accept")
  async acceptInvite(
    @Param("invite_id") inviteId: string,
    @Body() body: { name?: string; phone?: string | null; otp?: string },
    @Res({ passthrough: true })
    response: { setHeader(name: string, value: string): void },
  ) {
    const result = await authStore.acceptInvite(inviteId, body);
    if (result.status === "not_found") {
      apiError("NOT_FOUND", "Invite was not found.", HttpStatus.NOT_FOUND);
    }
    if (result.status === "validation_error") {
      apiError(
        "VALIDATION_ERROR",
        "Invite acceptance requires name and the synthetic OTP.",
        HttpStatus.BAD_REQUEST,
      );
    }
    if (result.status === "not_accepting") {
      apiError(
        "INVITE_NOT_ACCEPTING",
        "Invite is expired, revoked, or already accepted.",
        HttpStatus.CONFLICT,
      );
    }

    setSessionCookie(response, result.session.token);
    return ok(
      {
        invite_id: result.invite_id,
        invite_status: result.invite_status,
        user: result.session.user,
        session_fresh_until: result.session.session_fresh_until,
        audit_actions: result.audit_actions,
      },
      ["auth:invite_accept", "role:claim_officer", "branch:all"],
    );
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
        { key: "test_email", status: "sent" },
      ],
    });
  }

  @Get("hospital-profile")
  hospitalProfile() {
    return ok({
      tenant_id: syntheticIds.tenantId,
      hospital_id: syntheticIds.hospitalId,
      display_name: "Lotus Valley Test Hospital",
      insurance_desk_email_masked: "in***@example.test",
      redaction_level: "masked_default",
    });
  }

  @Get("counterparties/master")
  counterparties() {
    return ok({
      items: [
        {
          counterparty_id: "COUNTERPARTY-TEST-0001",
          counterparty_type: "tpa",
          display_name: "Example TPA Sandbox",
        },
        {
          counterparty_id: "COUNTERPARTY-TEST-0002",
          counterparty_type: "insurer",
          display_name: "Example Insurer Desk",
        },
        {
          counterparty_id: "COUNTERPARTY-TEST-0003",
          counterparty_type: "scheme_authority",
          display_name: "Example Scheme Authority",
        },
      ],
    });
  }

  @Get("hospital-counterparties/:hospital_counterparty_id/readiness")
  readiness(@Param("hospital_counterparty_id") id: string) {
    return ok({
      hospital_counterparty_id: id,
      guard: activeSendGuard(),
      active_for_submission: false,
    });
  }

  @Roles("hospital_admin")
  @Post("hospital-counterparties/:hospital_counterparty_id/activate-submission")
  activateSubmission() {
    activeSendBlocked();
  }

  @Get("mailboxes")
  mailboxes() {
    return ok({
      items: [
        {
          mailbox_connection_id: syntheticIds.mailboxConnectionId,
          connection_status: "connected",
          send_enabled: false,
          read_enabled: true,
        },
      ],
    });
  }

  @Roles("hospital_admin")
  @Post("test-emails/send")
  sendTestEmail() {
    return ok({
      email_event_id: syntheticIds.emailEventId,
      status: "sent",
      no_patient_data: true,
    });
  }

  @Roles("hospital_admin")
  @Post("test-emails/:email_event_id/mark-acknowledged")
  acknowledgeTestEmail(@Param("email_event_id") id: string) {
    return ok({
      email_event_id: id,
      status: "acknowledged",
      no_patient_data: true,
      acknowledged_at: nowIso(),
    });
  }

  @Get("claims/:claim_id")
  claimDetail(@Param("claim_id") id: string) {
    return ok({ ...claim, claim_id: id, active_send_guard: activeSendGuard() });
  }

  @Get("claims/:claim_id/packets/:packet_id/send-eligibility")
  sendEligibility() {
    return ok(activeSendGuard());
  }

  @Roles("claim_officer", "hospital_admin")
  @Post("claims/:claim_id/packets/:packet_id/send")
  sendPacket() {
    activeSendBlocked();
  }

  @Roles("claim_officer", "hospital_admin")
  @Post("claims/:claim_id/packets/:packet_id/retry-send")
  retrySend() {
    activeSendBlocked();
  }

  @Get("worklist")
  worklist() {
    return ok({
      items: [
        claim,
        {
          ...claim,
          claim_id: "CLM-TEST-0002",
          patient_display_name: "Test Patient Beta",
          current_status: "Doctor note pending",
          claim_value_inr: 84000,
        },
        {
          ...claim,
          claim_id: "CLM-TEST-0003",
          patient_display_name: "Test Patient Gamma",
          current_status: "Short payment review",
          claim_value_inr: 218000,
        },
      ],
    });
  }

  @Get("email-events/manual-match-queue")
  manualMatchQueue() {
    return ok({ items: [emailEvent] });
  }

  @Roles("claim_officer", "hospital_admin")
  @Post("email-events/:email_event_id/manual-match")
  manualMatch(@Param("email_event_id") id: string) {
    return ok({
      email_event_id: id,
      claim_id: syntheticIds.claimId,
      match_status: "manual_matched",
      audit_action: "match_email",
    });
  }

  @Roles("claim_officer", "hospital_admin")
  @Post("parser-runs/:parser_run_id/review")
  parserReview(@Param("parser_run_id") id: string) {
    return ok({
      parser_run_id: id,
      confidence: "low",
      requires_manual_review: true,
      low_confidence_guard: "no terminal settlement mutation",
    });
  }

  @Get("owner-summary")
  ownerSummary() {
    return ok({
      owner: claim.owner,
      open_claims: 14,
      outstanding_value_inr: 1840000,
      redaction_level: "aggregate_masked",
    });
  }

  @Get("finance-summary")
  financeSummary() {
    return ok({
      settlement_total_inr: 690000,
      short_payment_review_inr: 218000,
      payment_advice_status: "synthetic_redacted",
    });
  }

  @Post("exports")
  createExport() {
    return ok({
      export_id: syntheticIds.exportId,
      status: "ready",
      filename: "synthetic-finance-export.csv",
      expires_at: nowIso(),
    });
  }

  @Get("exports/:export_id/download")
  downloadExport(@Param("export_id") id: string) {
    return ok({
      export_id: id,
      filename: "synthetic-finance-export.csv",
      content_type: "text/csv",
      redaction_status: "redacted",
    });
  }
}

@Module({ controllers: [HealthController, PhaseOneController] })
class AppModule {}

export async function createApp() {
  const app = await NestFactory.create(AppModule, {
    logger: ["error", "warn", "log"],
  });
  app.useGlobalGuards(new SessionGuard(app.get(Reflector)));
  const corsOrigins = (
    process.env.CORS_ORIGINS ??
    "http://localhost:3000,http://127.0.0.1:3000,http://localhost:3020,http://127.0.0.1:3020"
  )
    .split(",")
    .map((origin) => origin.trim())
    .filter(Boolean);
  app.enableCors({ origin: corsOrigins, credentials: true });
  return app;
}

async function bootstrap() {
  const app = await createApp();
  const port = Number(process.env.PORT ?? 3001);
  await app.listen(port, "0.0.0.0");
}

if (
  process.argv[1] &&
  import.meta.url === pathToFileURL(process.argv[1]).href
) {
  void bootstrap();
}
