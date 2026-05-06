import { expect, test } from "@playwright/test";
import syntheticScenario from "../fixtures/synthetic/phase1-synthetic-scenarios.json" assert { type: "json" };
import {
  clickBySemanticTarget,
  expectAccessibilitySmoke,
  expectAnyVisible,
  expectButtonState,
  expectNoRealPii,
  expectResponsiveSmoke,
  gotoPhase1
} from "./helpers/phase1";

const apiURL = process.env.PLAYWRIGHT_API_URL ?? "http://localhost:3001/api/v1";

test.describe("Eyther Phase 1 synthetic local journey", () => {
  test("setup and readiness surfaces are healthy and synthetic-only", async ({ page, request }) => {
    const health = await request.get(`${apiURL}/health`);
    expect([200, 204], "API readiness endpoint should be available").toContain(health.status());

    await gotoPhase1(page, "/setup");
    await expectAnyVisible(page, [/setup/i, /readiness/i, /phase 1/i]);
    await expectAnyVisible(page, [/synthetic/i, /test data/i, /no patient/i]);
    await expectNoRealPii(page);
    await expectAccessibilitySmoke(page);
    await expectResponsiveSmoke(page);
  });

  test("test email acknowledgement stays no-PII before Active Send can be enabled", async ({ page }) => {
    await gotoPhase1(page, "/setup");
    await clickBySemanticTarget(page, { testIds: ["test-email-acknowledgement"], names: [/acknowledge test email/i] });
    await expectAnyVisible(page, [/acknowledged/i, /test email/i, /no patient data/i]);
    await expectNoRealPii(page);
  });

  test("worklist shows cashless claims and owner accountability", async ({ page }) => {
    await gotoPhase1(page, "/worklist");
    await expectAnyVisible(page, [/cashless/i, /claims worklist/i, /worklist/i]);
    await expectAnyVisible(page, [syntheticScenario.claim.claimId, syntheticScenario.claim.patientDisplayName]);
    await expectAnyVisible(page, [/owner/i, syntheticScenario.claim.owner]);
    await expectAnyVisible(page, [/TPA/i, /insurer/i, /scheme authority/i]);
    await expectNoRealPii(page);
    await expectResponsiveSmoke(page);
  });

  test("Active Send stays blocked after synthetic evidence capture", async ({ page }) => {
    await gotoPhase1(page, `/claims/${syntheticScenario.claim.claimId}`);
    await expectAnyVisible(page, [/Active Send/i, /evidence/i, /test email/i]);
    await expectButtonState(page, /Active Send/i, "disabled");
    await expectAnyVisible(page, [/blocked/i, /missing evidence/i, /acknowledgement required/i]);
    await clickBySemanticTarget(page, { testIds: ["attach-send-evidence"], names: [/attach evidence/i] });
    await clickBySemanticTarget(page, { testIds: ["confirm-no-patient-data"], names: [/no patient data/i] });
    await expectButtonState(page, /Active Send/i, "disabled");
    await expectAnyVisible(page, [/still blocked/i, /synthetic evidence/i, /live Send/i]);
    await expectNoRealPii(page);
  });

  test("manual email match links unmatched acknowledgement to the synthetic claim", async ({ page }) => {
    await gotoPhase1(page, "/mailbox/unmatched");
    await expectAnyVisible(page, [/unmatched/i, /manual match/i, /test email/i]);
    await expectAnyVisible(page, [syntheticScenario.email.subject]);
    await clickBySemanticTarget(page, { testIds: ["manual-match-email"], names: [/manual match/i] });
    await expectAnyVisible(page, [syntheticScenario.claim.claimId, /matched/i, /linked/i]);
    await expectNoRealPii(page);
  });

  test("owner summary exposes work distribution and ageing without PII", async ({ page }) => {
    await gotoPhase1(page, "/owners");
    await expectAnyVisible(page, [/owner summary/i, /owner/i, /ageing/i]);
    await expectAnyVisible(page, [syntheticScenario.claim.owner]);
    await expectAnyVisible(page, [/open/i, /pending/i, /TAT/i]);
    await expectNoRealPii(page);
  });

  test("finance export is available as a synthetic, redacted settlement file", async ({ page }) => {
    await gotoPhase1(page, "/finance/export");
    await expectAnyVisible(page, [/finance export/i, /settlement/i, /payment advice/i]);
    const downloadPromise = page.waitForEvent("download");
    await clickBySemanticTarget(page, { testIds: ["download-finance-export"], names: [/download/i, /export/i, /CSV/i] });
    const download = await downloadPromise;
    expect(download.suggestedFilename()).toMatch(/synthetic|test|redacted|finance|settlement/i);
    await expectNoRealPii(page);
  });

  test("audit trail records redaction and evidence decisions", async ({ page }) => {
    await gotoPhase1(page, `/claims/${syntheticScenario.claim.claimId}/audit`);
    await expectAnyVisible(page, [/audit/i, /redaction/i, /evidence/i]);
    await expectAnyVisible(page, [/Active Send/i, /manual match/i, /test email/i]);
    await expectAnyVisible(page, [/redacted/i, /no patient data/i, /synthetic/i]);
    await expectNoRealPii(page);
  });
});
