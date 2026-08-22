// tests/audit/p1-checkout-hardening.test.mjs
// Regression tests for the P1 checkout cluster:
//   P1.1  duplicate Stripe sessions AND duplicate coupons from double-clicks,
//         retries, refreshes, second tabs, and network timeouts
//   P1.2  payment rails advertised from build-time flags rather than from what
//         the server can actually charge
//   A5    raw provider/database errors returned by admin endpoints
import { readFileSync } from "node:fs";
import { checkoutIdempotencyKey } from "../../lib/idempotency.js";

let passed = 0, failed = 0;
const check = (n, c) => { if (c) passed++; else { failed++; console.error(`  ✗ ${n}`); } };
const read = (p) => readFileSync(new URL(p, import.meta.url), "utf8");

const base = {
  userId: "u1",
  items: [{ variantId: "bpc-157-5mg", quantity: 2 }, { variantId: "tb-500-10mg", quantity: 1 }],
  discountCode: "LAUNCH10",
  redeemPoints: 100,
  referralCode: "NP-ABC",
  shippingMethod: "standard",
  requestToken: "attempt-1",
};

// ══ P1.1 — key stability (the double-click case) ══════════════════════════
check("identical request → identical key (double-click collapses)",
  checkoutIdempotencyKey(base) === checkoutIdempotencyKey({ ...base }));

check("item ORDER doesn't change the key",
  checkoutIdempotencyKey(base) ===
  checkoutIdempotencyKey({ ...base, items: [...base.items].reverse() }));

check("duplicate cart lines aggregate (2+1 of same variant == 3)",
  checkoutIdempotencyKey({ ...base, items: [{ variantId: "x", quantity: 3 }] }) ===
  checkoutIdempotencyKey({ ...base, items: [{ variantId: "x", quantity: 2 }, { variantId: "x", quantity: 1 }] }));

check("variant id case is normalized",
  checkoutIdempotencyKey({ ...base, items: [{ variantId: "ABC", quantity: 1 }] }) ===
  checkoutIdempotencyKey({ ...base, items: [{ variantId: "abc", quantity: 1 }] }));

check("discount code case is normalized",
  checkoutIdempotencyKey({ ...base, discountCode: "launch10" }) === checkoutIdempotencyKey(base));

check("non-price-affecting fields are ignored (name/image)",
  checkoutIdempotencyKey({ ...base, items: base.items.map((i) => ({ ...i, name: "x", image: "/y.png" })) }) ===
  checkoutIdempotencyKey(base));

// ══ P1.1 — key sensitivity (must NOT collapse different charges) ══════════
const diff = (patch, label) =>
  check(`different ${label} → different key`, checkoutIdempotencyKey({ ...base, ...patch }) !== checkoutIdempotencyKey(base));
diff({ userId: "u2" }, "user");
diff({ items: [{ variantId: "bpc-157-5mg", quantity: 3 }, { variantId: "tb-500-10mg", quantity: 1 }] }, "quantity");
diff({ items: [{ variantId: "other", quantity: 2 }, { variantId: "tb-500-10mg", quantity: 1 }] }, "variant");
diff({ discountCode: "OTHER" }, "discount");
diff({ redeemPoints: 200 }, "reward points");
diff({ referralCode: "NP-ZZZ" }, "referral");
diff({ shippingMethod: "overnight" }, "shipping method");
diff({ requestToken: "attempt-2" }, "attempt token");
check("different rail → different key (no cross-rail collision)",
  checkoutIdempotencyKey({ ...base, rail: "btcpay" }) !== checkoutIdempotencyKey({ ...base, rail: "stripe" }));

// ══ P1.1 — shape + hostile input ══════════════════════════════════════════
check("key is Stripe-header safe (ASCII, <255)", /^np_stripe_[a-f0-9]{48}$/.test(checkoutIdempotencyKey(base)));
check("oversized token can't blow up the key", checkoutIdempotencyKey({ ...base, requestToken: "z".repeat(10000) }).length < 100);
check("missing items doesn't throw", typeof checkoutIdempotencyKey({ userId: "u" }) === "string");
check("zero/negative quantities dropped",
  checkoutIdempotencyKey({ ...base, items: [...base.items, { variantId: "ghost", quantity: 0 }] }) ===
  checkoutIdempotencyKey(base));

// ══ P1.1 — wiring: BOTH the coupon and the session must be keyed ══════════
const stripeSrc = read("../../api/create-checkout-session.js");
check("session create is idempotent", /\}, \{ idempotencyKey \}\);/.test(stripeSrc));
check("COUPON create is idempotent (each attempt used to mint a new coupon)",
  stripeSrc.includes("idempotencyKey: `${idempotencyKey}_coupon`"));
check("key derived before anything is created",
  stripeSrc.indexOf("const idempotencyKey") < stripeSrc.indexOf("stripe.coupons.create"));
check("client sends a per-attempt token",
  read("../../src/pages/CheckoutTwoStep.jsx").includes("requestToken: requestTokenRef.current"));
check("token is per-attempt (useRef, not regenerated each render)",
  read("../../src/pages/CheckoutTwoStep.jsx").includes("const requestTokenRef = useRef("));

// ══ P1.2 — rails come from the server ═════════════════════════════════════
const railsApi = read("../../api/payment-rails.js");
const railsLib = read("../../src/lib/paymentRails.js");
const stepPay = read("../../src/components/checkout/StepPayment.jsx");
check("endpoint reports crypto only when BTCPay is fully configured",
  railsApi.includes("BTCPAY_URL && process.env.BTCPAY_API_KEY && process.env.BTCPAY_STORE_ID"));
check("endpoint reports card only when Stripe secret exists", railsApi.includes("STRIPE_SECRET_KEY"));
check("endpoint never leaks key material", !/BTCPAY_API_KEY\s*[,}]/.test(railsApi.split("json(res, 200")[1] || ""));
check("endpoint signals total unavailability", railsApi.includes("unavailable: rails.length === 0"));
check("card becomes primary when crypto is off", railsApi.includes("primary: !cryptoOn"));
check("client fetches rails from the server", railsLib.includes("fetch(\"/api/payment-rails\""));
check("offline fallback NEVER claims crypto", !/id: "crypto"/.test(railsLib));
check("StepPayment renders server rails", stepPay.includes("fetchPaymentRails()"));
check("StepPayment shows a maintenance state when nothing is payable", stepPay.includes("Payments are temporarily unavailable"));
check("StepPayment can't submit with no rails", stepPay.includes("!rails?.length"));
check("stale rail selection is corrected to a server-offered rail", stepPay.includes("ids.includes(selectedRail)"));
check("no hardcoded default rail remains",
  !read("../../src/pages/CheckoutTwoStep.jsx").includes('useState("crypto")'));

// ══ A5 — admin endpoints no longer echo provider internals ════════════════
for (const f of ["coa", "reviews", "ai-flags", "labels"]) {
  const src = read(`../../api/admin/${f}.js`);
  check(`admin/${f} has no raw error passthrough`,
    !/error:\s*(error|err|e)\.message/.test(src));
  check(`admin/${f} uses failSafely`, src.includes("failSafely("));
}

if (failed) { console.error(`\np1-checkout-hardening: ${failed} FAILED, ${passed} passed`); process.exit(1); }
console.log(`p1-checkout-hardening: all ${passed} assertions passed`);
