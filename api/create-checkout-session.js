import Stripe from "stripe";
import { supabaseServer } from "../lib/supabaseServer.js";
import { requireUser } from "./_utils/auth.js";
import { checkRateLimit } from "./_utils/rateLimit.js";
import { ATTESTATION_VERSION } from "../lib/attestationStatements.js";
import { priceLines, computeAdjustments } from "../lib/pricing.js";

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

    const origin =
      req.headers.origin ||
      `https://${req.headers["x-forwarded-host"] || req.headers.host}`;

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
      const coupon = await stripe.coupons.create({
        amount_off: couponCents,
        currency: "usd",
        duration: "once",
        name: promoCode ? `${promoCode} + rewards` : "Research rewards",
      });
      appliedDiscount = { couponId: coupon.id, amount: couponDollars };
    }

    // ── US-only shipping ────────────────────────────────────────────────────
    // Restrict the address Stripe collects to the US, and attach a shipping
    // rate (a pre-created rate id when available, else an inline flat rate).
    const shippingOption = process.env.STRIPE_US_SHIPPING_RATE_ID
      ? { shipping_rate: process.env.STRIPE_US_SHIPPING_RATE_ID }
      : {
          shipping_rate_data: {
            type: "fixed_amount",
            display_name: "Standard US Shipping",
            fixed_amount: { amount: 900, currency: "usd" },
            delivery_estimate: {
              minimum: { unit: "business_day", value: 2 },
              maximum: { unit: "business_day", value: 5 },
            },
          },
        };

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
      },
    });

    res.json({ url: session.url });
  } catch (err) {
    console.error("Stripe error:", err?.message || err);
    res.status(500).json({ error: err?.message || "Stripe error" });
  }
}
