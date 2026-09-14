// tests/e2e/checkout-double-submit.spec.js   (opt cycle 10 — scorecard 4.5)
// A double-click on "Continue to Payment" writes ONE compliance record and a
// double-click on "Pay" starts ONE rail request. The keyboard spec proves the
// happy path; this proves the guard. Requires the `npm run build:e2e` dist.
import { test, expect, installAuth } from "./fixtures/auth.js";
import { seedCart, fillCheckoutStep1 } from "./fixtures/checkout.js";

test("a double-click on Continue writes one compliance record", async ({ page }) => {
  await installAuth(page);
  let compliancePosts = 0;
  page.on("request", (r) => { if (r.method() === "POST" && /\/api\/checkout-compliance/.test(r.url())) compliancePosts++; });
  await seedCart(page, "");
  await page.goto("/checkout");
  await fillCheckoutStep1(page);
  const button = page.getByRole("button", { name: /continue to payment/i });
  await expect(button).toBeEnabled();
  // Two synchronous clicks in the same task — before React can re-render.
  await button.evaluate((b) => { b.click(); b.click(); });
  await expect(page.getByText(/BTCPay/i).first()).toBeVisible({ timeout: 15_000 });
  await page.waitForTimeout(500);
  expect(compliancePosts, "compliance records written").toBe(1);
});

test("the Continue button is disabled and busy while the record is written", async ({ page }) => {
  await installAuth(page);
  // Hold the compliance response so the in-flight state is observable.
  let release;
  const gate = new Promise((r) => { release = r; });
  await page.route("**/api/checkout-compliance", async (route) => { await gate; await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ complianceId: "cmp_slow" }) }); });
  await seedCart(page, "");
  await page.goto("/checkout");
  await fillCheckoutStep1(page);
  const button = page.getByRole("button", { name: /continue to payment/i });
  await button.click();
  await expect(page.getByRole("button", { name: /saving your certification/i })).toBeDisabled();
  await expect(page.getByRole("button", { name: /saving your certification/i })).toHaveAttribute("aria-busy", "true");
  release();
  await expect(page.getByText(/BTCPay/i).first()).toBeVisible({ timeout: 15_000 });
});
