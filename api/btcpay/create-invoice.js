// api/btcpay/create-invoice.js
// Crypto checkout via a self-hosted, non-custodial BTCPay Server (Greenfield
// API). Env-gated: returns 503 when BTCPay is not configured, so the rail
// degrades gracefully. Shares the SAME server-trusted pricing as the card
// checkout (lib/pricing.js) and applies an additional crypto discount, since
// crypto removes card fees + chargeback risk.
//
// Order creation/fulfillment for paid invoices happens via a BTCPay webhook
// (configure InvoiceSettled → /api/btcpay/webhook). That webhook is a follow-up;
// this endpoint creates the invoice and returns its checkout link.

import { supabaseServer } from "../../lib/supabaseServer.js";
import { requireUser } from "../_utils/auth.js";
import { checkRateLimit } from "../_utils/rateLimit.js";
import { readJsonBody, jsonResponse as json } from "../_utils/body.js";
import { ATTESTATION_VERSION } from "../../lib/attestationStatements.js";
import { priceLines, computeAdjustments } from "../../lib/pricing.js";

const CRYPTO_DISCOUNT_PCT = Number(process.env.BTCPAY_CRYPTO_DISCOUNT_PCT || 5);
const FREE_SHIP_THRESHOLD = 200;
const FLAT_SHIP = 9;

function btcpayConfigured() {
  return Boolean(
    process.env.BTCPAY_URL && process.env.BTCPAY_API_KEY && process.env.BTCPAY_STORE_ID
  );
}

export default async function handler(req, res) {
  if (req.method !== "POST") return json(res, 405, { error: "Method not allowed" });

  const allowed = await checkRateLimit(req, res, {
    endpoint: "btcpay",
    max: 15,
    windowMs: 60_000,
  });
  if (!allowed) return;

  if (!btcpayConfigured()) {
    return json(res, 503, {
      error: "Crypto checkout is not configured. Set BTCPAY_URL, BTCPAY_API_KEY, BTCPAY_STORE_ID.",
    });
  }

  const user = await requireUser(req, res);
  if (!user) return; // 401 already sent

  // Attestation gate (same as the card checkout).
  let profile = null;
  try {
    const { data } = await supabaseServer
      .from("profiles")
      .select("attestation_completed_at, attestation_version, email")
      .eq("id", user.id)
      .maybeSingle();
    profile = data;
  } catch {
    profile = null;
  }
  const attested =
    !!profile?.attestation_completed_at &&
    profile?.attestation_version === ATTESTATION_VERSION;
  if (!attested) {
    return json(res, 403, {
      error: "A current research-use attestation is required before checkout.",
    });
  }

  const body = await readJsonBody(req);
  const { items, researchUseAcknowledged, discountCode, redeemPoints } = body || {};
  if (!researchUseAcknowledged) {
    return json(res, 400, { error: "Research-use acknowledgment is required." });
  }
  if (!Array.isArray(items) || items.length === 0) {
    return json(res, 400, { error: "Invalid cart items" });
  }

  try {
    const { eligibleSubtotal, fullSubtotal } = await priceLines(items);
    const adj = await computeAdjustments({
      userId: user.id,
      discountCode,
      redeemPoints,
      eligibleSubtotal,
      fullSubtotal,
    });
    if (!adj.ok) return json(res, 400, { error: adj.error });

    const afterDiscounts = Math.max(0, fullSubtotal - adj.couponDollars);
    const cryptoDiscount = Math.round(afterDiscounts * (CRYPTO_DISCOUNT_PCT / 100) * 100) / 100;
    const goods = Math.max(0, afterDiscounts - cryptoDiscount);
    const shipping = goods >= FREE_SHIP_THRESHOLD ? 0 : FLAT_SHIP;
    const amount = Math.round((goods + shipping) * 100) / 100;
    if (amount <= 0) return json(res, 400, { error: "Cart total is zero." });

    const origin =
      req.headers.origin ||
      `https://${req.headers["x-forwarded-host"] || req.headers.host}`;

    const base = String(process.env.BTCPAY_URL).replace(/\/+$/, "");
    const resp = await fetch(
      `${base}/api/v1/stores/${process.env.BTCPAY_STORE_ID}/invoices`,
      {
        method: "POST",
        headers: {
          Authorization: `token ${process.env.BTCPAY_API_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          amount: amount.toFixed(2),
          currency: "USD",
          metadata: {
            buyerEmail: user.email || profile?.email || "",
            userId: user.id,
            researchUseOnly: "true",
            discountCode: adj.promoCode || "",
            loyaltyPoints: adj.loyaltyPoints || 0,
            cryptoDiscountPct: CRYPTO_DISCOUNT_PCT,
          },
          checkout: { redirectURL: `${origin}/success`, redirectAutomatically: true },
        }),
      }
    );

    if (!resp.ok) {
      console.error("BTCPay invoice error:", resp.status, await resp.text().catch(() => ""));
      return json(res, 502, { error: "Could not create the crypto invoice." });
    }
    const invoice = await resp.json();
    const url = invoice?.checkoutLink;
    if (!url) return json(res, 502, { error: "Crypto invoice link missing." });
    return json(res, 200, { url, amount });
  } catch (err) {
    console.error("BTCPay error:", err?.message || err);
    return json(res, 500, { error: err?.message || "Crypto checkout error" });
  }
}
