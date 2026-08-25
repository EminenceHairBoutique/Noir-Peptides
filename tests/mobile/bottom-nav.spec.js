// tests/mobile/bottom-nav.spec.js
// Bottom navigation (MOBILE_ROADMAP #8): thumb-reach tabs on phones, absent
// exactly where it must be (desktop, PDP — the sticky buy bar owns that
// edge, and bare auth/checkout chrome).
import { test, expect } from "@playwright/test";

const NAV = 'nav[aria-label="Primary"]';

async function seed(page) {
  await page.addInitScript(() => {
    try {
      localStorage.setItem("np_age_ack_v1", "1");
      localStorage.setItem(
        "np_cookie_consent",
        JSON.stringify({ necessary: true, analytics: false, marketing: false, timestamp: 1 })
      );
      localStorage.setItem(
        "np_cart",
        JSON.stringify([
          { id: "bpc-157", name: "BPC-157", variantId: "bpc-157-5mg", sku: "BPC157-5", price: 44, quantity: 2, cartKey: "v:bpc-157-5mg" },
        ])
      );
    } catch {
      /* ignore */
    }
  });
}

test.describe("bottom navigation", () => {
  test.use({ viewport: { width: 390, height: 844 } });

  test.beforeEach(async ({ page }) => {
    await seed(page);
  });

  test("shows 4 thumb-size tabs on the catalog, cart badge included", async ({ page }) => {
    await page.goto("/shop", { waitUntil: "domcontentloaded" });
    const nav = page.locator(NAV);
    await expect(nav).toBeVisible();
    const tabs = nav.locator("a, button");
    await expect(tabs).toHaveCount(4);
    for (let i = 0; i < 4; i++) {
      const box = await tabs.nth(i).boundingBox();
      expect(box.height, `tab ${i} tap height`).toBeGreaterThanOrEqual(44);
    }
    await expect(nav.getByRole("button", { name: /cart \(2\)/i })).toBeVisible();
    // Bar sits at the bottom edge
    const navBox = await nav.boundingBox();
    expect(navBox.y + navBox.height).toBeGreaterThanOrEqual(843);
  });

  test("cart tab opens the drawer", async ({ page }) => {
    await page.goto("/shop", { waitUntil: "domcontentloaded" });
    const cartTab = page.locator(NAV).getByRole("button", { name: /cart/i });
    await expect(cartTab).toHaveAttribute("aria-expanded", "false");
    await cartTab.click();
    await expect(cartTab).toHaveAttribute("aria-expanded", "true");
  });

  test("absent on the PDP (sticky buy bar owns the bottom) and on auth pages", async ({ page }) => {
    await page.goto("/product/bpc-157", { waitUntil: "domcontentloaded" });
    await expect(page.locator(NAV)).toHaveCount(0);
    await page.goto("/login", { waitUntil: "domcontentloaded" });
    await expect(page.locator(NAV)).toHaveCount(0);
  });

  test("hidden at desktop widths", async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 900 });
    await page.goto("/shop", { waitUntil: "domcontentloaded" });
    await expect(page.locator(NAV)).toBeHidden();
  });

  test("footer is fully reachable above the bar", async ({ page }) => {
    await page.goto("/shop", { waitUntil: "domcontentloaded" });
    // behavior:"instant" — the site sets smooth scrolling, and measuring
    // mid-animation reads the footer still below the bar.
    await page.evaluate(() =>
      window.scrollTo({ top: document.body.scrollHeight, behavior: "instant" })
    );
    await page.waitForTimeout(400);
    const footer = page.locator("footer");
    const fb = await footer.boundingBox();
    const nb = await page.locator(NAV).boundingBox();
    // Footer bottom must sit at (sub-pixel/border tolerance) or above the
    // nav top once fully scrolled — measured real gap is 0-1px by design.
    expect(fb.y + fb.height).toBeLessThanOrEqual(nb.y + 2);
  });
});
