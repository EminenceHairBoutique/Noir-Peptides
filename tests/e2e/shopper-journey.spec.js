import { test, expect } from "@playwright/test";

/**
 * Customer purchase-journey coverage (Phase 6). Runs against the static
 * `vite preview` harness: the catalog renders from the bundled static fallback
 * when Supabase env is absent, and the cart is client-local (np_cart), so the
 * whole pre-payment funnel is exercisable with no backend. Payment itself is
 * server-gated and covered by checkout-attestation-gate.spec.js.
 */

test.describe("browse → product → cart journey", () => {
  // Pre-acknowledge the 21+ age gate so it doesn't intercept clicks; the gate
  // itself (render + dismiss) is asserted in its own test below.
  test.beforeEach(async ({ page }) => {
    await page.addInitScript(() => {
      window.localStorage.setItem("np_age_ack_v1", "1");
    });
  });

  test("age gate blocks first visit until acknowledged", async ({ page }) => {
    await page.addInitScript(() => window.localStorage.removeItem("np_age_ack_v1"));
    await page.goto("/shop");
    const enter = page.getByRole("button", { name: /21 or older — enter/i });
    await expect(enter).toBeVisible({ timeout: 15_000 });
    await enter.click();
    await expect(enter).toBeHidden();
  });
  test("shop grid renders products and navigates to a product page", async ({ page }) => {
    await page.goto("/shop");
    const cards = page.locator('a[href^="/products/"]');
    await expect(cards.first()).toBeVisible({ timeout: 15_000 });
    expect(await cards.count()).toBeGreaterThan(5);

    await page.goto("/product/bpc-157");
    await expect(page.getByRole("button", { name: /add to cart/i })).toBeVisible({ timeout: 15_000 });
    // RUO compliance copy must be on every PDP.
    await expect(page.locator("body")).toContainText(/research use only/i);
  });

  test("add to cart opens the drawer and the cart persists across reload", async ({ page }) => {
    await page.goto("/product/bpc-157");
    const addBtn = page.getByRole("button", { name: /add to cart/i });
    await addBtn.click();

    // Drawer opens with the line item.
    await expect(page.getByRole("button", { name: "Close cart" })).toBeVisible({ timeout: 10_000 });
    await expect(page.locator("body")).toContainText(/BPC-157/i);

    // localStorage-backed cart survives a full reload.
    const stored = await page.evaluate(() => window.localStorage.getItem("np_cart"));
    expect(stored).toBeTruthy();
    expect(JSON.parse(stored).length).toBeGreaterThan(0);

    await page.reload();
    const after = await page.evaluate(() => window.localStorage.getItem("np_cart"));
    expect(JSON.parse(after).length).toBeGreaterThan(0);
  });

  test("shop search narrows the grid", async ({ page }) => {
    await page.goto("/shop");
    const cards = page.locator('a[href^="/products/"]');
    await expect(cards.first()).toBeVisible({ timeout: 15_000 });
    const before = await cards.count();

    const search = page.getByPlaceholder(/search/i).first();
    await search.fill("bpc");
    // Grid re-filters client-side.
    await expect
      .poll(async () => cards.count(), { timeout: 10_000 })
      .toBeLessThan(before);
    await expect(page.locator('a[href="/products/bpc-157"]').first()).toBeVisible();
  });

  test("bad product URL shows 404 and recovers to the catalog", async ({ page }) => {
    await page.goto("/product/does-not-exist-xyz");
    await expect(page.locator("body")).toContainText(/not found/i, { timeout: 15_000 });

    // Recovery path back into the funnel.
    await page.goto("/shop");
    await expect(page.locator('a[href^="/products/"]').first()).toBeVisible({ timeout: 15_000 });
  });

  test("recently-viewed strip appears after visiting a second product", async ({ page }) => {
    await page.goto("/product/bpc-157");
    await expect(page.getByRole("button", { name: /add to cart/i })).toBeVisible({ timeout: 15_000 });

    await page.goto("/product/tb-500");
    await expect(page.getByRole("button", { name: /add to cart/i })).toBeVisible({ timeout: 15_000 });
    await expect(page.getByRole("heading", { name: /recently viewed/i })).toBeVisible({ timeout: 10_000 });
    // The strip links back to the previously viewed product (self excluded).
    await expect(page.locator('section:has(h2:text-matches("recently viewed", "i")) a[href="/products/bpc-157"]').first()).toBeVisible();
  });
});
