import type { INestApplication } from "@nestjs/common";
import request from "supertest";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { ACTIVE_SEND_BLOCKED, AUTH_SESSION_COOKIE, syntheticIds } from "@eyther/contracts";
import { createApp } from "./main.js";

describe("Phase 1 local API contract", () => {
  let app: INestApplication;

  function headerCookies(value: string | string[] | undefined) {
    if (!value) return [];
    return Array.isArray(value) ? value : [value];
  }

  beforeAll(async () => {
    app = await createApp();
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  async function loginCookie() {
    const start = await request(app.getHttpServer()).post("/api/v1/auth/login/start").send({ email: "insurance.desk@example.test" }).expect(201);
    expect(start.body.data).toMatchObject({ login_challenge_id: "LOGIN-TEST-0001", delivery: "synthetic_email" });

    const verify = await request(app.getHttpServer())
      .post("/api/v1/auth/login/verify")
      .send({ login_challenge_id: start.body.data.login_challenge_id, otp: "000000" })
      .expect(201);
    const cookies = headerCookies(verify.headers["set-cookie"]);

    expect(Array.isArray(cookies)).toBe(true);
    expect(cookies.join("; ")).toContain(`${AUTH_SESSION_COOKIE}=`);
    expect(cookies.join("; ")).toContain("HttpOnly");
    expect(verify.body.data.user).toMatchObject({
      user_id: syntheticIds.userId,
      roles: ["hospital_admin", "claim_officer", "billing_finance"],
      branch_scope: { all_branches: true }
    });
    expect(verify.body.data.session_fresh_until).toEqual(expect.any(String));

    return cookies.map((cookie: string) => cookie.split(";")[0]).join("; ");
  }

  it("exposes unauthenticated health for local readiness", async () => {
    const response = await request(app.getHttpServer()).get("/api/v1/health").expect(200);
    expect(response.body).toMatchObject({ ok: true, service: "api", phase: "phase-1-local" });
  });

  it("keeps canonical route names from the technical contract", async () => {
    const response = await request(app.getHttpServer()).get("/api/v1/contract/routes").expect(200);
    const deprecatedRoute = "GET /api/" + "auth/gmail/callback";

    expect(response.body.data.canonical_routes).toContain("POST /setup/payer-mix/import");
    expect(response.body.data.canonical_routes).toContain("POST /claims/:claim_id/packets/:packet_id/send");
    expect(response.body.data.canonical_routes).not.toContain(deprecatedRoute);
  });

  it("accepts the synthetic invite and creates an HTTP-only session", async () => {
    const invite = await request(app.getHttpServer()).get(`/api/v1/invites/${syntheticIds.inviteId}`).expect(200);
    expect(invite.body.data).toMatchObject({
      invite_id: syntheticIds.inviteId,
      requested_roles: ["hospital_admin", "claim_officer", "billing_finance"],
      branch_scope: { all_branches: true }
    });

    const accepted = await request(app.getHttpServer())
      .post(`/api/v1/invites/${syntheticIds.inviteId}/accept`)
      .send({ name: "Insurance Desk Test Owner", phone: null, otp: "000000" })
      .expect(201);

    expect(headerCookies(accepted.headers["set-cookie"]).join("; ")).toContain("HttpOnly");
    expect(accepted.body.data).toMatchObject({
      invite_id: syntheticIds.inviteId,
      invite_status: "accepted",
      audit_actions: ["user_invite_accept", "login"]
    });
  });

  it("requires a session before returning operational worklist data", async () => {
    await request(app.getHttpServer()).get("/api/v1/worklist").expect(401);

    const cookie = await loginCookie();
    await request(app.getHttpServer()).get("/api/v1/worklist").set("Cookie", cookie).expect(200);
  });

  it("hard-blocks Active Send until evidence guard passes", async () => {
    const cookie = await loginCookie();
    const response = await request(app.getHttpServer())
      .post(`/api/v1/claims/${syntheticIds.claimId}/packets/${syntheticIds.packetId}/send`)
      .set("Cookie", cookie)
      .expect(423);

    expect(response.body).toMatchObject({ code: ACTIVE_SEND_BLOCKED });
    expect(response.body.blocked_reason_codes).toContain("missing_test_email_acknowledgement");
  });

  it("returns masked worklist and manual match surfaces", async () => {
    const cookie = await loginCookie();
    const worklist = await request(app.getHttpServer()).get("/api/v1/worklist").set("Cookie", cookie).expect(200);
    const queue = await request(app.getHttpServer()).get("/api/v1/email-events/manual-match-queue").set("Cookie", cookie).expect(200);

    expect(worklist.body.data.items[0]).toMatchObject({
      claim_id: syntheticIds.claimId,
      patient_display_name: "Test Patient Alpha",
      redaction_level: "masked_default"
    });
    expect(queue.body.data.items[0]).toMatchObject({
      email_event_id: syntheticIds.emailEventId,
      raw_access: "restricted"
    });
  });
});
