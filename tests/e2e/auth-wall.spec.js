import { test, expect } from "@playwright/test";

/**
 * Auth-wall (UX layer) coverage.
 *
 * Runs against `vite preview` of the production build. With no Supabase env
 * configured in the preview, the client has no session, so every gated route
 * must resolve to the /login redirect (RequireAuth: guest -> /login). This is
 * the client wall; the real lock is Supabase RLS + the server gates exercised
 * in checkout-attestation-gate.spec.js.
 */

const GATED_ROUTES = [
  "/home",
  "/shop",
  "/shop/tissue-research",
  "/catalog",
  "/product/bpc-157-5mg",
  "/cart",
  "/checkout",
  "/account",
  "/quality",
  "/contact",
];

for (const route of GATED_ROUTES) {
  test(`gated route ${route} redirects an unauthenticated visitor to /login`, async ({
    page,
  }) => {
    await page.goto(route);
    await page.waitForURL(/\/login/, { timeout: 15_000 });
    expect(page.url()).toContain("/login");
  });
}

test("the attestation step requires a session (guest -> /login)", async ({
  page,
}) => {
  await page.goto("/register/attestation");
  await page.waitForURL(/\/login/, { timeout: 15_000 });
  expect(page.url()).toContain("/login");
});

test("logged-out catalog page exposes no product rows (wall conceals catalog)", async ({
  page,
}) => {
  // Even if the SPA briefly renders /shop before redirecting, no real product
  // data (sequences / batch numbers) is present — the catalog is fetched from
  // RLS-gated Supabase and is not bundled.
  await page.goto("/shop");
  const body = await page.content();
  expect(body).not.toContain("GEPPPGKPADDAGLV"); // BPC-157 sequence
  expect(body).not.toContain("NP-B157-0260"); // a batch number
});

test("public landing is reachable without auth", async ({ page }) => {
  await page.goto("/");
  // Should NOT bounce to /login.
  await page.waitForLoadState("networkidle");
  expect(page.url()).not.toContain("/login");
});
