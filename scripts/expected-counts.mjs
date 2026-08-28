/*
  scripts/expected-counts.mjs
  Single source of truth for db:verify's expected row counts, derived LIVE from
  the static catalog (src/data/tier1Catalog.js) so the verifier can never rot
  against the catalog. Imported by both scripts/db-verify.mjs and
  scripts/test-db-verify.mjs.

  Only counts that the catalog actually determines are derived here:
    products, categories, variants, price_tiers, label_configs (1 per variant).
  Published-COA count is NOT catalog-derived (COAs are per-batch lab data
  entered by the owner) — db-verify treats it as a presence check, not an exact
  expectation, and never fabricates a number for it.
*/
import { getAllProducts, getCategories, tiersForPrice } from "../src/data/tier1Catalog.js";

export function deriveExpectedCounts() {
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

  return {
    products: products.length,
    product_categories: categories.length,
    product_variants: variants,
    price_tiers: priceTiers,
    // One label config per variant is the seed's invariant (manual-seed.sql).
    label_configs: variants,
  };
}
