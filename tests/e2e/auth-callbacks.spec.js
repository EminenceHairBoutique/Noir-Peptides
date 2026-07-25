import { test, expect } from "@playwright/test";

/**
 * Auth callback landing routes (password reset + email confirmation).
 * The static preview harness has no Supabase env, so a token-less visit must
 * resolve to the explicit invalid-link state — the contract under test is
 * "never a blank screen, always a recovery action".
 */

test("/reset-password without a token shows the invalid-link state, not a blank page", async ({ page }) => {
  await page.goto("/reset-password");
  await expect(page.locator("body")).toContainText(/reset link/i, { timeout: 15_000 });
  // Recovery affordance present.
  await expect(page.locator('a[href="/forgot-password"], a[href="/login"]').first()).toBeVisible();
});

test("/auth/confirm without a token shows the invalid-link state with a resend action", async ({ page }) => {
  await page.goto("/auth/confirm");
  await expect(page.locator("body")).toContainText(/confirmation link/i, { timeout: 15_000 });
  await expect(page.locator('a[href="/login"]').first()).toBeVisible();
});

test("/forgot-password renders the request form", async ({ page }) => {
  await page.goto("/forgot-password");
  await expect(page.getByRole("button", { name: /send reset link/i })).toBeVisible({ timeout: 15_000 });
});
