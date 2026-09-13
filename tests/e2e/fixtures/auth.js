// tests/e2e/fixtures/auth.js   (opt cycle 5 — Hy-006)
// An authenticated, attested researcher for E2E — without a database.
// Works against the `npm run build:e2e` dist, whose Supabase client points
// at https://e2e.supabase.co. supabase-js reads its session from
// localStorage (key sb-<project-ref>-auth-token → "sb-e2e-auth-token") and
// asks PostgREST for the profile; both are routed here. Every other call to
// the fake host fails with 503 so the app takes its static fallbacks.
// Server endpoints the checkout needs are routed too. No production code
// carries a test seam.
import { test as base, expect } from "@playwright/test";

export const E2E_USER = {
  id: "00000000-0000-4000-8000-00000000e2e1",
  email: "researcher@e2e.test",
  name: "E2E Researcher",
};

// An unsigned JWT-shaped token: supabase-js only decodes `exp`, never verifies.
function fakeJwt({ sub, email, exp }) {
  const b64 = (o) => Buffer.from(JSON.stringify(o)).toString("base64url");
  return `${b64({ alg: "none", typ: "JWT" })}.${b64({ sub, email, exp, role: "authenticated", aud: "authenticated" })}.e2e`;
}

export function sessionFor(user = E2E_USER) {
  const exp = Math.floor(Date.now() / 1000) + 60 * 60;
  return {
    access_token: fakeJwt({ sub: user.id, email: user.email, exp }),
    token_type: "bearer",
    expires_in: 3600,
    expires_at: exp,
    refresh_token: "e2e-refresh",
    user: {
      id: user.id, aud: "authenticated", role: "authenticated", email: user.email,
      app_metadata: { provider: "email" }, user_metadata: { name: user.name },
      created_at: "2026-09-01T00:00:00Z",
    },
  };
}

/** Profile row the app reads through PostgREST. `attested: false` → stale/absent attestation. */
export function profileFor({ attested = true, version = "v1.0" } = {}) {
  return {
    account_tier: "customer", partner_status: "none", partner_tier: null, role: "customer",
    attestation_completed_at: attested ? "2026-09-01T00:00:00Z" : null,
    attestation_version: attested ? version : null,
  };
}

export async function installAuth(page, { profile = profileFor(), rails = defaultRails() } = {}) {
  const session = sessionFor();
  await page.addInitScript(({ session }) => {
    window.localStorage.setItem("np_age_ack_v1", "1");
    window.localStorage.setItem("sb-e2e-auth-token", JSON.stringify(session));
  }, { session });
  // Playwright matches routes LAST-registered first: the catch-all goes in
  // first so the specific auth / profile handlers below take precedence.
  await page.route("https://e2e.supabase.co/**", (route) =>
    route.fulfill({ status: 503, contentType: "application/json", body: JSON.stringify({ message: "e2e: not mocked" }) }));
  await page.route("https://e2e.supabase.co/auth/v1/**", async (route) => {
    const url = route.request().url();
    if (/\/user(\?|$)/.test(url)) return route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(session.user) });
    if (/\/token/.test(url)) return route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(session) });
    return route.fulfill({ status: 200, contentType: "application/json", body: "{}" });
  });
  await page.route("https://e2e.supabase.co/rest/v1/profiles**", (route) =>
    route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(profile) }));
  await page.route("**/api/payment-rails", (route) =>
    route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ rails, degraded: false, unavailable: rails.length === 0 }) }));
  await page.route("**/api/checkout-compliance", (route) =>
    route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ complianceId: 4242 }) }));
  return session;
}

export function defaultRails() {
  return [{ id: "crypto", label: "Bitcoin / Lightning (BTCPay)", note: "Pay with crypto — 5% off", endpoint: "/api/btcpay/create-invoice", primary: true }];
}

export const test = base.extend({
  // A page that is signed in as an attested researcher.
  authedPage: async ({ page }, use) => {
    await installAuth(page);
    await use(page);
  },
});
export { expect };
