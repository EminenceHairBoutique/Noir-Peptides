// tests/mobile/media-gallery.spec.js
// PDP swipe gallery (MOBILE_ROADMAP #9). The gallery exists only when the
// label API returns an approved label — its slides are renders of that label
// (3D vial + flat front + full wrap), never invented product photography —
// so these tests fulfill the API the same way the late-label CLS test does.
import { test, expect } from "@playwright/test";

const APPROVED_LABEL = {
  template_id: "noir-clinical-core", default_preset: "front",
  display_name: "BPC-157", quantity_label: "5 mg",
  material_type: "Research reference material", composition: null,
  sku: "BPC157-5", lot_number: "NP-2408-011", batch_number: "B-2408",
  packaged_date: "2026-06-02", expiration_date: "2028-06-02", retest_date: null,
  barcode_value: "NP2408011", verification_code: "k7f3qz",
  storage_short: null, storage_full: null, storage_source_verified: false,
  manufacturer: "Noir Peptides", distributed_by: "Noir Peptides",
  country_of_origin: "USA", net_contents: "1 vial", label_version: 3,
  product_id: "bpc-157", variant_id: "bpc-157-5mg",
};

async function seed(page) {
  await page.addInitScript(() => {
    try {
      localStorage.setItem("np_age_ack_v1", "1");
    } catch {
      /* ignore */
    }
  });
}

test.describe("PDP media gallery", () => {
  test.use({ viewport: { width: 390, height: 844 } });

  test("with an approved label: three slides, dots navigate, swipe tracks", async ({ page }) => {
    await seed(page);
    await page.route("**/api/product-label**", (route) =>
      route.fulfill({
        status: 200, contentType: "application/json",
        body: JSON.stringify({ label: APPROVED_LABEL }),
      })
    );
    await page.goto("/product/bpc-157", { waitUntil: "domcontentloaded" });
    const region = page.getByRole("region", { name: "Product media" });
    await expect(region).toBeVisible({ timeout: 15000 });
    await expect(region.getByRole("group")).toHaveCount(3);

    const dots = page.locator('button[aria-label^="Show slide"]');
    await expect(dots).toHaveCount(3);
    await expect(dots.nth(0)).toHaveAttribute("aria-current", "true");

    // Dot navigation
    await dots.nth(2).click();
    await expect(dots.nth(2)).toHaveAttribute("aria-current", "true", { timeout: 10000 });

    // Swipe (programmatic scroll) tracks the active dot back to slide 1
    await region.locator("div.snap-x").evaluate((el) => el.scrollTo({ left: 0, behavior: "instant" }));
    await expect(dots.nth(0)).toHaveAttribute("aria-current", "true", { timeout: 10000 });
  });

  test("without a label: no gallery chrome at all", async ({ page }) => {
    await seed(page);
    // Default sandbox behavior — the API 500s and vialLabel stays null.
    await page.goto("/product/bpc-157", { waitUntil: "domcontentloaded" });
    await page.waitForTimeout(2500);
    await expect(page.getByRole("region", { name: "Product media" })).toHaveCount(0);
    await expect(page.locator('button[aria-label^="Show slide"]')).toHaveCount(0);
  });
});
