import { test, expect } from "@playwright/test";

/**
 * COA verification UX. Runs against `vite preview` with no Supabase env, so the
 * lookup resolves to "no match" — which is exactly the safety case we assert:
 * an unknown/invalid lot must fail gracefully, never error or imply a result.
 */

test("/test-results renders the public COA library without auth", async ({ page }) => {
  await page.goto("/test-results");
  await page.waitForLoadState("networkidle");
  expect(page.url()).not.toContain("/login");
  await expect(page.getByRole("heading", { name: /certificates of analysis/i })).toBeVisible();
});

test("lot verification handles an unknown lot gracefully", async ({ page }) => {
  await page.goto("/verify-lot?lot=DOES-NOT-EXIST-123");
  await page.waitForLoadState("networkidle");
  // Must not crash and must not falsely claim a certificate exists.
  const body = (await page.content()).toLowerCase();
  expect(body).toContain("no published certificate");
  expect(page.url()).not.toContain("/login");
});

test("verify-lot page exposes a lot search input", async ({ page }) => {
  await page.goto("/verify-lot");
  await page.waitForLoadState("networkidle");
  await expect(page.getByLabel(/lot number/i)).toBeVisible();
});
