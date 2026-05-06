import { z } from "zod";

export const API_BASE_PATH = "/api/v1";
export const ACTIVE_SEND_BLOCKED = "ACTIVE_SEND_BLOCKED";
export const activeSendBlockedCode = ACTIVE_SEND_BLOCKED;
export const AUTH_SESSION_COOKIE = "eyther_session";

export const syntheticIds = {
  tenantId: "TENANT-TEST-0001",
  hospitalId: "HOSP-TEST-0001",
  inviteId: "INVITE-TEST-0001",
  userId: "USER-TEST-0001",
  hospitalCounterpartyId: "HCP-TEST-0001",
  mailboxConnectionId: "MAILBOX-TEST-0001",
  emailEventId: "EMAIL-TEST-0001",
  parserRunId: "PARSER-TEST-0001",
  claimId: "CLM-TEST-0001",
  packetId: "PACKET-TEST-0001",
  documentId: "DOC-TEST-0001",
  exportId: "EXPORT-TEST-0001",
} as const;

export const healthResponseSchema = z.object({
  ok: z.literal(true),
  service: z.enum(["api", "worker"]),
  phase: z.enum(["gov-01-scaffold", "phase-1-local"]),
});

export const sendEligibilitySchema = z.object({
  allowed: z.boolean(),
  blocked_reason_codes: z.array(z.string()),
  required_evidence: z.array(z.string()),
  safe_next_action: z.string(),
});

export type HealthResponse = z.infer<typeof healthResponseSchema>;
export type SendEligibility = z.infer<typeof sendEligibilitySchema>;

export const canonicalRoutes = [
  "POST /auth/login/start",
  "POST /auth/login/verify",
  "GET /invites/:invite_id",
  "POST /invites/:invite_id/accept",
  "POST /admin/tenants",
  "GET /setup/onboarding-state",
  "PATCH /setup/onboarding-state",
  "POST /hospital-users/invites",
  "POST /hospital-users/invites/:invite_id/revoke",
  "POST /hospital-users/:user_id/deactivate",
  "POST /hospital-users/:user_id/reactivate",
  "PATCH /hospital-users/:user_id/roles",
  "PATCH /hospital-users/:user_id/branch-scope",
  "POST /support-access-grants",
  "GET /hospital-profile",
  "PATCH /hospital-profile",
  "POST /setup/evidence-artifacts",
  "POST /setup/payer-mix/import",
  "GET /counterparties/master",
  "POST /hospital-counterparties",
  "PATCH /hospital-counterparties/:hospital_counterparty_id",
  "POST /hospital-counterparties/:hospital_counterparty_id/rule-sets",
  "GET /hospital-counterparties/:hospital_counterparty_id/readiness",
  "POST /hospital-counterparties/:hospital_counterparty_id/activate-submission",
  "POST /mailboxes/gmail/oauth/start",
  "GET /mailboxes/gmail/oauth/callback",
  "GET /mailboxes",
  "GET /mailboxes/:mailbox_connection_id",
  "POST /mailboxes/imap-smtp",
  "POST /mailboxes/:mailbox_connection_id/reconnect",
  "POST /mailboxes/:mailbox_connection_id/revoke",
  "GET /mailboxes/:mailbox_connection_id/health",
  "POST /mailboxes/:mailbox_connection_id/sync-now",
  "POST /mailboxes/:mailbox_connection_id/imap-smtp/test",
  "POST /test-emails/send",
  "POST /test-emails/:email_event_id/mark-acknowledged",
  "POST /test-emails/:email_event_id/mark-failed",
  "POST /claims",
  "GET /claims/:claim_id",
  "PATCH /claims/:claim_id",
  "POST /claims/:claim_id/packets",
  "POST /claims/:claim_id/packets/:packet_id/documents",
  "POST /documents/:document_id/replace",
  "GET /claims/:claim_id/packets/:packet_id/send-eligibility",
  "POST /claims/:claim_id/packets/:packet_id/send",
  "POST /claims/:claim_id/packets/:packet_id/retry-send",
  "GET /claims/:claim_id/packets/:packet_id/download-manual-route",
  "POST /mailbox-sync/run",
  "GET /email-events/manual-match-queue",
  "GET /email-events/:email_event_id/match-candidates",
  "POST /email-events/:email_event_id/manual-match",
  "POST /email-events/:email_event_id/ignore",
  "POST /email-events/:email_event_id/quarantine-release",
  "POST /parser-runs/:parser_run_id/review",
  "POST /claims/:claim_id/lifecycle-events",
  "GET /worklist",
  "GET /owner-summary",
  "GET /finance-summary",
  "POST /exports",
  "GET /exports/:export_id/download",
  "POST /email-events/:email_event_id/reveal-raw",
  "POST /documents/:document_id/reveal",
] as const;
