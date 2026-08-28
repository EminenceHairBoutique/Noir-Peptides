/*
  scripts/test-server-pricing.mjs
  Proves the price ladder is SERVER-AUTHORITATIVE by executing the real
  lib/pricing.js against fixture rows.

  The threat this guards: a cart line is JSON the client controls end to end. If
  any client-supplied price, unit price, tier or discount ever reached the
  charge, a buyer could pay a dollar for a $600 order by editing one request. So
  every assertion below sends a HOSTILE line item alongside the legitimate
  fields and asserts the server's own DB-derived number comes out regardless.

  lib/supabaseServer.js is swapped for an in-memory stub at bundle time
  (scripts/_pricing-stub-supabase.mjs) — the code under test is unmodified.

  Run: node scripts/test-server-pricing.mjs   (in npm run test:unit)
*/
import { build } from "esbuild";
import path from "node:path";
import fs from "node:fs";

let failures = 0;
const ok = (m) => console.log(`  ✓ ${m}`);
const fail = (m) => {
  failures++;
  console.error(`  ✗ ${m}`);
};
const assert = (c, m) => (c ? ok(m) : fail(m));

// ── Bundle lib/pricing.js with the Supabase server client stubbed out ──
const outfile = path.join(process.cwd(), `.pricing-test-${Date.now()}.mjs`);
const stubPath = path.join(process.cwd(), "scripts/_pricing-stub-supabase.mjs");

await build({
  entryPoints: [path.join(process.cwd(), "scripts/_pricing-entry.mjs")],
  bundle: true,
  format: "esm",
  platform: "node",
  outfile,
  logLevel: "silent",
  plugins: [
    {
      name: "stub-supabase-server",
      setup(b) {
        // Any import that resolves to lib/supabaseServer.js becomes the stub.
        b.onResolve({ filter: /supabaseServer\.js$/ }, () => ({ path: stubPath }));
      },
    },
  ],
});
const { priceLines, resolveVariantUnitPrice, FIXTURES } = await import(`file://${outfile}`);

// ── Fixtures: one tracked variant with a 1/2/5 ladder, one untracked ──
const VIAL = {
  id: "var-1",
  product_id: "prod-1",
  sku: "NP-TEST-5MG",
  price: 100, // base unit price in the DB
  stock_status: "in_stock",
  vial_size_mg: 5,
  size_label: "5 mg",
  inventory_count: 10,
  low_stock_threshold: 2,
  products: { name: "Test Material", image_url: null, batch_number: null, cas_number: null, is_bundle: false },
};
const BUNDLE = {
  ...VIAL,
  id: "var-bundle",
  sku: "NP-TEST-KIT",
  price: 250,
  inventory_count: null, // untracked
  products: { ...VIAL.products, name: "Test Kit", is_bundle: true },
};
const OOS = { ...VIAL, id: "var-oos", sku: "NP-OOS", stock_status: "out_of_stock" };
const BADPRICE = { ...VIAL, id: "var-bad", sku: "NP-BAD", price: 0 };

FIXTURES.product_variants.push(VIAL, BUNDLE, OOS, BADPRICE);
FIXTURES.price_tiers.push(
  { variant_id: "var-1", min_quantity: 1, unit_price: 100 },
  { variant_id: "var-1", min_quantity: 2, unit_price: 90 },
  { variant_id: "var-1", min_quantity: 5, unit_price: 75 }
);

const rejects = async (items, label) => {
  try {
    await priceLines(items);
    fail(`${label} — expected a throw, got a priced cart`);
  } catch {
    ok(label);
  }
};

// ── 1. The ladder resolves server-side, from the DB, per quantity ──
console.log("Quantity price ladder (resolved from price_tiers, server-side):");
assert((await resolveVariantUnitPrice("var-1", 1)) === 100, "qty 1 → $100 (tier 1)");
assert((await resolveVariantUnitPrice("var-1", 2)) === 90, "qty 2 → $90 (tier 2)");
assert((await resolveVariantUnitPrice("var-1", 4)) === 90, "qty 4 → $90 (best tier ≤ qty, not the next one up)");
assert((await resolveVariantUnitPrice("var-1", 5)) === 75, "qty 5 → $75 (tier 5)");
assert((await resolveVariantUnitPrice("var-1", 99)) === 75, "qty 99 → $75 (highest tier holds)");
assert((await resolveVariantUnitPrice("var-bundle", 3)) === null, "variant with no tiers → null (caller uses base)");

