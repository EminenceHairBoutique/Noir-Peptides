// tests/e2e/checkout-rewards.spec.js   (opt cycle 11 — scorecard 4.14 / 4.5)
// The routed checkout offers the points select ONLY from the server-hydrated
// balance and posts `redeemPoints` / `discountCode` as hints; it never posts a
// dollar amount. With no balance, no select is offered at all. Requires the
// `npm run build:e2e` dist.
import { test, expect, installAuth, profileFor } from "./fixtures/auth.js";
import { seedCart, fillCheckoutStep1, continueToPayment } from "./fixtures/checkout.js";

test("a 350-point balance offers 100/200/300 and the pay request carries the hints only", async ({ page }) => {
  await installAuth(page, { profile: profileFor({ points: 350 }) });
  let posted = null;
  await page.route("**/api/btcpay/create-invoice", async (route) => {
    posted = route.request().postDataJSON();
    await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ url: "/success?e2e=1" }) });
  });
  await seedCart(page, "");
  await page.goto("/checkout");
  await fillCheckoutStep1(page);
  await continueToPayment(page);

  const select = page.locator("#redeem");
  await expect(select).toBeVisible();
  const values = await select.locator("option").evaluateAll((o) => o.map((x) => x.value));
  expect(values).toEqual(["0", "100", "200", "300"]);
  await expect(select.locator("option").nth(1)).toHaveText(/100 pts — \$5 off/);

  await select.selectOption("200");
  await expect(page.getByTestId("rewards-estimate")).toContainText("200 pts");
  await page.fill("#promo", "welcome10");
  await expect(page.locator("#promo")).toHaveValue("WELCOME10");
  await page.fill("#referral", "np-abcde");
  await expect(page.locator("#referral")).toHaveValue("NP-ABCDE");

  await page.getByRole("button", { name: /complete payment/i }).click();
  await expect.poll(() => posted, { timeout: 15_000 }).not.toBeNull();
  expect(posted.redeemPoints).toBe(200);
  expect(posted.discountCode).toBe("WELCOME10");
  expect(posted.referralCode).toBe("NP-ABCDE");
  for (const k of ["loyaltyDollars", "couponDollars", "discountAmount", "promoAmount", "total", "subtotal"]) {
    expect(posted, `no client dollar field ${k}`).not.toHaveProperty(k);
  }
  for (const item of posted.items) expect(item, "no client price on a line").not.toHaveProperty("price");
});

test("with no balance there is no points select, and an empty promo posts nothing", async ({ page }) => {
  await installAuth(page, { profile: profileFor({ points: 40 }) });
  let posted = null;
  await page.route("**/api/btcpay/create-invoice", async (route) => {
    posted = route.request().postDataJSON();
    await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ url: "/success?e2e=1" }) });
  });
  await seedCart(page, "");
  await page.goto("/checkout");
  await fillCheckoutStep1(page);
  await continueToPayment(page);
  await expect(page.locator("#redeem")).toHaveCount(0);
  await expect(page.locator("#promo")).toBeVisible();
  await page.getByRole("button", { name: /complete payment/i }).click();
  await expect.poll(() => posted, { timeout: 15_000 }).not.toBeNull();
  expect(posted).not.toHaveProperty("redeemPoints");
  expect(posted).not.toHaveProperty("discountCode");
  expect(posted).not.toHaveProperty("referralCode");
});

test("a failed rail request is announced through the payment step's live region", async ({ page }) => {
  await installAuth(page, { profile: profileFor({ points: 0 }) });
  await page.route("**/api/btcpay/create-invoice", (route) =>
    route.fulfill({ status: 500, contentType: "application/json", body: JSON.stringify({ error: "Payment could not be started. Please try again." }) }));
  await seedCart(page, "");
  await page.goto("/checkout");
  await fillCheckoutStep1(page);
  await continueToPayment(page);
  await page.getByRole("button", { name: /complete payment/i }).click();
  await expect(page.getByRole("alert")).toContainText(/could not be started/i);
});
