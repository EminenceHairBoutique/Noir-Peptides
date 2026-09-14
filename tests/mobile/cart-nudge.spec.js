// tests/mobile/cart-nudge.spec.js   (opt cycle 12 — scorecard 4.10 / 4.9)
// Runs only against a build made with VITE_FEATURE_CART_RECOVERY=1 (the CI
// flag-on lane); against the default build it skips — the flag stays off in
// every documented environment. Asserts the nudge clears the bottom nav,
// its controls are 44 px, dismissing it lands focus on <main>, and it waits
// for the consent sheet to be answered.
import { test, expect } from "@playwright/test";

test("saved-cart nudge clears the bottom nav, has 44 px controls, and hands focus to main on dismiss", async ({ page, request, baseURL }) => {
  const meta = await (await request.get(`${baseURL}/prerender-meta.json`)).json().catch(() => ({}));
  test.skip(!meta?.features?.cartRecovery, "build has VITE_FEATURE_CART_RECOVERY off");
  await page.setViewportSize({ width: 390, height: 844 });
  await page.addInitScript(() => {
    window.localStorage.setItem("np_age_ack_v1", "1");
    window.localStorage.setItem("np_cart", JSON.stringify([{ id: "bpc-157", cartKey: "bpc-157:5", name: "BPC-157", price: 44, quantity: 2, variantId: "v", sku: "NP-BPC-5" }]));
  });
  // Consent not answered yet → no nudge.
  await page.goto("/shop", { waitUntil: "networkidle" });
  await expect(page.getByTestId("cart-recovery-nudge")).toHaveCount(0);
  await page.getByRole("button", { name: /essential only/i }).click();
  const nudge = page.getByTestId("cart-recovery-nudge");
  await expect(nudge).toBeVisible();
  await expect(nudge).toHaveAttribute("role", "region");
  const nb = await nudge.boundingBox();
  const navB = await page.locator('nav[aria-label="Primary"]').boundingBox();
  expect(nb.y + nb.height, "nudge sits above the bottom nav").toBeLessThanOrEqual(navB.y + 1);
  for (const ctl of [page.getByRole("link", { name: /return to cart/i }), page.getByRole("button", { name: /dismiss saved-cart notice/i })]) {
    const b = await ctl.boundingBox();
    expect(b.height, "44 px control").toBeGreaterThanOrEqual(43.5);
    expect(b.width, "44 px control").toBeGreaterThanOrEqual(43.5);
  }
  await page.getByRole("button", { name: /dismiss saved-cart notice/i }).focus();
  await page.keyboard.press("Enter");
  await expect(nudge).toHaveCount(0);
  const active = await page.evaluate(() => document.activeElement?.id || document.activeElement?.tagName);
  expect(active).toBe("main");
});
