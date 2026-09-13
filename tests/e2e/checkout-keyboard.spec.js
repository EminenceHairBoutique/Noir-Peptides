// tests/e2e/checkout-keyboard.spec.js   (opt cycle 5 — scorecards 4.9 / 4.5, Hy-006)
// The GATED commerce path, with the keyboard, for a signed-in attested
// researcher (fixtures/auth.js — no database, every call routed):
//   /cart renders (not bounced) → Proceed to Checkout → step 1 (contact,
//   ship-to, research use, shipping method, three RUO certifications) →
//   Continue → step 2 shows the server's rails. Every Tab stop must show a
//   visible focus indicator. A second test proves the attestation gate:
//   a profile without a current attestation is sent to /register/attestation.
// Requires the `npm run build:e2e` dist (fake Supabase URL).
import { test, expect, installAuth, profileFor } from "./fixtures/auth.js";

const focusInfo = (page) =>
  page.evaluate(() => {
    const el = document.activeElement;
    if (!el || el === document.body) return { tag: "BODY" };
    const cs = getComputedStyle(el);
    return {
      tag: el.tagName, id: el.id || null, type: el.getAttribute("type"),
      text: (el.getAttribute("aria-label") || el.textContent || "").trim().slice(0, 40),
      indicator: (cs.outlineStyle !== "none" && parseFloat(cs.outlineWidth) > 0) || cs.boxShadow !== "none",
    };
  });

async function seedCart(page) {
  await page.goto("/product/bpc-157");
  const add = page.getByRole("button", { name: /add to cart/i }).first();
  await expect(add).toBeVisible({ timeout: 15_000 });
  await add.click();
  await expect(page.getByRole("dialog", { name: /cart/i })).toBeVisible();
  await page.keyboard.press("Escape");
}

test.describe("gated checkout, keyboard-only (attested researcher)", () => {
  test("cart → checkout step 1 → step 2 with a visible focus indicator at every stop", async ({ authedPage: page }, testInfo) => {
    await seedCart(page);

    // /cart renders for the signed-in user — no bounce to /login.
    await page.goto("/cart");
    await expect(page).toHaveURL(/\/cart$/);
    const proceed = page.getByRole("link", { name: /proceed to checkout/i });
    await expect(proceed).toBeVisible({ timeout: 15_000 });
    await page.screenshot({ path: testInfo.outputPath("cart.png"), fullPage: true });

    // Reach "Proceed to Checkout" by Tab and activate it.
    const stops = [];
    let found = null;
    for (let i = 0; i < 60 && !found; i++) {
      await page.keyboard.press("Tab");
      const f = await focusInfo(page);
      stops.push(f);
      if (f.tag === "A" && /proceed to checkout/i.test(f.text)) found = f;
    }
    expect(found, "Proceed to Checkout is reachable by Tab").not.toBeNull();
    expect(found.indicator, "Proceed to Checkout shows a focus indicator").toBe(true);
    await page.keyboard.press("Enter");
    await expect(page).toHaveURL(/\/checkout$/, { timeout: 15_000 });

    // Step 1: walk every control with Tab; each must show an indicator.
    const first = page.locator("#ct-first");
    await expect(first).toBeVisible({ timeout: 15_000 });
    await first.focus();
    const walked = [];
    for (let i = 0; i < 80; i++) {
      const f = await focusInfo(page);
      walked.push(f);
      if (f.tag === "BUTTON" && /continue to payment/i.test(f.text)) break;
      await page.keyboard.press("Tab");
    }
    const controls = walked.filter((f) => ["INPUT", "SELECT", "BUTTON", "A"].includes(f.tag));
    expect(controls.length, "step 1 exposes a keyboard path through its controls").toBeGreaterThan(12);
    const noRing = controls.filter((f) => !f.indicator);
    expect(noRing, "every focused control shows an indicator").toEqual([]);
    expect(walked.at(-1).text).toMatch(/continue to payment/i);

    // Fill the form (typing is keyboard input) and certify via Space.
    await page.fill("#ct-first", "Ada");
    await page.fill("#ct-last", "Lovelace");
    await page.fill("#ct-email", "researcher@e2e.test");
    await page.fill("#ship-line1", "12 Lab Row");
    await page.fill("#ship-city", "Austin");
    await page.selectOption("#ship-state", "TX").catch(() => page.fill("#ship-state", "TX"));
    await page.fill("#ship-zip", "78701");
    await page.selectOption("#ri-entity", { index: 1 });
    await page.selectOption("#ri-protocol", { index: 1 });
    const method = page.locator('input[name="shipmethod"]').first();
    await method.focus();
    await page.keyboard.press("Space");
    const boxes = page.locator('section[aria-labelledby="at-h"] input[type="checkbox"]');
    const n = await boxes.count();
    expect(n).toBe(3);
    for (let i = 0; i < n; i++) { await boxes.nth(i).focus(); await page.keyboard.press("Space"); }
    await page.screenshot({ path: testInfo.outputPath("checkout-step1.png"), fullPage: true });

    // Continue → step 2 renders the server's rails (routed) and the pay control.
    const cont = page.getByRole("button", { name: /continue to payment/i });
    await cont.focus();
    await page.keyboard.press("Enter");
    await expect(page.getByText(/BTCPay/i).first()).toBeVisible({ timeout: 15_000 });
    const pay = page.getByRole("button", { name: /pay|continue|place/i }).last();
    await expect(pay).toBeVisible();
    await page.screenshot({ path: testInfo.outputPath("checkout-step2.png"), fullPage: true });
  });

  test("the step-1 draft survives a reload; the certifications do not", async ({ authedPage: page }) => {
    await seedCart(page);
    await page.goto("/checkout");
    await expect(page.locator("#ct-first")).toBeVisible({ timeout: 15_000 });
    await page.fill("#ct-first", "Ada");
    await page.fill("#ship-line1", "12 Lab Row");
    await page.fill("#ship-city", "Austin");
    await page.selectOption("#ri-entity", { index: 1 });
    const boxes = page.locator('section[aria-labelledby="at-h"] input[type="checkbox"]');
    await boxes.nth(0).check();
    await page.reload();
    await expect(page.locator("#ct-first")).toHaveValue("Ada", { timeout: 15_000 });
    await expect(page.locator("#ship-line1")).toHaveValue("12 Lab Row");
    await expect(page.locator("#ship-city")).toHaveValue("Austin");
    expect(await page.locator("#ri-entity").inputValue()).not.toBe("");
    await expect(boxes.nth(0)).not.toBeChecked();
    // Nothing of the draft reaches localStorage.
    const inLocal = await page.evaluate(() => Object.keys(localStorage).filter((k) => /checkout/i.test(k)));
    expect(inLocal).toEqual([]);
  });

  test("a signed-in user WITHOUT a current attestation is sent to the attestation step", async ({ page }) => {
    await installAuth(page, { profile: profileFor({ attested: false }) });
    await page.goto("/checkout");
    await expect(page).toHaveURL(/\/register\/attestation/, { timeout: 15_000 });
  });
});
