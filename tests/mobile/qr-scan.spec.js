// tests/mobile/qr-scan.spec.js
// End-to-end for the QR-scan entry to lot verification (MOBILE_ROADMAP #6).
// Headless has no real camera, so this drives the photo-capture fallback —
// which shares the exact decode pipeline (jsQR over canvas) with the live
// path. The fixture QR is generated with the same `qrcode` package the label
// engine uses, encoding the URL shape renderLabelSvg prints on vials.
import { test, expect } from "@playwright/test";
import { mkdtemp, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import QRCode from "qrcode";

const CODE = "7Q3M0R8VNPXKD"; // valid Crockford base32, 13 chars

async function qrPng(text) {
  const dir = await mkdtemp(join(tmpdir(), "np-qr-"));
  const file = join(dir, "label-qr.png");
  await writeFile(file, await QRCode.toBuffer(text, { width: 480, margin: 4 }));
  return file;
}

test.describe("QR scan → lot verification", () => {
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

  test("scanning a vial QR navigates to /v/<code>", async ({ page }) => {
    const png = await qrPng(`https://www.noirpeptides.com/v/${CODE}`);
    await page.goto("/verify-lot", { waitUntil: "domcontentloaded" });
    await page.getByRole("button", { name: /scan vial qr/i }).click();
    // Camera is unavailable headless → the sheet lands in the photo fallback.
    await expect(page.getByTestId("qr-file-input")).toBeAttached();
    await page.getByTestId("qr-file-input").setInputFiles(png);
    await expect(page).toHaveURL(new RegExp(`/v/${CODE}$`), { timeout: 15000 });
    await expect(page.getByRole("heading", { name: /batch verification/i })).toBeVisible();
  });

  test("a foreign QR is rejected and scanning UI stays up", async ({ page }) => {
    const png = await qrPng("WIFI:T:WPA;S:home;P:pw;;");
    await page.goto("/verify-lot", { waitUntil: "domcontentloaded" });
    await page.getByRole("button", { name: /scan vial qr/i }).click();
    await page.getByTestId("qr-file-input").setInputFiles(png);
    await expect(
      page.getByText(/not a noir peptides verification code/i)
    ).toBeVisible({ timeout: 15000 });
    await expect(page).toHaveURL(/\/verify-lot$/);
  });

  test("scanner sheet is an accessible dialog and restores focus", async ({ page }) => {
    await page.goto("/verify-lot", { waitUntil: "domcontentloaded" });
    const opener = page.getByRole("button", { name: /scan vial qr/i });
    await opener.click();
    const dialog = page.getByRole("dialog", { name: /scan vial qr/i });
    await expect(dialog).toBeVisible();
    await expect(dialog).toHaveAttribute("aria-modal", "true");
    await page.keyboard.press("Escape");
    await expect(dialog).not.toBeVisible();
    await expect(opener).toBeFocused();
  });
});
