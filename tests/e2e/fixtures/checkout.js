// tests/e2e/fixtures/checkout.js   (opt cycle 9)
// The two things every gated-page sweep needs after installAuth(): a cart
// with one item, and step 1 of the checkout filled with the fixture
// researcher's details. Kept in one place so the axe sweep, the screenshot
// matrix and any future gated-page check fill the same form the same way.

/** Adds the first PDP's default variant to the cart. Returns false if the button isn't there. */
export async function seedCart(page, base, pdp = "/product/bpc-157") {
  await page.goto(base + pdp, { waitUntil: "networkidle" });
  const add = page.getByRole("button", { name: /add to cart/i }).first();
  if (!(await add.isVisible().catch(() => false))) return false;
  await add.click();
  await page.keyboard.press("Escape");
  return true;
}

/** Fills checkout step 1 (contact, ship-to, research intent, ship method, attestations). */
export async function fillCheckoutStep1(page) {
  await page.locator("#ct-first").waitFor({ timeout: 15000 });
  await page.fill("#ct-first", "Ada");
  await page.fill("#ct-last", "Lovelace");
  await page.fill("#ct-email", "researcher@e2e.test");
  await page.fill("#ship-line1", "12 Lab Row");
  await page.fill("#ship-city", "Austin");
  await page.selectOption("#ship-state", "TX");
  await page.fill("#ship-zip", "78701");
  await page.selectOption("#ri-entity", { index: 1 });
  await page.selectOption("#ri-protocol", { index: 1 });
  await page.locator('input[name="shipmethod"]').first().check();
  const boxes = page.locator('section[aria-labelledby="at-h"] input[type="checkbox"]');
  for (let i = 0; i < (await boxes.count()); i++) await boxes.nth(i).check();
}

/** Submits step 1 and waits for the payment step to render. */
export async function continueToPayment(page) {
  await page.getByRole("button", { name: /continue to payment/i }).click();
  await page.getByText(/BTCPay/i).first().waitFor({ timeout: 15000 });
}
