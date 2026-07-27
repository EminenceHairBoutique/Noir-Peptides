// scripts/test-fulfillment.mjs
// Phase 9 fulfillment contract guards: order detail exposure, tracking
// persistence + https enforcement, shipped_at stamping, packing-slip
// compliance text, drift-safe customer order reads, and UI wiring.
import { readFileSync } from "node:fs";

let passed = 0;
let failed = 0;
function check(name, cond) {
  if (cond) passed += 1;
  else { failed += 1; console.error(`  ✗ ${name}`); }
}

const ordersApi = readFileSync(new URL("../api/admin/orders.js", import.meta.url), "utf8");
const statusApi = readFileSync(new URL("../api/admin/order-status.js", import.meta.url), "utf8");
const ui = readFileSync(new URL("../src/pages/AdminHome.jsx", import.meta.url), "utf8");
const ordersLib = readFileSync(new URL("../src/lib/orders.js", import.meta.url), "utf8");
const consoleUi = readFileSync(new URL("../src/pages/ResearcherConsole.jsx", import.meta.url), "utf8");
const migration = readFileSync(new URL("../supabase/migrations/0029_fulfillment.sql", import.meta.url), "utf8");

// ── Admin order detail ────────────────────────────────────────────────────
check("detail endpoint is admin-gated", ordersApi.includes("requireAdmin(req, res)"));
check("detail returns items + shipping address + tracking",
  ordersApi.includes("items, shipping_address, tracking_url, tracking_carrier, shipped_at"));
check("order number param is length-capped", ordersApi.includes('String(orderNumber).slice(0, 64)'));

// ── Status/tracking endpoint ──────────────────────────────────────────────
check("tracking URL must be https", statusApi.includes("must be an https:// link"));
check("tracking persists to the order row", statusApi.includes("update.tracking_url"));
check("carrier persists", statusApi.includes("update.tracking_carrier"));
check("shipped_at stamped on shipped", statusApi.includes(`value.status === "shipped"`) && statusApi.includes("update.shipped_at"));
check("email falls back to stored tracking link", statusApi.includes("order.tracking_url || undefined"));

// ── Packing slip ──────────────────────────────────────────────────────────
check("slip carries BOTH RUO warning lines",
  ui.includes("FOR RESEARCH USE ONLY. NOT FOR HUMAN OR VETERINARY USE.") &&
  ui.includes("NOT FOR DIAGNOSTIC, THERAPEUTIC, OR HOUSEHOLD USE."));
check("slip shows no pricing (by design note present)", ui.includes("No pricing is shown on this slip by design."));
check("slip escapes injected values", ui.includes('replace(/&/g, "&amp;")'));
check("slip reads both rails' line shapes", ui.includes("it?.unit_dollars") && ui.includes("it?.price?.unit_amount"));

// ── UI wiring ─────────────────────────────────────────────────────────────
check("order detail expandable from the list", ui.includes("<OrderDetail"));
check("ship action posts status + tracking", ui.includes('status: "shipped"') && ui.includes("trackingUrl: tracking.url"));

// ── Customer side ─────────────────────────────────────────────────────────
check("customer read requests tracking columns", ordersLib.includes("tracking_url, tracking_carrier, shipped_at"));
check("customer read degrades to legacy columns on drift (no blank history)",
  ordersLib.includes("const legacy = await supabase"));
check("console renders the tracking link", consoleUi.includes("Track shipment"));

// ── Migration ─────────────────────────────────────────────────────────────
check("migration is additive-only", !/drop\s+table|truncate|delete\s+from/i.test(migration));
check("all four fulfillment columns guarded",
  ["tracking_url", "tracking_carrier", "shipped_at", "fulfillment_notes"]
    .every((c) => migration.includes(`add column if not exists ${c}`)));

if (failed > 0) {
  console.error(`\nfulfillment: ${failed} FAILED, ${passed} passed`);
  process.exit(1);
}
console.log(`fulfillment: all ${passed} assertions passed`);
