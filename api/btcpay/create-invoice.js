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
import { resolveOrigin, originUnconfigured } from "../../lib/siteOrigin.js";
import { resolveShipping } from "../../lib/shipping.js";
import { failSafely } from "../../lib/apiError.js";

const CRYPTO_DISCOUNT_PCT = Number(process.env.BTCPAY_CRYPTO_DISCOUNT_PCT || 5);
// Shipping constants intentionally REMOVED: they said free-over-$200 / $9 flat
// while the storefront said free-over-$250 / $16.95-$50. lib/shipping.js is now
// the single source of truth for both rails (audit P0.1).

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
  const {
    items,
    researchUseAcknowledged,
    discountCode,
    redeemPoints,
    referralCode,
    complianceId,
    shippingAddress,
    shippingMethod,
  } = body || {};
  if (!researchUseAcknowledged) {
    return json(res, 400, { error: "Research-use acknowledgment is required." });
  }
  if (!Array.isArray(items) || items.length === 0) {
    return json(res, 400, { error: "Invalid cart items" });
  }

  try {
    const { lines, eligibleSubtotal, fullSubtotal } = await priceLines(items);
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
    // P0.1: identical resolution to the card rail — same threshold, same
    // methods, same result. Threshold uses the pre-discount goods subtotal so
    // it matches the storefront's free-shipping nudge.
    const shipping = resolveShipping({
      methodId: shippingMethod,
      subtotalCents: Math.round(fullSubtotal * 100),
    });
    const amountCents = Math.max(0, Math.round(goods * 100)) + shipping.amountCents;
    const amount = amountCents / 100;
    if (amount <= 0) return json(res, 400, { error: "Cart total is zero." });

    // P0.2: trusted origin only (see lib/siteOrigin.js).
    if (originUnconfigured()) {
      return failSafely(res, {
        status: 503, code: "origin_unconfigured",
        message: "Crypto checkout is temporarily unavailable. Please try again shortly.",
        error: new Error("No SITE_URL/VERCEL_URL configured; refusing to build redirect URLs"),
        context: "btcpay-create-invoice",
      });
    }
    const origin = resolveOrigin(req);

    // Snapshot the priced line items + consent into the invoice metadata so the
    // settlement webhook can create the order WITHOUT trusting the client.
    const orderItems = lines.map((l) => ({
      name: `${l.product?.name || "Research material"} ${l.variant?.size_label || ""}`.trim(),
      sku: l.variant?.sku || "",
      quantity: l.qty,
      unit_dollars: l.unitDollars,
    }));

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
            cryptoDiscountPct: CRYPTO_DISCOUNT_PCT,
            // Carried to the settlement webhook (api/btcpay/webhook.js) so the
            // fulfilled order matches the card rail exactly.
            amountTotalCents: amountCents,
            shippingMethod: shipping.methodId,
            shippingCents: shipping.amountCents,
            orderItems,
            shippingAddress: shippingAddress || null,
            consent: {
              discount_code: adj.promoCode || "",
              discount_amount: adj.promoAmount || "",
              loyalty_points: adj.loyaltyPoints || "",
              loyalty_dollars: adj.loyaltyDollars || "",
              referral_code: referralCode
                ? String(referralCode).trim().toUpperCase().slice(0, 32)
                : "",
              compliance_id: complianceId ? String(complianceId).slice(0, 32) : "",
              attestation_version: ATTESTATION_VERSION,
              research_use_acknowledged: "true",
              research_use_only: "true",
              crypto_discount_pct: CRYPTO_DISCOUNT_PCT,
            },
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
    // P0.3: sanitized; full detail is logged against the request id.
    return failSafely(res, {
      status: 500, code: "crypto_checkout_failed",
      message: "We couldn't start the crypto invoice. Please try again, or contact support with this reference.",
      error: err, context: "btcpay-create-invoice",
    });
  }
}
