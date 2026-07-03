import { test, expect } from "@playwright/test";

/**
 * Auth-wall (UX layer) coverage — PUBLIC-CATALOG model.
 *
 * The catalog is intentionally public + indexable (migration 0013): browsing is
 * open; only identity/commerce is gated. So:
 *   - GATED routes (cart, checkout, account, admin, authed console) must bounce a
 *     logged-out visitor to /login.
 *   - PUBLIC routes (shop, product, test-results, informational) must NOT bounce.
 *
 * The real lock is Supabase RLS + the server attestation gate exercised in
 * checkout-attestation-gate.spec.js; this only covers the client redirect UX.
 */

const GATED_ROUTES = ["/home", "/cart", "/checkout", "/account", "/admin"];

for (const route of GATED_ROUTES) {
  test(`gated route ${route} redirects an unauthenticated visitor to /login`, async ({ page }) => {
    await page.goto(route);
    await page.waitForURL(/\/login/, { timeout: 15_000 });
    expect(page.url()).toContain("/login");
  });
}

test("the attestation step requires a session (guest -> /login)", async ({ page }) => {
  await page.goto("/register/attestation");
  await page.waitForURL(/\/login/, { timeout: 15_000 });
  expect(page.url()).toContain("/login");
});

const PUBLIC_ROUTES = ["/shop", "/shop/tissue-repair-research", "/product/bpc-157", "/test-results", "/verify-lot", "/quality", "/contact"];

for (const route of PUBLIC_ROUTES) {
  test(`public route ${route} is reachable without auth`, async ({ page }) => {
    await page.goto(route);
    await page.waitForLoadState("networkidle");
    expect(page.url()).not.toContain("/login");
  });
}

test("public landing is reachable without auth", async ({ page }) => {
  await page.goto("/");
  await page.waitForLoadState("networkidle");
  expect(page.url()).not.toContain("/login");
});
