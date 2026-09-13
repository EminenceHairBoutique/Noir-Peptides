/*
  scripts/test-sw-budget.mjs   (opt cycle 2 — scorecard 4.7)
  The service-worker precache is downloaded by every first-time visitor after
  first paint. Keep it bounded: total precache bytes ≤ 1.5 MB, no single
  precached asset over the 300 KB rule the generator already applies, and the
  two heavy vendors (three, pdf) must be runtime-cached, never precached.

  Run: node scripts/test-sw-budget.mjs   (wired into npm run test:unit)
*/
import fs from "node:fs";
import path from "node:path";

let failures = 0;
const ok = (cond, msg) => {
  if (cond) console.log(`  ✓ ${msg}`);
  else {
    failures++;
    console.error(`  ✗ ${msg}`);
  }
};
const DIST = path.join(process.cwd(), "dist");
const sw = path.join(DIST, "sw.js");
if (!fs.existsSync(sw)) {
  if (process.env.CI) { console.error("dist/sw.js missing in CI — build must precede this check."); process.exit(1); }
  console.log("  ⓘ SKIPPED — dist/ not built.");
  process.exit(0);
}
const m = fs.readFileSync(sw, "utf8").match(/assets:\s*(\[[^\]]*\])/);
ok(Boolean(m), "sw.js carries a precache asset list");
const assets = m ? JSON.parse(m[1]) : [];
let total = 0; const over = [];
for (const a of assets) {
  const f = path.join(DIST, a.replace(/^\//, ""));
  const size = fs.existsSync(f) ? fs.statSync(f).size : 0;
  total += size;
  if (size > 300 * 1024) over.push(`${a} (${(size / 1024).toFixed(0)} KB)`);
}
const BUDGET = 1.5 * 1024 * 1024;
console.log(`SW precache — ${assets.length} entries, ${(total / 1024).toFixed(0)} KB:`);
ok(total <= BUDGET, `total precache ≤ 1.5 MB (${(total / 1024).toFixed(0)} KB)`);
ok(over.length === 0, `no precached asset over 300 KB (${JSON.stringify(over)})`);
ok(!assets.some((a) => /vendor-three|vendor-pdf/.test(a)), "vendor-three / vendor-pdf are runtime-cached, not precached");
ok(assets.length > 0 && assets.every((a) => fs.existsSync(path.join(DIST, a.replace(/^\//, "")))), "every precached path exists in dist");

if (failures) { console.error(`\n${failures} SW-budget check(s) FAILED`); process.exit(1); }
console.log("\nAll SW-budget checks passed.");
