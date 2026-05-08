import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const schema = readFileSync(
  new URL("../prisma/schema.prisma", import.meta.url),
  "utf8",
);
const migration = readFileSync(
  new URL(
    "../prisma/migrations/20260506192500_auth_persistence_schema/migration.sql",
    import.meta.url,
  ),
  "utf8",
);

function model(name: string) {
  const match = schema.match(new RegExp(`model ${name} \\{([\\s\\S]*?)\\n\\}`));
  if (!match) throw new Error(`Missing Prisma model ${name}`);
  return match[1];
}

describe("Phase 1 auth Prisma schema", () => {
  it("defines the required named-user auth and invite models", () => {
    for (const name of [
      "Tenant",
      "Hospital",
      "HospitalUser",
      "RoleLookup",
      "HospitalUserRoleAssignment",
      "HospitalUserBranchScope",
      "HospitalUserInvite",
      "AuthLoginChallenge",
      "AuthSession",
      "AuditLog",
    ]) {
      expect(() => model(name)).not.toThrow();
    }
  });

  it("stores only hashed session and challenge secrets", () => {
    expect(model("AuthSession")).toMatch(/sessionTokenHash\s+String\s+@unique/);
    expect(model("AuthLoginChallenge")).toContain("otpHash");
    expect(model("AuthSession")).not.toContain("sessionToken String");
    expect(model("AuthLoginChallenge")).not.toContain("otp String");
  });

  it("keeps roles and branch scope as join tables", () => {
    expect(model("HospitalUserRoleAssignment")).toContain("roleKey");
    expect(model("HospitalUserBranchScope")).toContain("allBranches");
    expect(model("HospitalUser")).not.toMatch(/\n\s*role\s+/);
  });

  it("supports auth audit actions required by the reviewer gate", () => {
    for (const action of [
      "login",
      "failed_login",
      "logout",
      "user_invite_accept",
      "user_invite_revoke",
      "forbidden_access",
    ]) {
      expect(schema).toContain(action);
    }
  });

  it("ships an applyable Postgres migration for the auth tables", () => {
    for (const table of [
      "Tenant",
      "Hospital",
      "HospitalUser",
      "HospitalUserInvite",
      "AuthLoginChallenge",
      "AuthSession",
      "AuditLog",
    ]) {
      expect(migration).toContain(`CREATE TABLE "${table}"`);
    }
    expect(migration).toContain(
      'CREATE UNIQUE INDEX "AuthSession_sessionTokenHash_key"',
    );
    expect(migration).toContain(
      'CREATE UNIQUE INDEX "HospitalUser_tenantId_loginIdentifierEmail_key"',
    );
  });
});
