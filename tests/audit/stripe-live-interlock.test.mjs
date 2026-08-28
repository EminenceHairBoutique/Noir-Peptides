// tests/audit/stripe-live-interlock.test.mjs
// Task 3 of the Aug-26 audit remediation. Stripe's ToS prohibits this product
// category; a live Stripe rail enabled by accident risks account termination
// and a 90–180 day fund freeze. These tests prove the interlock:
//   - sk_test_ key                      → Stripe ENABLED (behaves as before)
//   - sk_live_ key, no ack              → Stripe DISABLED (rail omitted) + 503
//   - sk_live_ key, correct ack         → Stripe ENABLED
// Real modules, no mocks; env is manipulated per case. Style mirrors the
// sibling p0-payment-security.test.mjs.
import { readFileSync } from "node:fs";
import {
  stripeLiveDisabled,
  availableRails,
  getProvider,
  STRIPE_LIVE_ACK_VALUE,
} from "../../lib/payments/providers.js";

let passed = 0, failed = 0;
const check = (n, c) => { if (c) passed++; else { failed++; console.error(`  ✗ ${n}`); } };
const read = (p) => readFileSync(new URL(p, import.meta.url), "utf8");

const snap = { key: process.env.STRIPE_SECRET_KEY, ack: process.env.PAYMENTS_STRIPE_LIVE_ACK,
  bU: process.env.BTCPAY_URL, bK: process.env.BTCPAY_API_KEY, bS: process.env.BTCPAY_STORE_ID };
function setEnv({ key, ack, btcpay }) {
  if (key === null) delete process.env.STRIPE_SECRET_KEY; else process.env.STRIPE_SECRET_KEY = key;
  if (ack === null) delete process.env.PAYMENTS_STRIPE_LIVE_ACK; else process.env.PAYMENTS_STRIPE_LIVE_ACK = ack;
  if (btcpay) {
    process.env.BTCPAY_URL = "https://btcpay.example";
    process.env.BTCPAY_API_KEY = "token-xyz";
    process.env.BTCPAY_STORE_ID = "store-1";
  } else {
    delete process.env.BTCPAY_URL; delete process.env.BTCPAY_API_KEY; delete process.env.BTCPAY_STORE_ID;
  }
}
const stripeRail = () => availableRails().find((r) => r.id === "stripe");
const stripeConfigured = () => getProvider("stripe").isConfigured();

console.log("Stripe live-key interlock:");

// ── State 1: test key → enabled (unchanged behavior) ──────────────────────
setEnv({ key: "sk_test_abc123", ack: null, btcpay: false });
check("test key: stripeLiveDisabled() === false", stripeLiveDisabled() === false);
check("test key: stripe isConfigured", stripeConfigured() === true);
check("test key: stripe rail present", Boolean(stripeRail()));

// ── State 2: live key, NO ack → disabled + rail omitted ───────────────────
setEnv({ key: "sk_live_realmoney", ack: null, btcpay: false });
check("live key, no ack: stripeLiveDisabled() === true", stripeLiveDisabled() === true);
check("live key, no ack: stripe NOT configured", stripeConfigured() === false);
check("live key, no ack: stripe rail OMITTED from availableRails", !stripeRail());

// ── State 3: live key, correct ack → enabled ──────────────────────────────
setEnv({ key: "sk_live_realmoney", ack: STRIPE_LIVE_ACK_VALUE, btcpay: false });
check("live key + ack: stripeLiveDisabled() === false", stripeLiveDisabled() === false);
check("live key + ack: stripe configured", stripeConfigured() === true);
check("live key + ack: stripe rail present", Boolean(stripeRail()));

// ── Wrong ack value must NOT enable ──────────────────────────────────────
setEnv({ key: "sk_live_realmoney", ack: "yes please", btcpay: false });
check("live key + WRONG ack: still disabled", stripeLiveDisabled() === true && !stripeRail());

// ── BTCPay is listed FIRST everywhere ─────────────────────────────────────
setEnv({ key: "sk_test_abc123", ack: null, btcpay: true });
const rails = availableRails();
check("btcpay + stripe both live", rails.some((r) => r.id === "btcpay") && rails.some((r) => r.id === "stripe"));
check("btcpay is rail #1 (before stripe)",
  rails.findIndex((r) => r.id === "btcpay") === 0 &&
  rails.findIndex((r) => r.id === "btcpay") < rails.findIndex((r) => r.id === "stripe"));

// With a live-disabled Stripe, only BTCPay remains and is primary.
setEnv({ key: "sk_live_realmoney", ack: null, btcpay: true });
const railsLive = availableRails();
check("live-disabled: btcpay remains, stripe gone", railsLive.length === 1 && railsLive[0].id === "btcpay");

// ── Source guards: the wiring actually enforces this ──────────────────────
const checkoutSrc = read("../../api/create-checkout-session.js");
check("create-checkout-session imports the interlock", /stripeLiveDisabled/.test(checkoutSrc));
check("create-checkout-session returns 503 stripe_live_disabled",
  /stripe_live_disabled/.test(checkoutSrc) && /status\(503\)/.test(checkoutSrc));
const railsSrc = read("../../api/payment-rails.js");
check("payment-rails endpoint honors the interlock", /stripeLiveDisabled/.test(railsSrc));

// Restore env for any later suite in the same process.
setEnv({ key: snap.key ?? null, ack: snap.ack ?? null, btcpay: false });
if (snap.bU) { process.env.BTCPAY_URL = snap.bU; process.env.BTCPAY_API_KEY = snap.bK; process.env.BTCPAY_STORE_ID = snap.bS; }

const total = passed + failed;
if (failed) {
  console.error(`\n${failed}/${total} interlock assertions FAILED`);
  process.exit(1);
}
console.log(`\nAll ${total} Stripe live-key interlock assertions passed.`);
