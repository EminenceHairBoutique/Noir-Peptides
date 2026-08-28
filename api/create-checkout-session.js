import Stripe from "stripe";
import { supabaseServer } from "../lib/supabaseServer.js";
import { requireUser } from "./_utils/auth.js";
import { checkRateLimit } from "./_utils/rateLimit.js";
import { ATTESTATION_VERSION } from "../lib/attestationStatements.js";
import { priceLines, computeAdjustments } from "../lib/pricing.js";
import { resolveOrigin, originUnconfigured } from "../lib/siteOrigin.js";
import { resolveShipping, stripeShippingOption } from "../lib/shipping.js";
import { failSafely } from "../lib/apiError.js";
import { checkoutIdempotencyKey } from "../lib/idempotency.js";
import { stripeLiveDisabled, warnIfStripeLiveDisabled } from "../lib/payments/providers.js";

// Pin the Stripe API version so behavior is stable across SDK upgrades.
const STRIPE_API_VERSION = "2024-06-20";

// Lazy-init: guard against missing key in local dev (no .env set up)
let _stripe = null;
function getStripe() {
  if (!process.env.STRIPE_SECRET_KEY) return null;
  if (!_stripe) {
    _stripe = new Stripe(process.env.STRIPE_SECRET_KEY, {
      apiVersion: STRIPE_API_VERSION,
    });
  }
  return _stripe;
}

export default async function handler(req, res) {
  return await createHandler(req, res);
}

