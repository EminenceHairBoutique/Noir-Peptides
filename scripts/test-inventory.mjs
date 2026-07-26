// scripts/test-inventory.mjs
// Phase 8 inventory tests: the pure logic in lib/inventory.js exercised
// directly, plus source-contract guards that keep the decrement, the Stripe
// SKU expansion, the oversell guard, and the admin derivation wired.
import { readFileSync } from "node:fs";
import { deriveStockStatus, isTracked, normalizeOrderItems } from "../lib/inventory.js";

let passed = 0;
let failed = 0;
function check(name, cond) {
  if (cond) passed += 1;
  else { failed += 1; console.error(`  ✗ ${name}`); }
}

// ── deriveStockStatus ─────────────────────────────────────────────────────
check("0 → out_of_stock", deriveStockStatus(0) === "out_of_stock");
check("at threshold → low_stock", deriveStockStatus(5, 5) === "low_stock");
check("below threshold → low_stock", deriveStockStatus(2, 5) === "low_stock");
check("above threshold → in_stock", deriveStockStatus(6, 5) === "in_stock");
check("custom threshold respected", deriveStockStatus(10, 10) === "low_stock" && deriveStockStatus(11, 10) === "in_stock");
check("threshold 0: any positive count is in_stock", deriveStockStatus(1, 0) === "in_stock");
check("negative count clamps to out_of_stock", deriveStockStatus(-3) === "out_of_stock");
check("garbage count clamps to out_of_stock", deriveStockStatus("abc") === "out_of_stock");

// ── isTracked ─────────────────────────────────────────────────────────────
check("null count = untracked", !isTracked({ inventory_count: null }));
check("undefined count = untracked", !isTracked({ inventory_count: undefined }));
check("0 count = tracked", isTracked({ inventory_count: 0 }));
check("positive count = tracked", isTracked({ inventory_count: 12 }));
check("null row = untracked", !isTracked(null));

// ── normalizeOrderItems: both rails' shapes ───────────────────────────────
const btcpay = normalizeOrderItems([
  { name: "BPC-157 5 mg", sku: "BPC157-5", quantity: 2, unit_dollars: 44 },
  { name: "no sku line", quantity: 3 },
]);
check("BTCPay shape: sku+qty extracted", btcpay.length === 1 && btcpay[0].sku === "BPC157-5" && btcpay[0].quantity === 2);

const stripe = normalizeOrderItems([
  { quantity: 1, price: { product: { metadata: { sku: "TB500-10" } } } },
  { quantity: 2, price: { product: "prod_unexpanded_string" } },
  { quantity: 0, price: { product: { metadata: { sku: "KPV-5" } } } },
]);
check("Stripe expanded shape: sku from product metadata", stripe.length === 1 && stripe[0].sku === "TB500-10");
check("unexpanded product / zero qty lines dropped safely", !stripe.some((l) => l.sku === "KPV-5"));

check("non-array input → []", normalizeOrderItems(null).length === 0);
check("quantity capped at 99", normalizeOrderItems([{ sku: "X", quantity: 500 }])[0].quantity === 99);
check("fractional quantity floored", normalizeOrderItems([{ sku: "X", quantity: 2.9 }])[0].quantity === 2);

// ── Source-contract guards ────────────────────────────────────────────────
const fulfillment = readFileSync(new URL("../lib/payments/fulfillment.js", import.meta.url), "utf8");
const webhook = readFileSync(new URL("../api/stripe-webhook.js", import.meta.url), "utf8");
const pricing = readFileSync(new URL("../lib/pricing.js", import.meta.url), "utf8");
const catalogApi = readFileSync(new URL("../api/admin/catalog.js", import.meta.url), "utf8");
const migration = readFileSync(new URL("../supabase/migrations/0028_inventory.sql", import.meta.url), "utf8");

check("fulfillOrder decrements inventory", fulfillment.includes("await decrementInventory({ items, orderNumber })"));
check("decrement floors at zero", fulfillment.includes("Math.max(0, Number(v.inventory_count) - line.quantity)"));
check("decrement skips untracked variants", fulfillment.includes("!isTracked(v)"));
check("decrement is audit-logged with oversell visibility", fulfillment.includes("inventory.decrement") && fulfillment.includes("oversold"));
check("Stripe webhook expands price.product for SKUs", webhook.includes(`expand: ["data.price.product"]`));
check("pricing selects inventory columns", pricing.includes("inventory_count, low_stock_threshold"));
check("oversell guard throws before checkout", pricing.includes("Insufficient stock for"));
check("admin API validates count bounds", catalogApi.includes("inventory_count must be an integer"));
check("admin API derives status in tracked mode", catalogApi.includes("fields.stock_status = deriveStockStatus(effectiveCount, threshold)"));
check("migration keeps variants untracked by default (no backfill)", !/update\s+public\.product_variants\s+set\s+inventory_count/i.test(migration));
check("migration enforces non-negative counts", migration.includes("inventory_count >= 0"));

if (failed > 0) {
  console.error(`\ninventory: ${failed} FAILED, ${passed} passed`);
  process.exit(1);
}
console.log(`inventory: all ${passed} assertions passed`);
