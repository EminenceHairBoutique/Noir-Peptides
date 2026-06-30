// lib/payments/providers.js
// Payment-provider abstraction. Processors get terminated in the peptide
// vertical with some regularity, so checkout must never hard-code one. Each
// provider conforms to a common interface and reports whether it is configured;
// the checkout UI renders the rails that are live (api/payments/rails.js) and a
// new processor slots in by adding an adapter here + its env — no checkout-UI
// change.
//
// Interface (per provider):
//   id            string
//   label         string                       UI label
//   kind          'crypto' | 'card' | 'ach'
//   primary       boolean                       default rail when nothing else live
//   isConfigured()        -> boolean
//   createChargeEndpoint  string                POST endpoint the client calls to start payment
//   webhookEndpoint       string|null           provider → our settlement webhook
//   getStatus(ref)        -> Promise<string>    normalized status ('paid'|'pending'|'unknown'|…)
//   refund(ref, opts)     -> Promise<{ok,...}>
//
// HONEST RAILS ONLY. No transaction-obfuscation / card-to-stablecoin "disguise"
// gateways. Crypto = the customer knowingly pays in crypto. Card/ACH = honestly
// underwritten high-risk processors. Apple/Google Pay, when enabled, are
// tokenized cards on the live card processor — NOT a separate rail and NOT a way
// to bypass processor restrictions.

import Stripe from "stripe";

const STRIPE_API_VERSION = "2024-06-20";
let _stripe = null;
function stripeClient() {
  if (!process.env.STRIPE_SECRET_KEY) return null;
  if (!_stripe) _stripe = new Stripe(process.env.STRIPE_SECRET_KEY, { apiVersion: STRIPE_API_VERSION });
  return _stripe;
}

function btcpayBase() {
  return String(process.env.BTCPAY_URL || "").replace(/\/+$/, "");
}
async function btcpayFetch(path, init = {}) {
  return fetch(`${btcpayBase()}${path}`, {
    ...init,
    headers: { Authorization: `token ${process.env.BTCPAY_API_KEY}`, ...(init.headers || {}) },
  });
}

const notConfigured = (id) => async () => {
  throw new Error(`Payment provider "${id}" is not configured.`);
};

export const PROVIDERS = [
  {
    id: "btcpay",
    label: "Pay with crypto (BTC, ETH, USDC, USDT)",
    kind: "crypto",
    primary: true,
    createChargeEndpoint: "/api/btcpay/create-invoice",
    webhookEndpoint: "/api/btcpay/webhook",
    isConfigured: () =>
      Boolean(process.env.BTCPAY_URL && process.env.BTCPAY_API_KEY && process.env.BTCPAY_STORE_ID),
    async getStatus(invoiceId) {
      try {
        const r = await btcpayFetch(`/api/v1/stores/${process.env.BTCPAY_STORE_ID}/invoices/${invoiceId}`);
        if (!r.ok) return "unknown";
        const inv = await r.json();
        return inv.status === "Settled" ? "paid" : String(inv.status || "unknown").toLowerCase();
      } catch {
        return "unknown";
      }
    },
    async refund(invoiceId) {
      // Crypto refunds are issued from BTCPay as a pull-payment; this records the
      // intent. Operationally the owner approves the payout in BTCPay.
      try {
        const r = await btcpayFetch(
          `/api/v1/stores/${process.env.BTCPAY_STORE_ID}/invoices/${invoiceId}/refund`,
          { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ refundVariant: "Fiat" }) }
        );
        if (!r.ok) return { ok: false, error: await r.text().catch(() => "refund failed") };
        return { ok: true, data: await r.json() };
      } catch (e) {
        return { ok: false, error: e?.message || "refund error" };
      }
    },
  },
  {
    id: "stripe",
    label: "Credit or debit card",
    kind: "card",
    createChargeEndpoint: "/api/create-checkout-session",
    webhookEndpoint: "/api/stripe-webhook",
    isConfigured: () => Boolean(process.env.STRIPE_SECRET_KEY),
    async getStatus(sessionId) {
      const s = stripeClient();
      if (!s) return "unknown";
      try {
        const session = await s.checkout.sessions.retrieve(sessionId);
        return session.payment_status === "paid" ? "paid" : String(session.payment_status || "unknown");
      } catch {
        return "unknown";
      }
    },
    async refund(sessionId, { amountCents } = {}) {
      const s = stripeClient();
      if (!s) return { ok: false, error: "stripe not configured" };
      try {
        const session = await s.checkout.sessions.retrieve(sessionId);
        const pi = session.payment_intent;
        if (!pi) return { ok: false, error: "no payment intent" };
        const refund = await s.refunds.create({ payment_intent: pi, ...(amountCents ? { amount: amountCents } : {}) });
        return { ok: true, data: refund };
      } catch (e) {
        return { ok: false, error: e?.message || "refund error" };
      }
    },
  },
  {
    // High-risk card processor (e.g. PaymentCloud / AllayPay / Authorize.net-
    // style). Adapter slot — credentials supplied after underwriting. When live,
    // Apple/Google Pay ride this processor as tokenized cards.
    id: "card",
    label: "Credit or debit card",
    kind: "card",
    createChargeEndpoint: "/api/card/create-charge",
    webhookEndpoint: "/api/card/webhook",
    isConfigured: () => Boolean(process.env.HIGHRISK_CARD_API_KEY),
    getStatus: notConfigured("card"),
    refund: notConfigured("card"),
  },
  {
    // ACH / eCheck failsafe rail for larger orders (e.g. SeamlessChex-style).
    id: "ach",
    label: "Bank transfer (ACH / eCheck)",
    kind: "ach",
    createChargeEndpoint: "/api/ach/create-charge",
    webhookEndpoint: "/api/ach/webhook",
    isConfigured: () => Boolean(process.env.ACH_API_KEY),
    getStatus: notConfigured("ach"),
    refund: notConfigured("ach"),
  },
];

export function getProvider(id) {
  return PROVIDERS.find((p) => p.id === id) || null;
}

// Rails that are configured/live right now, for the dynamic checkout UI. Falls
// back to crypto-first ordering. Returns lightweight, client-safe descriptors
// (no secrets).
export function availableRails() {
  const live = PROVIDERS.filter((p) => p.isConfigured());
  // De-dupe card label if both stripe and the high-risk card adapter are live
  // (prefer the dedicated card processor when present).
  const hasHighRiskCard = live.some((p) => p.id === "card");
  return live
    .filter((p) => !(p.id === "stripe" && hasHighRiskCard))
    .map((p) => ({ id: p.id, label: p.label, kind: p.kind, primary: !!p.primary, endpoint: p.createChargeEndpoint }));
}
