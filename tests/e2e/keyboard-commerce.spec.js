// tests/e2e/keyboard-commerce.spec.js   (opt cycle 4 — scorecard 4.9)
// The public commerce path is operable with the keyboard alone, up to the
// auth wall: /shop → a product card → the product page → Add to Cart → the
// cart drawer (focus moves in) → Escape (focus returns). Every stop must show
// a visible focus indicator (WCAG 2.1.1 keyboard, 2.4.3 focus order, 2.4.7
// focus visible). Runs against the static build like the other specs.
import { test, expect } from "@playwright/test";

const focusInfo = (page) =>
  page.evaluate(() => {
    const el = document.activeElement;
    if (!el || el === document.body) return { tag: "BODY" };
    const cs = getComputedStyle(el);
    const r = el.getBoundingClientRect();
    return {
      tag: el.tagName,
      text: (el.getAttribute("aria-label") || el.textContent || "").trim().slice(0, 60),
      href: el.getAttribute("href"),
      outline: cs.outlineStyle !== "none" && parseFloat(cs.outlineWidth) > 0,
      shadow: cs.boxShadow !== "none",
      visible: r.width > 0 && r.height > 0,
      inDialog: !!el.closest('[role="dialog"]'),
    };
  });

async function tabUntil(page, predicate, max = 60) {
  for (let i = 0; i < max; i++) {
    await page.keyboard.press("Tab");
    const info = await focusInfo(page);
    if (predicate(info)) return info;
  }
  return null;
}

test.describe("keyboard-only commerce path", () => {
  test.beforeEach(async ({ page }) => {
    await page.addInitScript(() => {
      window.localStorage.setItem("np_age_ack_v1", "1");
    });
  });

  test("shop → product → add to cart → drawer → escape, keyboard only, focus visible throughout", async ({ page }) => {
    await page.goto("/shop");
    await expect(page.locator('a[href^="/products/"]').first()).toBeVisible({ timeout: 15_000 });

    // 1. The first Tab is the skip link; keep tabbing to the first product card.
    await page.keyboard.press("Tab");
    expect((await focusInfo(page)).text).toMatch(/skip to content/i);
    const card = await tabUntil(page, (i) => i.tag === "A" && /^\/products\//.test(i.href || ""));
    expect(card, "a product card link is reachable by Tab").not.toBeNull();
    expect(card.outline || card.shadow, "product card shows a focus indicator").toBe(true);
    await page.keyboard.press("Enter");
    await expect(page).toHaveURL(/\/product\//, { timeout: 15_000 });

    // 2. Tab to Add to Cart on the product page.
    const addBtn = page.getByRole("button", { name: /add to cart/i }).first();
    await expect(addBtn).toBeVisible({ timeout: 15_000 });
    const add = await tabUntil(page, (i) => i.tag === "BUTTON" && /add to cart/i.test(i.text) && i.visible);
    expect(add, "Add to Cart is reachable by Tab").not.toBeNull();
    expect(add.outline || add.shadow, "Add to Cart shows a focus indicator").toBe(true);
    await page.keyboard.press("Enter");

    // 3. The drawer opens as a dialog and TAKES focus (the close control).
    const dialog = page.getByRole("dialog", { name: /cart/i });
    await expect(dialog).toBeVisible({ timeout: 10_000 });
    await expect.poll(async () => (await focusInfo(page)).inDialog, { timeout: 3_000 }).toBe(true);
    const inDrawer = await focusInfo(page);
    expect(inDrawer.text, "focus lands on the close control").toMatch(/close cart/i);
    expect(inDrawer.outline || inDrawer.shadow, "close control shows a focus indicator").toBe(true);

    // 3b. Data honesty: the drawer must not promise a specific processor —
    // rails are server-derived at checkout (BTCPay-first; card is test-only).
    await expect(dialog.getByText(/stripe|paypal|visa|mastercard/i)).toHaveCount(0);

    // 4. Tab stays within the drawer's controls (quantity, remove, checkout).
    const next = await tabUntil(page, (i) => i.inDialog && !/close cart/i.test(i.text), 3);
    expect(next, "the next Tab stop is inside the dialog").not.toBeNull();
    expect(next.outline || next.shadow, "drawer control shows a focus indicator").toBe(true);

    // 5. Escape closes it and focus RETURNS to what opened it.
    await page.keyboard.press("Escape");
    await expect(dialog).toBeHidden({ timeout: 5_000 });
    await expect.poll(async () => (await focusInfo(page)).text, { timeout: 3_000 }).toMatch(/add to cart/i);
  });
});
