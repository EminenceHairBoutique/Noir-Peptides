// tests/mobile/pwa.spec.js
// PWA shell (MOBILE_ROADMAP #7): installability surface + the offline
// promise. Runs against the built preview (vite preview serves dist, where
// generate-sw-precache.mjs has injected the asset list; localhost is a
// secure context so the worker registers).
import { test, expect } from "@playwright/test";

test.describe("PWA shell", () => {
  test.use({ viewport: { width: 390, height: 844 } });

  test.beforeEach(async ({ page }) => {
    await page.addInitScript(() => {
      try {
        localStorage.setItem("np_age_ack_v1", "1");
      } catch {
        /* ignore */
      }
    });
  });

  test("manifest is installable: PNG icons resolve, standalone display", async ({ page, request }) => {
    await page.goto("/", { waitUntil: "domcontentloaded" });
    const href = await page.locator('link[rel="manifest"]').getAttribute("href");
    expect(href).toBeTruthy();
    const manifest = await (await request.get(href)).json();
    expect(manifest.display).toBe("standalone");
    const sizes = manifest.icons.filter((i) => i.type === "image/png").map((i) => i.sizes);
    expect(sizes).toEqual(expect.arrayContaining(["192x192", "512x512"]));
    expect(manifest.icons.some((i) => i.purpose === "maskable")).toBe(true);
    for (const icon of manifest.icons) {
      const res = await request.get(icon.src);
      expect(res.status(), `${icon.src} fetches`).toBe(200);
    }
  });

  test("service worker registers and precaches the shell", async ({ page }) => {
    await page.goto("/", { waitUntil: "domcontentloaded" });
    const state = await page.evaluate(async () => {
      const reg = await navigator.serviceWorker.ready;
      return { active: !!reg.active, scope: reg.scope };
    });
    expect(state.active).toBe(true);
    // Wait for the install-time precache to land (shell + manifest at least).
    await page.waitForFunction(
      async () => {
        const hit = await caches.match("/index.html");
        return !!hit;
      },
      { timeout: 20000 }
    );
  });

  test("offline: catalog still renders from the cached shell", async ({ page, context }) => {
    // Prime: register the worker and let precache finish.
    await page.goto("/", { waitUntil: "domcontentloaded" });
    await page.evaluate(() => navigator.serviceWorker.ready);
    await page.waitForFunction(async () => !!(await caches.match("/index.html")), {
      timeout: 20000,
    });

    await context.setOffline(true);
    try {
      await page.goto("/shop", { waitUntil: "domcontentloaded" });
      // The shell must come from cache and the catalog from bundled data.
      await expect(page.getByRole("heading", { name: /research catalog/i })).toBeVisible({
        timeout: 15000,
      });
      const cards = page.locator('a[href^="/product"]');
      await expect(cards.first()).toBeVisible({ timeout: 15000 });
      expect(await cards.count()).toBeGreaterThan(3);
    } finally {
      await context.setOffline(false);
    }
  });
});
