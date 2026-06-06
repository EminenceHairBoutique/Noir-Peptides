import Stripe from "stripe";
import { supabaseServer } from "../lib/supabaseServer.js";
import { requireUser } from "./_utils/auth.js";
import { checkRateLimit } from "./_utils/rateLimit.js";
import { ATTESTATION_VERSION } from "../lib/attestationStatements.js";
import { validateDiscount } from "../lib/discounts.js";
import { validateLoyaltyRedemption } from "../lib/rewards.js";

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

// ── Single server-trusted pricing path (variant + bundle tier) ────────────
// Identity + price are resolved from the RLS-gated Supabase tables via the
// service role — NEVER from the client body. The cart sends only stable
// identifiers (variantId / sku, quantity); the server re-prices.
async function resolveVariant({ variantId, sku }) {
  try {
    let query = supabaseServer
      .from("product_variants")
      .select(
        "id, product_id, sku, price, stock_status, vial_size_mg, size_label, " +
          "products ( name, image_url, batch_number, cas_number, is_bundle )"
      )
      .limit(1);
    query = variantId ? query.eq("id", variantId) : query.eq("sku", sku);
    const { data, error } = await query.maybeSingle();
    if (error || !data) return null;
    return data;
  } catch {
    return null;
  }
}

// Best bundle tier whose min_quantity <= qty; null if none (caller uses base).
async function resolveVariantUnitPrice(variantId, qty) {
  try {
    const { data } = await supabaseServer
      .from("price_tiers")
      .select("unit_price")
      .eq("variant_id", variantId)
      .lte("min_quantity", qty)
      .order("min_quantity", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (data && Number.isFinite(Number(data.unit_price))) return Number(data.unit_price);
  } catch {
    /* no tiers — caller falls back to base */
  }
  return null;
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

    // Eligible subtotal for promo codes that exclude bundles, and the full
    // subtotal (loyalty applies to the whole order). Both server-trusted.
    let eligibleSubtotal = 0;
    let fullSubtotal = 0;

    const line_items = await Promise.all(
      items.map(async (item) => {
        if ((!item?.variantId && !item?.sku) || !item.quantity) {
          throw new Error("Missing item fields (variantId/sku + quantity)");
        }

        const variant = await resolveVariant({
          variantId: item.variantId,
          sku: item.sku,
        });
        if (!variant) {
          throw new Error(`Unknown variant: ${item.variantId || item.sku}`);
        }
        if (variant.stock_status === "out_of_stock") {
          throw new Error(`Out of stock: ${variant.products?.name || variant.id}`);
        }

        const qty = Math.max(1, Math.min(99, Math.floor(Number(item.quantity))));

        // Server-trusted, tier-aware pricing for THIS variant (volume discounts
        // honored here — what's charged equals the displayed bundle price).
        const tierPrice = await resolveVariantUnitPrice(variant.id, qty);
        const unitDollars = tierPrice ?? Number(variant.price);
        const unitAmount = Math.round(Number(unitDollars) * 100);
        if (!Number.isFinite(unitAmount) || unitAmount <= 0) {
          throw new Error(`Invalid price for ${variant.id}`);
        }

        const product = variant.products || {};
        fullSubtotal += unitDollars * qty;
        if (!product.is_bundle) eligibleSubtotal += unitDollars * qty;
        const imgPath = product.image_url || item.image || null;
        const image = imgPath
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
              images: image ? [image] : [],
              metadata: {
                sku: variant.sku || "",
                batch_number: product.batch_number || "",
                cas_number: product.cas_number || "",
                research_use_only: "true",
              },
            },
            unit_amount: unitAmount,
          },
          quantity: qty,
        };
      })
    );

    // ── Server-validated promo code + loyalty redemption → ONE Stripe coupon ──
    // Promo amount is computed off the eligible (non-bundle) subtotal; loyalty
    // applies to the full subtotal. All amounts are derived server-side.
    let appliedDiscount = null;
    let promoCode = "";
    let promoAmount = 0;
    let loyaltyPoints = 0;
    let loyaltyDollars = 0;

    if (discountCode) {
      const v = await validateDiscount({ code: discountCode, userId, eligibleSubtotal });
      if (!v.ok) return res.status(400).json({ error: v.error });
      promoCode = v.code;
      promoAmount = Math.min(v.amount, eligibleSubtotal);
    }

    if (redeemPoints) {
      const maxDollars = Math.max(0, fullSubtotal - promoAmount);
      const r = await validateLoyaltyRedemption({ userId, points: redeemPoints, maxDollars });
      if (!r.ok) return res.status(400).json({ error: r.error });
      loyaltyPoints = r.points;
      loyaltyDollars = r.dollars;
    }

    const couponDollars = Math.min(promoAmount + loyaltyDollars, fullSubtotal);
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
      },
    });

    res.json({ url: session.url });
  } catch (err) {
    console.error("Stripe error:", err?.message || err);
    res.status(500).json({ error: err?.message || "Stripe error" });
  }
}
