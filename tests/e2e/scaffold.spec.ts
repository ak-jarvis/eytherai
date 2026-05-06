import { expect, test } from '@playwright/test';

test('GOV-01 landing page labels synthetic-only scope', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByText('GOV-01 scaffold')).toBeVisible();
  await expect(page.getByText(/synthetic data only/i)).toBeVisible();
});
