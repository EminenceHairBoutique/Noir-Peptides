/*
  scripts/test-cart-pricing.mjs
  Guards the client/server contract for cart quantities and tier pricing.
  The SERVER (lib/pricing.js) clamps each line to 1..99 and re-derives price
  from the DB; the client must never display a quantity/total the server would
  silently reduce. Pure Node — no DOM, no network.

  Run: node scripts/test-cart-pricing.mjs   (in npm run test:unit)
*/
// unitPriceForQuantity is pure; src/lib/catalog.js imports the browser
// Supabase client (not importable in Node), so mirror the function here and
// assert it stays in sync with the source below.
import { readFileSync } from "node:fs";

function unitPriceForQuantity(basePrice, tiers, qty) {
  const base = Number(basePrice) || 0;
  if (!Array.isArray(tiers) || !tiers.length) return base;
  let price = base;
  for (const t of tiers) {
    if (qty >= Number(t.min_quantity) && Number.isFinite(Number(t.unit_price))) {
      price = Number(t.unit_price);
    }
  }
  return price;
}

let failures = 0;
const ok = (m) => console.log(`  ✓ ${m}`);
const fail = (m) => { failures++; console.error(`  ✗ ${m}`); };
const assert = (c, m) => (c ? ok(m) : fail(m));

// Mirror of the client clamp in src/context/CartContext.jsx.
const MAX_LINE_QTY = 99;
const clampQty = (n) => Math.max(1, Math.min(MAX_LINE_QTY, Math.floor(Number(n) || 1)));

console.log("Cart quantity clamp (must match server 1..99):");
assert(clampQty(0) === 1, "0 → 1");
assert(clampQty(-5) === 1, "-5 → 1");
assert(clampQty(1.7) === 1, "1.7 → 1 (floored)");
assert(clampQty(999999) === 99, "999999 → 99 (server bound)");
assert(clampQty("abc") === 1, "non-numeric → 1");
assert(clampQty(null) === 1, "null → 1");
assert(clampQty(undefined) === 1, "undefined → 1");
assert(clampQty(50) === 50, "in-range passes through");

console.log("\nBundle tier pricing (display must equal charged):");
const tiers = [
  { min_quantity: 1, unit_price: 64 },
  { min_quantity: 2, unit_price: 61 },
  { min_quantity: 3, unit_price: 58 },
  { min_quantity: 5, unit_price: 54 },
  { min_quantity: 10, unit_price: 50 },
];
assert(unitPriceForQuantity(64, tiers, 1) === 64, "qty 1 → base");
assert(unitPriceForQuantity(64, tiers, 2) === 61, "qty 2 → 5% tier");
assert(unitPriceForQuantity(64, tiers, 4) === 58, "qty 4 → highest tier <= qty");
assert(unitPriceForQuantity(64, tiers, 10) === 50, "qty 10 → top tier");
assert(unitPriceForQuantity(64, tiers, 99) === 50, "above top tier stays top");
assert(unitPriceForQuantity(64, [], 5) === 64, "no tiers → base price");
assert(unitPriceForQuantity(49.99, [{ min_quantity: 1, unit_price: 49.99 }], 1) === 49.99,
  "decimal retail price preserved");

console.log("\nSource-sync guards:");
{
  const cartSrc = readFileSync("src/context/CartContext.jsx", "utf8");
  assert(/const MAX_LINE_QTY = 99;/.test(cartSrc), "CartContext still clamps to 99 (server bound)");
  assert((cartSrc.match(/clampQty\(/g) || []).length >= 3, "clampQty applied on add, update, and merge paths");
  const priceSrc = readFileSync("lib/pricing.js", "utf8");
  assert(/Math\.min\(99,/.test(priceSrc), "server still clamps to 99 (contract intact)");
  const catalogSrc = readFileSync("src/lib/catalog.js", "utf8");
  const fn = catalogSrc.slice(catalogSrc.indexOf("export function unitPriceForQuantity"));
  assert(/qty >= Number\(t\.min_quantity\)/.test(fn), "catalog tier rule unchanged (mirror valid)");
}

if (failures) {
  console.error(`\n${failures} cart/pricing test(s) FAILED`);
  process.exit(1);
}
console.log("\nAll cart/pricing tests passed.");
