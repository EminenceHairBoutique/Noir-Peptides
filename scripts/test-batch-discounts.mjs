// scripts/test-batch-discounts.mjs
// Phase 10 contract guards: the batch print run must respect the publishing
// gate (approved/production_ready, never recalled), and the discounts
// manager must stay admin-gated, bounded, and audit-logged.
import { readFileSync } from "node:fs";

let passed = 0;
let failed = 0;
function check(name, cond) {
  if (cond) passed += 1;
  else { failed += 1; console.error(`  ✗ ${name}`); }
}

const pdfExport = readFileSync(new URL("../src/lib/labels/pdfExport.js", import.meta.url), "utf8");
const studio = readFileSync(new URL("../src/pages/LabelStudio.jsx", import.meta.url), "utf8");
const api = readFileSync(new URL("../api/admin/discounts.js", import.meta.url), "utf8");
const ui = readFileSync(new URL("../src/pages/AdminHome.jsx", import.meta.url), "utf8");
const validator = readFileSync(new URL("../lib/discounts.js", import.meta.url), "utf8");

// ── Batch label print ─────────────────────────────────────────────────────
check("batch export exists and merges via copyPages", pdfExport.includes("labelBatchPdfBlob") && pdfExport.includes("copyPages"));
check("batch pages come from the SAME per-label renderer (no drift)",
  /labelBatchPdfBlob[\s\S]*?await labelPdfBlob\(config/.test(pdfExport));
check("batch renders sequentially (memory note present)", pdfExport.includes("Sequential on purpose"));
check("batch reports progress", pdfExport.includes("opts.onProgress?.("));
check("studio batch respects the publishing gate",
  studio.includes(`(c.status === "approved" || c.status === "production_ready") && !c.recalled`));
check("studio batch button disabled when nothing approved",
  studio.includes("!printableConfigs.length"));

// ── Discounts endpoint ────────────────────────────────────────────────────
check("endpoint is admin-gated", api.includes("requireAdmin(req, res)"));
check("code format enforced (uppercase alnum/dash, 2–32)", api.includes("^[A-Z0-9][A-Z0-9-]{1,31}$"));
check("percent capped at 100", api.includes("percent value cannot exceed 100"));
check("fixed capped", api.includes("fixed value cannot exceed 10000"));
check("kind restricted to validator's two kinds",
  api.includes(`["percent", "fixed"].includes(body.kind)`) &&
  validator.includes(`d.kind === "percent"`));
check("duplicate code → friendly 409", api.includes("23505") && api.includes("already exists"));
check("redemption history is read-only (no delete path)", !/\.delete\(\)/.test(api));
check("changes audit-logged with before/after", api.includes(`"discount.update"`) && api.includes("from:"));

// ── UI wiring ─────────────────────────────────────────────────────────────
check("Discounts tab registered", ui.includes(`{ id: "discounts", label: "Discounts", icon: Percent }`));
check("DiscountsManager rendered", ui.includes(`tab === "discounts" && <DiscountsManager`));
check("UI shows redemption usage against caps", ui.includes("used ${d.redemption_count}"));
check("server-repricing note shown to admin", ui.includes("re-priced on the server"));

if (failed > 0) {
  console.error(`\nbatch+discounts: ${failed} FAILED, ${passed} passed`);
  process.exit(1);
}
console.log(`batch+discounts: all ${passed} assertions passed`);
