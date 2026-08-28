/*
  scripts/test-db-verify.mjs
  Static test that db:verify's expected counts still match the live catalog
  exports — so the reconcile verifier can't silently rot when the catalog
  changes. Style mirrors scripts/test-guardrail.mjs.

  Run: node scripts/test-db-verify.mjs   (wired into npm run test:unit)
*/
import { deriveExpectedCounts } from "./expected-counts.mjs";
import { getAllProducts, getCategories, tiersForPrice } from "../src/data/tier1Catalog.js";

let failures = 0;
const ok = (cond, msg) => {
  if (cond) console.log(`  ✓ ${msg}`);
  else {
    failures++;
    console.error(`  ✗ ${msg}`);
  }
};

console.log("db:verify expected-counts derivation:");

const exp = deriveExpectedCounts();

// Recompute independently from the catalog and require exact agreement.
const products = getAllProducts();
const categories = getCategories();
let variants = 0;
let priceTiers = 0;
for (const p of products) {
  for (const v of p.variants || []) {
    variants += 1;
    priceTiers += tiersForPrice(v.price)?.length || 0;
  }
}

ok(exp.products === products.length, `products = ${products.length}`);
ok(exp.product_categories === categories.length, `product_categories = ${categories.length}`);
ok(exp.product_variants === variants, `product_variants = ${variants}`);
ok(exp.price_tiers === priceTiers, `price_tiers = ${priceTiers}`);
ok(exp.label_configs === variants, `label_configs = variants (${variants})`);

// Sanity: none of the derived counts is zero (a zeroed catalog would make the
// verifier pass against an empty DB — the exact drift it exists to catch).
for (const [k, v] of Object.entries(exp)) {
  ok(typeof v === "number" && v > 0, `${k} derived > 0 (${v})`);
}

if (failures) {
  console.error(`\n${failures} db:verify derivation check(s) FAILED`);
  process.exit(1);
}
console.log("\nAll db:verify derivation checks passed.");
