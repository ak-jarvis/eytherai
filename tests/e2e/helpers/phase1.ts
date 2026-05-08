import { expect, type Locator, type Page } from "@playwright/test";

const bannedPiiPatterns = [
  { name: "Indian mobile number", regex: /\b(?:\+91[- ]?)?[6-9]\d{9}\b/ },
  { name: "Aadhaar-like number", regex: /\b\d{4}[- ]?\d{4}[- ]?\d{4}\b/ },
  { name: "PAN-like id", regex: /\b[A-Z]{5}\d{4}[A-Z]\b/ },
  { name: "raw UHID", regex: /\bUHID[-_ ]?(?!TEST\b)[A-Z0-9-]{4,}\b/i },
  { name: "raw policy id", regex: /\bPOLICY[-_ ]?(?!TEST\b)\d{6,}\b/i }
];

export async function gotoPhase1(page: Page, path = "/") {
  await page.goto(path);
  await expect(page.locator("body")).toBeVisible();
}

export async function expectNoRealPii(pageOrLocator: Page | Locator) {
  const text = await pageOrLocator.locator("body").textContent().catch(async () => pageOrLocator.textContent());

  for (const pattern of bannedPiiPatterns) {
    expect(text ?? "", `page content must not contain ${pattern.name}`).not.toMatch(pattern.regex);
  }
}

export async function expectAnyVisible(page: Page, candidates: Array<string | RegExp>) {
  for (const candidate of candidates) {
    const locator = page.getByText(candidate, { exact: false }).first();
    if ((await locator.count()) > 0 && (await locator.isVisible().catch(() => false))) {
      await expect(locator).toBeVisible();
      return locator;
    }
  }

  throw new Error(`None of these labels were visible: ${candidates.map(String).join(", ")}`);
}

export async function clickBySemanticTarget(page: Page, options: { testIds?: string[]; names: Array<string | RegExp> }) {
  for (const testId of options.testIds ?? []) {
    const locator = page.getByTestId(testId).first();
    if ((await locator.count()) > 0 && (await locator.isVisible().catch(() => false))) {
      await locator.click();
      return;
    }
  }

  for (const name of options.names) {
    const locator = page.getByRole("button", { name }).first();
    if ((await locator.count()) > 0 && (await locator.isVisible().catch(() => false))) {
      await locator.click();
      return;
    }
  }

  throw new Error(`No clickable target found for: ${options.names.map(String).join(", ")}`);
}

export async function expectButtonState(page: Page, name: string | RegExp, state: "enabled" | "disabled") {
  const button = page.getByRole("button", { name }).first();
  await expect(button).toBeVisible();
  if (state === "enabled") await expect(button).toBeEnabled();
  else await expect(button).toBeDisabled();
}

export async function expectResponsiveSmoke(page: Page) {
  const hasHorizontalOverflow = await page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth + 1);
  expect(hasHorizontalOverflow, "page should not horizontally overflow the viewport").toBe(false);
}

export async function expectAccessibilitySmoke(page: Page) {
  await expect(page.locator("h1").first()).toBeVisible();
}
