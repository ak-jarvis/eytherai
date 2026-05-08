import { describe, expect, it } from "vitest";
import { syntheticIds } from "@eyther/contracts";
import {
  createAuthStoreFromEnv,
  createInMemoryAuthStore,
  hashSessionToken,
  syntheticEmail,
  syntheticLoginChallengeId,
} from "./auth-store.js";

describe("Phase 1 auth store", () => {
  it("keeps synthetic auth behind named invited users", async () => {
    const store = createInMemoryAuthStore();

    await expect(store.startLogin("unknown@example.test")).resolves.toBeNull();
    const challenge = await store.startLogin(syntheticEmail);

    expect(challenge).toMatchObject({
      login_challenge_id: syntheticLoginChallengeId,
      delivery: "synthetic_email",
    });
  });

  it("issues, reads, and revokes HTTP-only-session-compatible tokens", async () => {
    const store = createInMemoryAuthStore();
    const session = await store.verifyLogin(
      syntheticLoginChallengeId,
      "000000",
    );

    expect(session?.token).toEqual(expect.any(String));
    expect(hashSessionToken(session?.token ?? "")).toMatch(/^[a-f0-9]{64}$/);
    expect(hashSessionToken(session?.token ?? "")).not.toEqual(session?.token);

    const active = await store.getSessionByToken(session?.token);
    expect(active?.user).toMatchObject({
      user_id: syntheticIds.userId,
      roles: ["hospital_admin", "claim_officer", "billing_finance"],
      branch_scope: { all_branches: true },
    });

    await expect(store.revokeSessionByToken(session?.token)).resolves.toBe(
      true,
    );
    await expect(store.getSessionByToken(session?.token)).resolves.toBeNull();
  });

  it("accepts only the synthetic invite plus OTP and returns audit evidence", async () => {
    const store = createInMemoryAuthStore();

    await expect(
      store.acceptInvite("missing", {
        name: "Insurance Desk Test Owner",
        otp: "000000",
      }),
    ).resolves.toEqual({ status: "not_found" });
    await expect(
      store.acceptInvite(syntheticIds.inviteId, {
        name: "Insurance Desk Test Owner",
        otp: "111111",
      }),
    ).resolves.toEqual({ status: "validation_error" });

    const accepted = await store.acceptInvite(syntheticIds.inviteId, {
      name: "Insurance Desk Test Owner",
      phone: null,
      otp: "000000",
    });
    expect(accepted).toMatchObject({
      status: "accepted",
      invite_id: syntheticIds.inviteId,
      audit_actions: ["user_invite_accept", "login"],
    });

    await expect(store.getInvite(syntheticIds.inviteId)).resolves.toMatchObject(
      { invite_status: "accepted" },
    );
  });

  it("keeps Prisma auth explicit so local verifier does not silently require unavailable Postgres", () => {
    expect(
      createAuthStoreFromEnv({
        EYTHER_AUTH_STORE: "memory",
      } as NodeJS.ProcessEnv),
    ).toBeDefined();
    expect(() =>
      createAuthStoreFromEnv({
        EYTHER_AUTH_STORE: "prisma",
      } as NodeJS.ProcessEnv),
    ).toThrow(/DATABASE_URL/);
  });
});
