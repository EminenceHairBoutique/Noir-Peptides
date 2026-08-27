// tests/mobile/haptics.spec.js
// Haptic confirmations (MOBILE_ROADMAP #10). navigator.vibrate is stubbed
// and counted — headless has no vibration motor, but the guard logic and the
// call sites are fully exercisable. Reduced-motion users must get none.
import { test, expect } from "@playwright/test";

async function seed(page) {
  await page.addInitScript(() => {
    try {
      localStorage.setItem("np_age_ack_v1", "1");
      localStorage.setItem(
        "np_cookie_consent",
        JSON.stringify({ necessary: true, analytics: false, marketing: false, timestamp: 1 })
      );
    } catch {
      /* ignore */
    }
    window.__vibrations = [];
    Object.defineProperty(navigator, "vibrate", {
      configurable: true,
      value: (pattern) => {
        window.__vibrations.push(pattern);
        return true;
      },
    });
  });
}

test.describe("haptics", () => {
  test.use({ viewport: { width: 390, height: 844 } });

  test("add to cart pulses once", async ({ page }) => {
    await seed(page);
    await page.goto("/product/bpc-157", { waitUntil: "domcontentloaded" });
    await page.getByRole("button", { name: /add to cart/i }).first().click();
    await expect
      .poll(async () => page.evaluate(() => window.__vibrations.length))
      .toBeGreaterThan(0);
    const first = await page.evaluate(() => window.__vibrations[0]);
    expect(first).toBe(15);
  });

  test("reduced motion suppresses the pulse", async ({ page }) => {
    await seed(page);
    await page.emulateMedia({ reducedMotion: "reduce" });
    await page.goto("/product/bpc-157", { waitUntil: "domcontentloaded" });
    await page.getByRole("button", { name: /add to cart/i }).first().click();
    // The add still works (drawer state flips)…
    await page.waitForTimeout(800);
    // …but no vibration was requested.
    expect(await page.evaluate(() => window.__vibrations.length)).toBe(0);
  });

  test("verified lot pulses the double tick", async ({ page }) => {
    await seed(page);
    await page.route("**/api/verify**", (route) =>
      route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ state: "verified", display_name: "BPC-157", lot_number: "NP-2408-011" }),
      })
    );
    await page.goto("/v/7Q3M0R8VNPXKD", { waitUntil: "domcontentloaded" });
    await expect(page.getByText(/verified — authentic/i)).toBeVisible({ timeout: 15000 });
    await expect
      .poll(async () => page.evaluate(() => window.__vibrations.length))
      .toBeGreaterThan(0);
    const first = await page.evaluate(() => window.__vibrations[0]);
    expect(first).toEqual([15, 60, 15]);
  });

  test("a not_found result stays silent", async ({ page }) => {
    await seed(page);
    await page.route("**/api/verify**", (route) =>
      route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ state: "not_found" }),
      })
    );
    await page.goto("/v/7Q3M0R8VNPXKD", { waitUntil: "domcontentloaded" });
    await expect(page.getByText(/code not found/i)).toBeVisible({ timeout: 15000 });
    await page.waitForTimeout(500);
    expect(await page.evaluate(() => window.__vibrations.length)).toBe(0);
  });
});
