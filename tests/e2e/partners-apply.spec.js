// tests/e2e/partners-apply.spec.js   (opt cycle 12 — scorecard 4.14 / 4.9)
// The wholesale request form: a stored application moves focus to the
// confirmation heading; a failed store shows an alert, never "received".
import { test, expect } from "@playwright/test";

const fill = async (page) => {
  await page.goto("/partners");
  await page.fill("#pt-name", "Ada Example");
  await page.fill("#pt-email", "ada@lab.example");
  await page.fill("#pt-business", "Example Institute");
  await page.fill("#pt-country", "United States");
  await page.selectOption("#pt-volume", { index: 1 });
  await page.fill("#pt-interest", "BPC-157");
};

test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => {
    window.localStorage.setItem("np_age_ack_v1", "1");
    window.localStorage.setItem("np_cookie_consent", JSON.stringify({ necessary: true, analytics: false, marketing: false, timestamp: Date.now() }));
  });
});

test("a stored application focuses the confirmation heading", async ({ page }) => {
  let posted = null;
  await page.route("**/api/partners/apply", async (route) => {
    posted = route.request().postDataJSON();
    await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ ok: true }) });
  });
  await fill(page);
  await page.getByRole("button", { name: /submit application/i }).click();
  const heading = page.getByRole("heading", { name: /application received/i });
  await expect(heading).toBeVisible();
  await expect(heading).toBeFocused();
  expect(posted?.payload?.email).toBe("ada@lab.example");
  expect(posted?.payload?.website).toBe("");
});

test("a failed store shows an alert and keeps the form", async ({ page }) => {
  await page.route("**/api/partners/apply", (route) =>
    route.fulfill({ status: 502, contentType: "application/json", body: JSON.stringify({ error: "Could not save the application. Please try again." }) }));
  await fill(page);
  await page.getByRole("button", { name: /submit application/i }).click();
  await expect(page.getByRole("alert")).toContainText(/went wrong/i);
  await expect(page.getByRole("heading", { name: /application received/i })).toHaveCount(0);
  await expect(page.locator("#pt-name")).toHaveValue("Ada Example");
});
