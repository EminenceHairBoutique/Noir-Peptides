/*
  scripts/test-crypto-incentive.mjs
  The crypto discount is a MONEY figure shown to a customer before they pay, so
  the number advertised and the number applied must come from one place and be
  impossible to set from the browser.

  This executes the real api/payment-rails.js handler under manipulated env, and
  statically audits api/btcpay/create-invoice.js, to prove:
    - the advertised percentage is the server env, never a request field;
    - the incentive disappears entirely when the crypto rail is not configured
      (the exact bug that once sent customers to a 503);
    - the endpoint leaks no key material;
    - the invoice derives its discount from the same env constant.

  Run: node scripts/test-crypto-incentive.mjs   (in npm run test:unit)
*/
import { readFileSync } from "node:fs";

let failures = 0;
const ok = (m) => console.log(`  ✓ ${m}`);
const fail = (m) => {
  failures++;
  console.error(`  ✗ ${m}`);
};
const assert = (c, m) => (c ? ok(m) : fail(m));

const handler = (await import("../api/payment-rails.js")).default;

// Minimal res double capturing status + JSON payload.
function makeRes() {
  const res = {
    statusCode: null,
    payload: null,
    headers: {},
    setHeader(k, v) {
      this.headers[k] = v;
    },
    status(c) {
      this.statusCode = c;
      return this;
    },
    json(p) {
      this.payload = p;
      return this;
    },
    end(p) {
      if (p && this.payload === null) {
        try {
          this.payload = JSON.parse(p);
        } catch {
          this.payload = p;
        }
      }
      return this;
    },
  };
  return res;
}

const BTCPAY_ENV = {
  BTCPAY_URL: "https://btcpay.example.test",
  BTCPAY_API_KEY: "test-api-key-not-real",
  BTCPAY_STORE_ID: "store-123",
};

async function callRails(env) {
  const saved = {};
  const keys = [
    "BTCPAY_URL",
    "BTCPAY_API_KEY",
    "BTCPAY_STORE_ID",
    "BTCPAY_CRYPTO_DISCOUNT_PCT",
    "STRIPE_SECRET_KEY",
    "PAYMENTS_STRIPE_LIVE_ACK",
  ];
  for (const k of keys) {
    saved[k] = process.env[k];
    if (env[k] === undefined) delete process.env[k];
    else process.env[k] = String(env[k]);
  }
  const res = makeRes();
  await handler({ method: "GET" }, res);
  for (const k of keys) {
    if (saved[k] === undefined) delete process.env[k];
    else process.env[k] = saved[k];
  }
  return res;
}

// ── 1. Discount is advertised only when the rail is real ──
console.log("Crypto incentive is gated on a configured rail:");
{
  const res = await callRails({ BTCPAY_CRYPTO_DISCOUNT_PCT: 7 });
  assert(res.payload.cryptoDiscountPct === 0, "BTCPay unconfigured → cryptoDiscountPct 0 (no incentive advertised)");
  assert(
    !res.payload.rails.some((r) => r.id === "crypto"),
    "BTCPay unconfigured → no crypto rail offered (the 503 bug stays fixed)"
  );
}
{
  const res = await callRails({ ...BTCPAY_ENV, BTCPAY_CRYPTO_DISCOUNT_PCT: 7 });
  assert(res.payload.cryptoDiscountPct === 7, "BTCPay configured → advertised pct is the server env (7)");
  const rail = res.payload.rails.find((r) => r.id === "crypto");
  assert(Boolean(rail), "BTCPay configured → crypto rail offered");
  assert(rail.note.includes("7%"), "rail note quotes the SAME percentage, not a hardcoded default");
  assert(rail.primary === true, "crypto is the primary rail when live");
}
{
  const res = await callRails({ ...BTCPAY_ENV });
  assert(res.payload.cryptoDiscountPct === 5, "unset BTCPAY_CRYPTO_DISCOUNT_PCT → documented 5% default");
}
{
  // A partially-configured BTCPay must not count as live.
  const res = await callRails({ BTCPAY_URL: BTCPAY_ENV.BTCPAY_URL, BTCPAY_API_KEY: BTCPAY_ENV.BTCPAY_API_KEY });
  assert(res.payload.cryptoDiscountPct === 0, "missing BTCPAY_STORE_ID → not live, no incentive");
}

