/*
  scripts/test-pricing-coherence.mjs   (opt cycle 11 — scorecard 4.14 / 4.5)
  Executes the REAL promo + loyalty adjustment code (lib/pricing.js
  computeAdjustments → lib/discounts.js validateDiscount + lib/rewards.js
  validateLoyaltyRedemption) against fixture rows, and pins the client to the
  same contract:

    1. One redemption rate. src/utils/loyalty.js is the only place the
       points→dollar conversion is written; lib/rewards.js imports it and no
       checkout surface carries a literal copy (the old "100 pts = $5" was a
       hard-coded 5 on the client).
    2. Redemption rules: increments, balance, cap to the order (only the points
       actually used are consumed), zero is a no-op.
    3. Adjustment order: promo on the eligible subtotal, loyalty on what is
       left of the FULL subtotal; the coupon never exceeds the subtotal.
    4. Pricing is identity-blind: nothing in the price ladder, the promo
       validator or the redemption reads a partner/account tier. Partner
       pricing is dormant and stays that way until the owner decides.
    5. Live path: the routed checkout posts `discountCode` / `redeemPoints`
       as HINTS and never a dollar amount; the balance it offers comes from
       the server-hydrated profile.

  lib/supabaseServer.js is swapped for the in-memory stub at bundle time.
  Run: node scripts/test-pricing-coherence.mjs   (in npm run test:unit)
*/
import { build } from "esbuild";
import path from "node:path";
import fs from "node:fs";

