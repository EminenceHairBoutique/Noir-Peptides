/*
  scripts/test-qr-roundtrip.mjs   (opt c7 — scorecard 4.4)
  The trust claim "scan the label, land on the lot" traced end to end:
  render the full-wrap label through the real engine, rasterize it in
  Chromium, decode the QR with jsQR from the pixels, hand the payload to
  the scanner's real parser, and expect the verification code — for every
  template. Needs Chromium (runs in the E2E job: npm run test:qr).
*/
import { chromium } from "@playwright/test";
import { PNG } from "pngjs";
import jsQR from "jsqr";
import fs from "node:fs";
import { renderLabelSvg, TEMPLATES } from "../src/lib/labels/renderLabelSvg.js";
import { parseScannedCode } from "../src/lib/qrScanParse.js";

let failures = 0;
const ok = (cond, msg) => {
  if (cond) console.log(`  ✓ ${msg}`);
  else { failures++; console.error(`  ✗ ${msg}`); }
};
const exe = process.env.PLAYWRIGHT_CHROMIUM_PATH || "/opt/pw-browsers/chromium-1194/chrome-linux/chrome";
const CODE = "A1B2C3D4E5F6G";
const config = {
  display_name: "BPC-157", quantity_label: "5 mg", material_type: "Lyophilized Research Material", sku: "BPC157-5",
  product_id: "bpc-157", lot_number: "NP-BPC157-2607-001", expiration_date: "2028-07-01", barcode_value: "BPC157-5",
  verification_code: CODE, storage_source_verified: true, storage_short: "Store 2–8 °C. Protect from light.",
};
const browser = await chromium.launch({ executablePath: fs.existsSync(exe) ? exe : undefined });
const page = await browser.newPage({ viewport: { width: 1400, height: 700 }, deviceScaleFactor: 2 });
console.log(`QR round trip — ${Object.keys(TEMPLATES).length} templates, full-wrap preset:`);
for (const templateId of Object.keys(TEMPLATES)) {
  const svg = await renderLabelSvg(config, { templateId, presetId: "full_wrap", forceProcedural: true });
  await page.setContent(`<!doctype html><body style="margin:0;background:#fff">${svg}</body>`);
  const el = page.locator("svg").first();
  const png = PNG.sync.read(await el.screenshot({ type: "png" }));
  const qr = jsQR(new Uint8ClampedArray(png.data.buffer, png.data.byteOffset, png.data.length), png.width, png.height);
  ok(qr && qr.data, `${templateId}: a QR decodes from the rendered pixels (${qr ? qr.data.slice(0, 60) : "none"})`);
  const parsed = qr ? parseScannedCode(qr.data) : null;
  ok(parsed === CODE, `${templateId}: the scanner's parser yields the verification code (${JSON.stringify(parsed)})`);
}
await browser.close();
console.log(failures ? `\n${failures} assertion(s) failed` : "\nAll QR round-trip assertions passed");
process.exit(failures ? 1 : 0);
