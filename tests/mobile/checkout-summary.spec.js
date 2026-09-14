// tests/mobile/checkout-summary.spec.js   (opt cycle 12 — scorecard 4.9 / 4.10)
// At phone width the checkout summary sits below the whole form; the strip at
// the top jumps to it. The jump must MOVE FOCUS into the summary (a keyboard or
// screen-reader user is otherwise left on the link), and the summary must be
// a focusable target. Requires the E2E build (installAuth fixture).
import { test, expect } from "@playwright/test";
import { installAuth } from "../e2e/fixtures/auth.js";
import { seedCart } from "../e2e/fixtures/checkout.js";

test("View summary moves focus into the order summary at 390 px", async ({ page, baseURL }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.addInitScript(() => {
    window.localStorage.setItem("np_cookie_consent", JSON.stringify({ necessary: true, analytics: false, marketing: false, timestamp: Date.now() }));
  });
  await installAuth(page);
  const seeded = await seedCart(page, baseURL || "");
  test.skip(!seeded, "dist is not the E2E build");
  await page.goto("/checkout");
  await expect(page.locator("#ct-first")).toBeVisible({ timeout: 15_000 });
  const link = page.getByRole("link", { name: /view summary/i });
  await expect(link).toBeVisible();
  await link.focus();
  await page.keyboard.press("Enter");
  await expect(page.locator("#order-summary")).toBeFocused();
  const box = await page.locator("#order-summary").boundingBox();
  expect(box.y, "the summary card is scrolled into the viewport").toBeLessThan(844);
});
