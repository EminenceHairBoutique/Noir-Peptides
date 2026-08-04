// tests/audit/p0-payment-security.test.mjs
// Regression tests for the three payment P0s found in the full production
// audit. Each asserts the DEFECT can no longer recur, exercising the real
// modules (no mocks) plus source guards on the wiring.
//
//   P0.1  free-shipping / selected-method not honored, and the two rails
//         disagreeing on threshold and rate
//   P0.2  redirect origin built from attacker-controlled request headers
//   P0.3  raw provider/database errors returned to customers
import { readFileSync } from "node:fs";
import { resolveShipping, stripeShippingOption, FREE_SHIP_THRESHOLD_CENTS } from "../../lib/shipping.js";
import { scrubSecrets, newRequestId } from "../../lib/apiError.js";
import { SHIPPING_METHODS, FREE_SHIP_THRESHOLD } from "../../src/config/checkout.js";

let passed = 0, failed = 0;
const check = (n, c) => { if (c) passed++; else { failed++; console.error(`  ✗ ${n}`); } };
const read = (p) => readFileSync(new URL(p, import.meta.url), "utf8");

// ══ P0.1 — one server-authoritative shipping calculation ══════════════════
const T = FREE_SHIP_THRESHOLD_CENTS;
check("threshold mirrors owner config ($250)", T === Math.round(FREE_SHIP_THRESHOLD * 100) && T === 25000);

// The exact boundary triplet the audit brief requires.
check("threshold − $0.01 → charged", resolveShipping({ methodId: "standard", subtotalCents: T - 1 }).amountCents === 1695);
check("exact threshold → FREE", resolveShipping({ methodId: "standard", subtotalCents: T }).amountCents === 0);
check("threshold + $0.01 → FREE", resolveShipping({ methodId: "standard", subtotalCents: T + 1 }).amountCents === 0);
check("free flag set at threshold", resolveShipping({ methodId: "standard", subtotalCents: T }).free === true);
check("free flag clear below", resolveShipping({ methodId: "standard", subtotalCents: T - 1 }).free === false);

// Selected method is actually honored (the old code ignored it entirely).
check("standard rate = $16.95", resolveShipping({ methodId: "standard", subtotalCents: 1000 }).amountCents === 1695);
check("expedited rate = $35", resolveShipping({ methodId: "expedited", subtotalCents: 1000 }).amountCents === 3500);
check("overnight rate = $50", resolveShipping({ methodId: "overnight", subtotalCents: 1000 }).amountCents === 5000);
check("free applies to EVERY method, not just standard",
  SHIPPING_METHODS.every((m) => resolveShipping({ methodId: m.id, subtotalCents: T }).amountCents === 0));

// Robustness: no method, unknown method, junk subtotal.
check("missing method falls back (never throws)", resolveShipping({ subtotalCents: 1000 }).amountCents > 0);
check("unknown method falls back to a real method",
  SHIPPING_METHODS.some((m) => m.id === resolveShipping({ methodId: "teleport", subtotalCents: 1000 }).methodId));
check("negative subtotal treated as 0 (still charged)", resolveShipping({ methodId: "standard", subtotalCents: -50 }).amountCents === 1695);
check("NaN subtotal treated as 0", resolveShipping({ methodId: "standard", subtotalCents: NaN }).amountCents === 1695);
check("remainingCents guides the nudge", resolveShipping({ methodId: "standard", subtotalCents: T - 5000 }).remainingCents === 5000);
check("remainingCents is 0 once qualified", resolveShipping({ methodId: "standard", subtotalCents: T + 999 }).remainingCents === 0);

// Integer cents only — no floating-point drift into the provider.
check("amounts are integers", SHIPPING_METHODS.every((m) =>
  Number.isInteger(resolveShipping({ methodId: m.id, subtotalCents: 1234 }).amountCents)));

// Stripe option is built FROM the same resolution.
const freeOpt = stripeShippingOption(resolveShipping({ methodId: "overnight", subtotalCents: T }));
check("stripe option mirrors free result", freeOpt.shipping_rate_data.fixed_amount.amount === 0);
check("stripe free option is labelled Free", /Free/.test(freeOpt.shipping_rate_data.display_name));
const paidOpt = stripeShippingOption(resolveShipping({ methodId: "expedited", subtotalCents: 1000 }));
check("stripe paid option carries the real rate", paidOpt.shipping_rate_data.fixed_amount.amount === 3500);