let failures = 0;
const ok = (m) => console.log(`  ✓ ${m}`);
const fail = (m) => { failures++; console.error(`  ✗ ${m}`); };
const assert = (c, m) => (c ? ok(m) : fail(m));
const near = (a, b) => Math.abs(Number(a) - Number(b)) < 0.005;
const read = (rel) => fs.readFileSync(path.join(process.cwd(), rel), "utf8");
const stripComments = (s) => s.replace(/\/\*[\s\S]*?\*\//g, "").replace(/(^|[^:"'`])\/\/[^\n]*/g, "$1");

const outfile = path.join(process.cwd(), `.pricing-coherence-${Date.now()}.mjs`);
const stubPath = path.join(process.cwd(), "scripts/_pricing-stub-supabase.mjs");
await build({
  entryPoints: [path.join(process.cwd(), "scripts/_pricing-entry.mjs")],
  bundle: true, format: "esm", platform: "node", outfile, logLevel: "silent",
  plugins: [{ name: "stub-supabase-server", setup(b) { b.onResolve({ filter: /supabaseServer\.js$/ }, () => ({ path: stubPath })); } }],
});
const M = await import(`file://${outfile}`);
const { computeAdjustments, validateLoyaltyRedemption, POINT_VALUE_USD, REDEEM_INCREMENT, FIXTURES, LOG } = M;
const { POINT_VALUE_USD: CLIENT_RATE, REDEEM_INCREMENT: CLIENT_INC, redeemDollars } = await import("../src/utils/loyalty.js");

const USER = "user-1";
function reset({ points = 0, discounts = [], redemptions = [] } = {}) {
  FIXTURES.profiles = [{ id: USER, loyalty_points: points }];
  FIXTURES.discounts = discounts;
  FIXTURES.discount_redemptions = redemptions;
  FIXTURES.loyalty_ledger = [];
  LOG.length = 0;
}
const PROMO10 = { id: "d-1", code: "WELCOME10", active: true, kind: "percent", value: 10, min_subtotal: 0, max_redemptions: null, per_user_limit: null, excludes_bundles: true };
const FLAT50 = { id: "d-2", code: "FLAT50", active: true, kind: "fixed", value: 50, min_subtotal: 0, max_redemptions: null, per_user_limit: null, excludes_bundles: false };

console.log("1. One redemption rate, owned by src/utils/loyalty.js:");
assert(POINT_VALUE_USD === CLIENT_RATE && REDEEM_INCREMENT === CLIENT_INC, `server and client share the rate (${REDEEM_INCREMENT} pts = $${redeemDollars(REDEEM_INCREMENT)})`);
assert(near(POINT_VALUE_USD * REDEEM_INCREMENT, 5), "the documented conversion (100 pts = $5) is the shared constants' product");
{
  const rewards = stripComments(read("lib/rewards.js"));
  assert(/from "\.\.\/src\/utils\/loyalty\.js"/.test(rewards) && !/POINT_VALUE_USD\s*=\s*0\.05/.test(rewards), "lib/rewards.js imports the rate; it declares no copy");
  for (const rel of ["src/components/checkout/StepPayment.jsx", "src/pages/CheckoutTwoStep.jsx", "src/pages/Checkout.jsx"]) {
    const src = stripComments(read(rel));
    const literal = /\(\s*p\s*\/\s*100\s*\)\s*\*\s*5|100 pts = \$5|\* 0\.05|\/\s*20\b/.test(src);
    assert(!literal && /from "\.\.\/(?:\.\.\/)?utils\/loyalty"/.test(src), `${rel}: no literal conversion; imports the shared loyalty config`);
  }
}

console.log("\n2. Redemption rules (real validateLoyaltyRedemption):");
{
  reset({ points: 250 });
  let r = await validateLoyaltyRedemption({ userId: USER, points: 100, maxDollars: 500 });
  assert(r.ok && r.points === 100 && near(r.dollars, 5), "100 pts on a 250 balance → $5.00, 100 pts consumed");
  r = await validateLoyaltyRedemption({ userId: USER, points: 150, maxDollars: 500 });
  assert(!r.ok && /increments/i.test(r.error), "150 pts is rejected: not a whole increment");
  r = await validateLoyaltyRedemption({ userId: USER, points: 300, maxDollars: 500 });
  assert(!r.ok && /insufficient/i.test(r.error), "300 pts on a 250 balance is rejected");
  r = await validateLoyaltyRedemption({ userId: USER, points: 0, maxDollars: 500 });
  assert(r.ok && r.points === 0 && r.dollars === 0, "0 pts is a no-op");
  r = await validateLoyaltyRedemption({ userId: USER, points: -100, maxDollars: 500 });
  assert(r.ok && r.points === 0 && r.dollars === 0, "negative points collapse to a no-op (never a credit)");
  reset({ points: 1000 });
  r = await validateLoyaltyRedemption({ userId: USER, points: 500, maxDollars: 12 });
  assert(r.ok && r.points === 200 && near(r.dollars, 10), "500 pts against a $12 order caps to whole increments: $10 / 200 pts consumed");
  r = await validateLoyaltyRedemption({ userId: USER, points: 500, maxDollars: 0 });
  assert(r.ok && r.points === 0 && r.dollars === 0, "a fully discounted order consumes no points");
  r = await validateLoyaltyRedemption({ userId: "someone-else", points: 100, maxDollars: 50 });
  assert(!r.ok, "another user's balance is not reachable (unknown profile → 0 balance → insufficient)");
  assert(LOG.length === 0, "validation writes nothing (deduction happens only in the paid webhook)");
}

console.log("\n3. Adjustment order (real computeAdjustments):");
{
  reset({ points: 1000, discounts: [PROMO10, FLAT50] });
  let a = await computeAdjustments({ userId: USER, discountCode: "welcome10", redeemPoints: 200, eligibleSubtotal: 100, fullSubtotal: 150 });
  assert(a.ok && near(a.promoAmount, 10) && a.promoCode === "WELCOME10", "10 % promo applies to the ELIGIBLE subtotal ($100 of $150 → $10), code normalised");
  assert(a.loyaltyPoints === 200 && near(a.loyaltyDollars, 10) && near(a.couponDollars, 20), "loyalty stacks after the promo: 200 pts → $10, coupon $20");
  a = await computeAdjustments({ userId: USER, discountCode: "FLAT50", redeemPoints: 0, eligibleSubtotal: 30, fullSubtotal: 30 });
  assert(a.ok && near(a.promoAmount, 30) && near(a.couponDollars, 30), "a fixed $50 code on a $30 order is clamped to $30");
  a = await computeAdjustments({ userId: USER, discountCode: "FLAT50", redeemPoints: 1000, eligibleSubtotal: 42, fullSubtotal: 42 });
  assert(a.ok && near(a.promoAmount, 42) && a.loyaltyPoints === 0 && near(a.couponDollars, 42), "loyalty is computed on what the promo leaves: nothing left → 0 pts consumed, coupon never exceeds the subtotal");
  a = await computeAdjustments({ userId: USER, discountCode: "NOPE", redeemPoints: 0, eligibleSubtotal: 100, fullSubtotal: 100 });
  assert(!a.ok && /invalid/i.test(a.error), "an unknown code fails closed");
  a = await computeAdjustments({ userId: USER, discountCode: "", redeemPoints: 0, eligibleSubtotal: 100, fullSubtotal: 100 });
  assert(a.ok && a.couponDollars === 0 && a.promoCode === "", "no code, no points → zero adjustment");
  reset({ points: 1000, discounts: [{ ...PROMO10, ends_at: "2020-01-01T00:00:00Z" }] });
  a = await computeAdjustments({ userId: USER, discountCode: "WELCOME10", redeemPoints: 0, eligibleSubtotal: 100, fullSubtotal: 100 });
  assert(!a.ok && /expired/i.test(a.error), "an expired code fails closed");
  reset({ points: 1000, discounts: [{ ...PROMO10, per_user_limit: 1 }], redemptions: [{ id: "r1", discount_id: "d-1", user_id: USER }] });
  a = await computeAdjustments({ userId: USER, discountCode: "WELCOME10", redeemPoints: 0, eligibleSubtotal: 100, fullSubtotal: 100 });
  assert(!a.ok && /already used/i.test(a.error), "a per-user limit is enforced from the redemption ledger");
  reset({ points: 1000, discounts: [{ ...PROMO10, min_subtotal: 200 }] });
  a = await computeAdjustments({ userId: USER, discountCode: "WELCOME10", redeemPoints: 0, eligibleSubtotal: 100, fullSubtotal: 100 });
  assert(!a.ok && /minimum/i.test(a.error), "a minimum eligible subtotal is enforced");
  reset({ points: 100, discounts: [] });
  a = await computeAdjustments({ userId: USER, discountCode: "", redeemPoints: 300, eligibleSubtotal: 100, fullSubtotal: 100 });
  assert(!a.ok && /insufficient/i.test(a.error), "asking for more points than the balance fails the whole adjustment (no partial silent clamp)");
}

console.log("\n4. Pricing is identity-blind (partner pricing dormant):");
{
  for (const rel of ["lib/pricing.js", "lib/discounts.js", "lib/rewards.js"]) {
    const src = stripComments(read(rel));
    assert(!/partner_tier|partner_status|account_tier|partnerTier|accountTier/.test(src), `${rel} never reads a partner / account tier`);
  }
  const pricing = stripComments(read("lib/pricing.js"));
  assert(/export async function priceLines\(items\)/.test(pricing), "priceLines(items) takes no user — the ladder cannot vary by identity");
}

console.log("\n5. Live path — the routed checkout posts hints, never dollars:");
{
  const two = stripComments(read("src/pages/CheckoutTwoStep.jsx"));
  const payStart = two.indexOf("body: JSON.stringify({", two.indexOf("fetch(rail.endpoint"));
  const body = two.slice(payStart, two.indexOf("\n        })", payStart));
  assert(/discountCode:/.test(body) && /redeemPoints:/.test(body), "onPay posts discountCode + redeemPoints");
  assert(!/loyaltyDollars|couponDollars|discountAmount|promoAmount|unitPrice|price:/.test(body), "onPay posts no dollar amount or discount value");
  assert(/user\?\.loyaltyPoints/.test(two), "the offered balance is the profile-hydrated user.loyaltyPoints");
  const ctx = stripComments(read("src/context/UserContext.jsx"));
  assert(/loyalty_points/.test(ctx) && /loyaltyPoints:\s*Math\.max\(0, Math\.floor\(Number\(data\?\.loyalty_points\)/.test(ctx), "UserContext hydrates loyaltyPoints from profiles.loyalty_points (the balance the server honours)");
  const step = stripComments(read("src/components/checkout/StepPayment.jsx"));
  assert(/id="promo"/.test(step) && /id="redeem"/.test(step), "StepPayment offers the promo input and the points select");
  assert(/REDEEM_INCREMENT/.test(step) && /redeemDollars\(/.test(step), "StepPayment derives options and labels from the shared config");
  const stripe = stripComments(read("api/create-checkout-session.js"));
  const btc = stripComments(read("api/btcpay/create-invoice.js"));
  assert(/computeAdjustments\(\{/.test(stripe) && /computeAdjustments\(\{/.test(btc), "both rails consume the hints through computeAdjustments (read-only check; ask-before files untouched)");
}

fs.rmSync(outfile, { force: true });
if (failures) { console.error(`\n${failures} pricing-coherence check(s) FAILED`); process.exit(1); }
console.log("\nAll pricing-coherence checks passed.");
