/*
  scripts/test-bytes-budget.mjs   (opt c8 — scorecard 4.7, "Bytes & requests")
  The deterministic half of the cost/perf generator: what a first visit
  downloads per route, unthrottled, against fixed budgets — transfer KB and
  request count on a cold cache, plus the heavy-vendor rule (no 3D / PDF /
  QR chunk on a public first paint). Timing is deliberately not asserted
  here (see PLAYBOOK, cost/perf lane). Needs Chromium and a server:
  E2E job step `npm run test:bytes` after the accessibility sweep.

  Usage: node scripts/test-bytes-budget.mjs [baseUrl]
*/
import { chromium } from "@playwright/test";
import fs from "node:fs";
const base = process.argv[2] || "http://localhost:4180";
const exe = process.env.PLAYWRIGHT_CHROMIUM_PATH || "/opt/pw-browsers/chromium-1194/chrome-linux/chrome";
let failures = 0;
const ok = (cond, msg) => {
  if (cond) console.log(`  ✓ ${msg}`);
  else { failures++; console.error(`  ✗ ${msg}`); }
};
// Budgets are ceilings with ~20 % headroom over the E2E build (Sept 13):
// / 306 KB · /shop 324 · PDP 336 · /test-results 315 · /faqs 307; 20–43
// requests. The E2E build carries the Supabase client and makes the same
// runtime data calls production does (the CI production build has no env,
// folds the client to null and reads ~45 KB lighter — that is not the
// number a buyer sees). Raise only with a reason in OPTIMIZATION_LOG.md.
const BUDGET = {
  // +1 request per route since opt cycle 11: /boot.js, the paint-first loader.
  "/": { kb: 372, requests: 31 },
  "/shop": { kb: 392, requests: 43 },
  "/product/bpc-157": { kb: 412, requests: 57 },
  "/test-results": { kb: 382, requests: 35 },
  "/faqs": { kb: 372, requests: 31 },
};
const HEAVY = /vendor-three|vendor-pdf|jsQR|LabelPreview-|\bbrowser-/;
const browser = await chromium.launch({ executablePath: fs.existsSync(exe) ? exe : undefined });
for (const [route, b] of Object.entries(BUDGET)) {
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true });
  const page = await ctx.newPage();
  await page.route("**/sw.js", (r) => r.fulfill({ status: 404, body: "" })); // the worker's precache is its own budget
  const reqs = [];
  page.on("request", (r) => reqs.push(r.url()));
  await page.goto(base + route, { waitUntil: "networkidle" });
  await page.waitForTimeout(500);
  const kb = await page.evaluate(() => Math.round((performance.getEntriesByType("resource").reduce((a, r) => a + (r.transferSize || 0), 0) + (performance.getEntriesByType("navigation")[0]?.transferSize || 0)) / 1024));
  const n = reqs.length;
  const heavy = reqs.filter((u) => HEAVY.test(u)).map((u) => u.split("/").pop());
  ok(kb <= b.kb, `${route}: ${kb} KB transferred ≤ ${b.kb} KB`);
  ok(n <= b.requests, `${route}: ${n} requests ≤ ${b.requests}`);
  ok(heavy.length === 0, `${route}: no heavy lazy chunk on first visit (${heavy.join(", ") || "none"})`);
  await ctx.close();
}
await browser.close();
console.log(failures ? `\n${failures} assertion(s) failed` : "\nAll bytes-budget assertions passed");
process.exit(failures ? 1 : 0);
