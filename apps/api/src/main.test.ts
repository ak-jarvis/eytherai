import type { INestApplication } from "@nestjs/common";
import request from "supertest";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { ACTIVE_SEND_BLOCKED, syntheticIds } from "@eyther/contracts";
import { createApp } from "./main.js";

describe("Phase 1 local API contract", () => {
  let app: INestApplication;

  beforeAll(async () => {
    app = await createApp();
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

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

  it("hard-blocks Active Send until evidence guard passes", async () => {
    const response = await request(app.getHttpServer())
      .post(`/api/v1/claims/${syntheticIds.claimId}/packets/${syntheticIds.packetId}/send`)
      .expect(423);

    expect(response.body).toMatchObject({ code: ACTIVE_SEND_BLOCKED });
    expect(response.body.blocked_reason_codes).toContain("missing_test_email_acknowledgement");
  });

  it("returns masked worklist and manual match surfaces", async () => {
    const worklist = await request(app.getHttpServer()).get("/api/v1/worklist").expect(200);
    const queue = await request(app.getHttpServer()).get("/api/v1/email-events/manual-match-queue").expect(200);

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