// ── 2. The endpoint leaks nothing ──
console.log("\nNo secret material in the public rails response:");
{
  const res = await callRails({ ...BTCPAY_ENV, STRIPE_SECRET_KEY: "sk_test_deadbeefsecret" });
  const body = JSON.stringify(res.payload);
  assert(!body.includes("test-api-key-not-real"), "BTCPAY_API_KEY absent from the response");
  assert(!body.includes("store-123"), "BTCPAY_STORE_ID absent from the response");
  assert(!body.includes("sk_test_deadbeefsecret"), "STRIPE_SECRET_KEY absent from the response");
  assert(!body.includes("btcpay.example.test"), "BTCPAY_URL absent from the response");
  assert(res.statusCode === 200, "GET returns 200");
}
{
  const res = makeRes();
  await handler({ method: "POST" }, res);
  assert(res.statusCode === 405, "non-GET rejected with 405");
}

// ── 3. The invoice derives the discount from the same env, not the request ──
console.log("\nInvoice applies the discount server-side:");
{
  const src = readFileSync(new URL("../api/btcpay/create-invoice.js", import.meta.url), "utf8");
  assert(
    /const CRYPTO_DISCOUNT_PCT\s*=\s*Number\(process\.env\.BTCPAY_CRYPTO_DISCOUNT_PCT/.test(src),
    "discount percentage is read from process.env, at module scope"
  );
  assert(
    !/(body|req\.body|payload)\s*[.[]\s*["']?crypto(Discount|_discount)/i.test(src),
    "no crypto discount value is ever read off the request body"
  );
  assert(
    /cryptoDiscount\s*=\s*Math\.round\(\s*afterDiscounts\s*\*\s*\(\s*CRYPTO_DISCOUNT_PCT\s*\/\s*100\s*\)/.test(src),
    "discount is computed from the server-priced subtotal (afterDiscounts), not a client total"
  );
  assert(
    /const \{ lines, eligibleSubtotal, fullSubtotal \} = await priceLines\(items\)/.test(src),
    "the subtotal it discounts is itself re-priced server-side by priceLines()"
  );
  assert(
    /amountCents\s*=\s*Math\.max\(0,\s*Math\.round\(goods \* 100\)\)\s*\+\s*shipping\.amountCents/.test(src),
    "shipping is added AFTER the discount — the discount never applies to shipping"
  );
  // The saving must never exceed the goods value.
  assert(/const goods = Math\.max\(0, afterDiscounts - cryptoDiscount\)/.test(src), "goods total is floored at zero");
}

// ── 4. The client component cannot invent a percentage ──
console.log("\nClient incentive component is server-driven:");
{
  const src = readFileSync(new URL("../src/components/CryptoIncentive.jsx", import.meta.url), "utf8");
  assert(/fetchPaymentRails\(\)/.test(src), "percentage comes from fetchPaymentRails()");
  assert(
    !/\b(5|7|10)\s*%/.test(src.replace(/\/\/[^\n]*/g, "").replace(/\/\*[\s\S]*?\*\//g, "")),
    "no hardcoded percentage literal in the rendered output"
  );
  assert(/if \(!\(pct > 0\)\) return null;/.test(src), "renders nothing when the server reports no discount");
  assert(/d\?\.degraded/.test(src), "renders nothing when the rails lookup was degraded/unreachable");
  assert(
    /r\.id === "crypto"/.test(src),
    "renders only when a crypto rail is actually present in the server's list"
  );
}

if (failures) {
  console.error(`\n${failures} crypto-incentive check(s) FAILED`);
  process.exit(1);
}
console.log("\nAll crypto-incentive checks passed.");