// ── 2. TAMPERED PRICE REJECTION — the core guarantee ──
console.log("\nTampered line items (client-supplied money is ignored):");
{
  const r = await priceLines([
    {
      variantId: "var-1",
      quantity: 2,
      // Everything below is attacker-controlled and must be ignored.
      price: 0.01,
      unitDollars: 0.01,
      unit_price: 0.01,
      subtotal: 0.02,
      lineTotal: 0.02,
      tiers: [{ min_quantity: 1, unit_price: 0.01 }],
      is_bundle: true,
      products: { is_bundle: true },
    },
  ]);
  assert(r.lines[0].unitDollars === 90, `tampered unit price ignored — charged $90, not $0.01`);
  assert(r.fullSubtotal === 180, `subtotal re-derived server-side ($180), client's $0.02 discarded`);
  assert(r.eligibleSubtotal === 180, "client's is_bundle:true cannot force the line out of the eligible subtotal");
}
{
  // A client that inflates its own tier table cannot buy the deeper discount.
  const r = await priceLines([
    { variantId: "var-1", quantity: 1, tiers: [{ min_quantity: 1, unit_price: 75 }] },
  ]);
  assert(r.lines[0].unitDollars === 100, "client-supplied tier ladder ignored — qty 1 charged $100, not $75");
}
{
  // Nor can it claim a higher quantity's price while buying fewer units.
  const r = await priceLines([{ variantId: "var-1", quantity: 1, quantityForPricing: 99 }]);
  assert(r.lines[0].unitDollars === 100, "unknown pricing-quantity field ignored — ladder keys off the real qty");
}
{
  // sku and variantId disagree: resolution uses variantId first, never a
  // client-named price.
  const r = await priceLines([{ variantId: "var-1", sku: "NP-TEST-KIT", quantity: 5, price: 1 }]);
  assert(r.lines[0].unitDollars === 75, "variantId wins over a mismatched sku; price field still ignored");
}

// ── 3. Quantity is clamped server-side, and the clamp drives the price ──
console.log("\nServer-side quantity clamp (1..99):");
{
  const r = await priceLines([{ variantId: "var-bundle", quantity: 1e6 }]);
  assert(r.lines[0].qty === 99, "quantity 1,000,000 clamped to 99");
  assert(r.fullSubtotal === 250 * 99, "subtotal uses the CLAMPED quantity");
}
{
  const r = await priceLines([{ variantId: "var-bundle", quantity: 2.9 }]);
  assert(r.lines[0].qty === 2, "fractional quantity floored to 2");
}
await rejects([{ variantId: "var-bundle", quantity: 0 }], "quantity 0 rejected (falsy → missing field)");
{
  // A negative quantity is CLAMPED to 1, not rejected. That is safe in the only
  // direction that matters — it can never produce a negative line, a credit, or
  // a subtotal below the real one — so this asserts the behaviour rather than
  // demanding a throw the checkout flow does not currently perform.
  const r = await priceLines([{ variantId: "var-bundle", quantity: -5 }]);
  assert(r.lines[0].qty === 1, "negative quantity clamped to 1 (never a negative line)");
  assert(r.fullSubtotal === 250, "negative quantity cannot drive the subtotal below one unit");
}

// ── 4. Identity + availability come from the DB, not the request ──
console.log("\nIdentity and availability:");
await rejects([{ variantId: "does-not-exist", quantity: 1 }], "unknown variant rejected");
await rejects([{ quantity: 1 }], "line with neither variantId nor sku rejected");
await rejects([{ variantId: "var-oos", quantity: 1 }], "out-of-stock variant rejected");
await rejects([{ variantId: "var-bad", quantity: 1 }], "variant with a non-positive DB price rejected");
await rejects(
  [{ variantId: "var-1", quantity: 11 }],
  "oversell rejected (inventory_count 10 < qty 11)"
);
{
  const r = await priceLines([{ variantId: "var-1", quantity: 10 }]);
  assert(r.lines[0].qty === 10, "quantity exactly at inventory_count is allowed");
}
{
  // inventory_count null = untracked; the oversell guard must not fire.
  const r = await priceLines([{ variantId: "var-bundle", quantity: 40 }]);
  assert(r.lines[0].qty === 40, "untracked variant (inventory_count null) is not capped by the oversell guard");
}
{
  // A client cannot lift its own ceiling by sending inventory_count.
  await rejects(
    [{ variantId: "var-1", quantity: 11, inventory_count: 9999 }],
    "client-supplied inventory_count cannot defeat the oversell guard"
  );
}

// ── 5. Bundles are excluded from the promo-eligible subtotal, server-side ──
console.log("\nEligible vs full subtotal (bundle exclusion is a DB fact):");
{
  const r = await priceLines([
    { variantId: "var-1", quantity: 1 },      // $100, eligible
    { variantId: "var-bundle", quantity: 1 }, // $250, is_bundle → excluded
  ]);
  assert(r.fullSubtotal === 350, "full subtotal counts every line ($350)");
  assert(r.eligibleSubtotal === 100, "eligible subtotal excludes the bundle ($100)");
}
{
  // The inverse tamper: claiming is_bundle:false on a real bundle.
  const r = await priceLines([{ variantId: "var-bundle", quantity: 1, is_bundle: false }]);
  assert(r.eligibleSubtotal === 0, "client's is_bundle:false cannot pull a real bundle into the eligible subtotal");
}

// ── 6. Multi-line carts price each line independently ──
console.log("\nMulti-line carts:");
{
  const r = await priceLines([
    { variantId: "var-1", quantity: 5, price: 1 },
    { variantId: "var-bundle", quantity: 2, price: 1 },
  ]);
  assert(r.lines[0].unitDollars === 75 && r.lines[1].unitDollars === 250, "each line re-priced from its own DB row");
  assert(r.fullSubtotal === 75 * 5 + 250 * 2, "multi-line subtotal is the sum of server prices");
}

fs.rmSync(outfile, { force: true });

if (failures) {
  console.error(`\n${failures} server-pricing check(s) FAILED`);
  process.exit(1);
}
console.log("\nAll server-pricing checks passed.");