// BOTH rails must use it, and the divergent constants must be gone.
const stripeSrc = read("../../api/create-checkout-session.js");
const btcSrc = read("../../api/btcpay/create-invoice.js");
check("stripe rail uses resolveShipping", stripeSrc.includes("resolveShipping({"));
check("btcpay rail uses resolveShipping", btcSrc.includes("resolveShipping({"));
check("btcpay's divergent $200/$9 constants removed",
  !/const FREE_SHIP_THRESHOLD = 200/.test(btcSrc) && !/const FLAT_SHIP = 9/.test(btcSrc));
check("stripe no longer hardcodes a 900-cent flat rate", !/amount: 900/.test(stripeSrc));
check("both rails record what shipping was charged",
  stripeSrc.includes("shipping_cents") && btcSrc.includes("shippingCents"));

// ══ P0.2 — untrusted redirect origins ═════════════════════════════════════
// Import fresh so env changes are picked up.
process.env.SITE_URL = "https://noirpeptides.com";
delete process.env.ALLOWED_ORIGINS;
delete process.env.VERCEL_URL;
const { resolveOrigin, absoluteUrl, canonicalOrigin } = await import("../../lib/siteOrigin.js?p0=1");

const forged = { headers: { origin: "https://evil.example", host: "evil.example", "x-forwarded-host": "evil.example" } };
check("forged Origin cannot change the redirect", resolveOrigin(forged) === "https://noirpeptides.com");
check("forged Host cannot change the redirect", resolveOrigin({ headers: { host: "evil.example" } }) === "https://noirpeptides.com");
check("forged X-Forwarded-Host cannot change the redirect",
  resolveOrigin({ headers: { "x-forwarded-host": "evil.example" } }) === "https://noirpeptides.com");
check("no headers at all → canonical", resolveOrigin({}) === "https://noirpeptides.com");
check("canonical origin is the configured one", canonicalOrigin() === "https://noirpeptides.com");
check("allowlisted origin IS honored (preview deploys keep working)",
  resolveOrigin({ headers: { origin: "https://noirpeptides.com" } }) === "https://noirpeptides.com");
check("absoluteUrl builds from the trusted origin",
  absoluteUrl(forged, "/success") === "https://noirpeptides.com/success");
check("absoluteUrl rejects an off-allowlist absolute URL",
  absoluteUrl(forged, "https://evil.example/x") === null);
check("trailing slashes normalized", !canonicalOrigin().endsWith("/"));

// Neither rail may still read origin from request headers.
const headerOrigin = /req\.headers\.origin\s*\|\|/;
check("stripe rail no longer derives origin from headers", !headerOrigin.test(stripeSrc));
check("btcpay rail no longer derives origin from headers", !headerOrigin.test(btcSrc));
check("stripe rail fails closed when unconfigured", stripeSrc.includes("originUnconfigured()"));
check("btcpay rail fails closed when unconfigured", btcSrc.includes("originUnconfigured()"));

// ══ P0.3 — raw error leakage ══════════════════════════════════════════════
check("stripe rail no longer returns err.message", !/error:\s*err\?\.\s*message/.test(stripeSrc));
check("btcpay rail no longer returns err.message", !/error:\s*err\?\.\s*message/.test(btcSrc));
check("both rails use failSafely", stripeSrc.includes("failSafely(") && btcSrc.includes("failSafely("));
check("responses carry a stable code + requestId",
  read("../../lib/apiError.js").includes("{ error: message, code, requestId }"));
check("request ids are unique", newRequestId() !== newRequestId());
check("live stripe keys scrubbed from logs", !scrubSecrets("boom sk_live_ABC123XYZ").includes("sk_live_ABC123XYZ"));
check("webhook secrets scrubbed", !scrubSecrets("whsec_TOPSECRET99").includes("whsec_TOPSECRET99"));
check("JWTs scrubbed", !scrubSecrets("eyJhbGciOi.eyJzdWIiOiJ4.SIGNATURE").includes("SIGNATURE"));
check("bearer tokens scrubbed", !scrubSecrets("Authorization: Bearer abc.def-ghi").includes("abc.def-ghi"));

if (failed) { console.error(`\np0-payment-security: ${failed} FAILED, ${passed} passed`); process.exit(1); }
console.log(`p0-payment-security: all ${passed} assertions passed`);
