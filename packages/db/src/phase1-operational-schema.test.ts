import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const schema = readFileSync(
  new URL("../prisma/schema.prisma", import.meta.url),
  "utf8",
);
const migration = readFileSync(
  new URL(
    "../prisma/migrations/20260506205500_phase1_operational_persistence/migration.sql",
    import.meta.url,
  ),
  "utf8",
);

function modelBlock(name: string) {
  const match = schema.match(new RegExp(`model ${name} \\{([\\s\\S]*?)\\n\\}`));
  if (!match) throw new Error(`Missing model: ${name}`);
  return match[1];
}

describe("Phase 1 operational Prisma schema", () => {
  it("defines the required operational persistence models", () => {
    for (const name of [
      "OnboardingState",
      "SetupEvidenceArtifact",
      "AnonymizedPayerMixRow",
      "HospitalCounterpartyProfile",
      "RuleSet",
      "Claim",
      "ClaimApplicationPacket",
      "DocumentAttachment",
      "EmailEvent",
      "LifecycleStatusEvent",
      "ExportJob",
    ]) {
      expect(modelBlock(name)).toContain("tenantId");
      expect(modelBlock(name)).toContain("hospitalId");
    }
    expect(modelBlock("CounterpartyMaster")).toContain("publicCounterpartyId");
  });

  it("keeps Active Send evidence persisted but blocked by default", () => {
    const profile = modelBlock("HospitalCounterpartyProfile");
    const packet = modelBlock("ClaimApplicationPacket");

    expect(profile).toContain("activeForSubmission");
    expect(profile).toContain("@default(false)");
    expect(profile).toContain("blockedReasonCodes");
    expect(packet).toContain("sendBlockedReasonCodes");
  });

  it("keeps lifecycle append-only evidence separate from claim projection", () => {
    const claim = modelBlock("Claim");
    const lifecycle = modelBlock("LifecycleStatusEvent");

    expect(claim).toContain("currentStage");
    expect(claim).toContain("currentStatus");
    expect(lifecycle).toContain("fromStage");
    expect(lifecycle).toContain("toStage");
    expect(lifecycle).toContain("reasonNoteSanitized");
  });

  it("ships an applyable migration for operational tables and audit actions", () => {
    for (const table of [
      "OnboardingState",
      "SetupEvidenceArtifact",
      "AnonymizedPayerMixRow",
      "HospitalCounterpartyProfile",
      "Claim",
      "ClaimApplicationPacket",
      "DocumentAttachment",
      "EmailEvent",
      "LifecycleStatusEvent",
      "ExportJob",
    ]) {
      expect(migration).toContain(`CREATE TABLE "${table}"`);
    }
    for (const action of [
      "claim_create",
      "packet_create",
      "document_attach",
      "lifecycle_event_create",
      "manual_match",
      "export_create",
      "sensitive_reveal_requested",
    ]) {
      expect(migration).toContain(`'${action}'`);
    }
  });
});