export async function createHandler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  // Rate limit checkout session creation per IP.
  const allowed = await checkRateLimit(req, res, {
    endpoint: "checkout",
    max: 15,
    windowMs: 60_000,
  });
  if (!allowed) return;

  const stripe = getStripe();
  if (!stripe) {
    return res.status(503).json({
      error:
        "Stripe is not configured. Set STRIPE_SECRET_KEY in your .env.local file.",
    });
  }

  // Stripe live-key interlock: refuse to create a live session unless the
  // operator has explicitly accepted the ToS risk (see lib/payments/providers).
  // Fails closed BEFORE auth/pricing so a misconfigured live key can never take
  // a real payment.
  if (stripeLiveDisabled()) {
    warnIfStripeLiveDisabled();
    return res.status(503).json({ error: "stripe_live_disabled" });
  }

  // ── AUTH: identity is derived from the Supabase bearer token, never body ──
  const user = await requireUser(req, res);
  if (!user) return; // 401 already sent

  // ── ATTESTATION GATE: must be completed AND on the current version ────────
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
    return res.status(403).json({
      error:
        "A current research-use attestation is required before checkout. Please complete the attestation and try again.",
    });
  }

  try {
    const {
      items,
      researchUseAcknowledged,
      qualifiedPurchaserConfirmed,
      discountCode,
      redeemPoints,
      referralCode,
      complianceId,
      shippingMethod,
      requestToken,
    } = req.body || {};

    // Per-checkout acknowledgment (defense in depth on top of the gate).
    if (!researchUseAcknowledged) {
      return res.status(400).json({
        error: "Research-use acknowledgment is required before checkout.",
      });
    }

    if (!items || !Array.isArray(items) || items.length === 0) {
      return res.status(400).json({ error: "Invalid cart items" });
    }

    const userId = user.id;
    const customerEmail = user.email || profile?.email || null;

    // P0.2: origin comes from server config / an allowlist — NEVER from
    // request headers, which an attacker controls.
    if (originUnconfigured()) {
      return failSafely(res, {
        status: 503, code: "origin_unconfigured",
        message: "Checkout is temporarily unavailable. Please try again shortly.",
        error: new Error("No SITE_URL/VERCEL_URL configured; refusing to build redirect URLs"),
        context: "create-checkout-session",
      });
    }
    const origin = resolveOrigin(req);

    // Server-trusted re-pricing (shared with the BTCPay rail).
    const { lines, eligibleSubtotal, fullSubtotal } = await priceLines(items);

    const line_items = lines.map(({ variant, product, qty, unitDollars, image }) => {
      const imgPath = product.image_url || image || null;
      const img = imgPath
        ? String(imgPath).startsWith("http")
          ? imgPath
          : `${origin}${imgPath}`
        : null;
      const dose = variant.size_label || `${variant.vial_size_mg} mg`;
      return {
        price_data: {
          currency: "usd",
          product_data: {
            name: `${product.name || "Research material"} ${dose} — Research Use Only`,
            description:
              "Lyophilized research reference material. Not for human or veterinary use.",
            images: img ? [img] : [],
            metadata: {
              sku: variant.sku || "",
              batch_number: product.batch_number || "",
              cas_number: product.cas_number || "",
              research_use_only: "true",
            },
          },
          unit_amount: Math.round(unitDollars * 100),
        },
        quantity: qty,
      };
    });

    // P1.1: one stable key per checkout ATTEMPT. Passed to BOTH the coupon and
    // the session create, so a double-click/retry/second-tab returns Stripe's
    // existing objects instead of minting duplicates.
    const idempotencyKey = checkoutIdempotencyKey({
      userId, items, discountCode, redeemPoints, referralCode,
      shippingMethod, requestToken, rail: "stripe",
    });

    // Promo + loyalty → ONE Stripe coupon (all amounts server-derived).
    const adj = await computeAdjustments({
      userId,
      discountCode,
      redeemPoints,
      eligibleSubtotal,
      fullSubtotal,
    });
    if (!adj.ok) return res.status(400).json({ error: adj.error });
    const { promoCode, promoAmount, loyaltyPoints, loyaltyDollars, couponDollars } = adj;

    let appliedDiscount = null;
    const couponCents = Math.round(couponDollars * 100);
    if (couponCents > 0) {
      const coupon = await stripe.coupons.create(
        {
          amount_off: couponCents,
          currency: "usd",
          duration: "once",
          name: promoCode ? `${promoCode} + rewards` : "Research rewards",
        },
        { idempotencyKey: `${idempotencyKey}_coupon` }
      );
      appliedDiscount = { couponId: coupon.id, amount: couponDollars };
    }

    // ── US-only shipping (P0.1: server-authoritative) ───────────────────────
    // Charged shipping is resolved by lib/shipping.js from the SAME config the
    // storefront renders, so the free-shipping threshold and the customer's
    // selected method are actually honored. A pre-created Stripe rate id is NOT
    // used here: it is a single fixed rate and cannot express "free over
    // threshold" or a per-order method choice, which is what produced the
    // original mismatch.
    const shipping = resolveShipping({
      methodId: shippingMethod,
      subtotalCents: Math.round(fullSubtotal * 100),
    });
    const shippingOption = stripeShippingOption(shipping);

    const session = await stripe.checkout.sessions.create({
      payment_method_types: ["card"],
      line_items,
      mode: "payment",
      success_url: `${origin}/success?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${origin}/cancel`,
      // A server-applied coupon and allow_promotion_codes are mutually exclusive.
      ...(appliedDiscount
        ? { discounts: [{ coupon: appliedDiscount.couponId }] }
        : { allow_promotion_codes: true }),
      client_reference_id: String(userId),
      customer_email: customerEmail ? String(customerEmail) : undefined,
      shipping_address_collection: { allowed_countries: ["US"] },
      shipping_options: [shippingOption],
      metadata: {
        source: "noir_checkout",
        brand: "Noir Peptides",
        research_use_acknowledged: researchUseAcknowledged ? "true" : "false",
        qualified_purchaser_confirmed: qualifiedPurchaserConfirmed
          ? "true"
          : "false",
        research_use_only: "true",
        attestation_version: ATTESTATION_VERSION,
        user_id: String(userId),
        customer_email: customerEmail ? String(customerEmail) : "",
        discount_code: promoCode || "",
        discount_amount: promoAmount ? String(promoAmount) : "",
        loyalty_points: loyaltyPoints ? String(loyaltyPoints) : "",
        loyalty_dollars: loyaltyDollars ? String(loyaltyDollars) : "",
        referral_code: referralCode ? String(referralCode).trim().toUpperCase().slice(0, 32) : "",
        // Links the pre-payment compliance record (api/checkout-compliance.js)
        // to the order created by the webhook.
        compliance_id: complianceId ? String(complianceId).slice(0, 32) : "",
        shipping_method: shipping.methodId,
        shipping_cents: String(shipping.amountCents),
        shipping_free: shipping.free ? "true" : "false",
      },
    }, { idempotencyKey });

    res.json({ url: session.url });
  } catch (err) {
    // P0.3: never return provider/database internals to the customer.
    failSafely(res, {
      status: 500, code: "checkout_failed",
      message: "We couldn't start checkout. Please try again, or contact support with this reference.",
      error: err, context: "create-checkout-session", meta: { userId: user?.id },
    });
  }
}
