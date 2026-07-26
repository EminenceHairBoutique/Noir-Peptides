// lib/pricing.js
// Shared server-trusted pricing for all payment rails (Stripe, BTCPay). Identity
// and price come from the RLS-gated Supabase tables via the service role — never
// from the client. The cart sends only variantId/sku + quantity.

import { supabaseServer } from "./supabaseServer.js";
import { validateDiscount } from "./discounts.js";
import { validateLoyaltyRedemption } from "./rewards.js";

const round2 = (n) => Math.round(Number(n) * 100) / 100;

export async function resolveVariant({ variantId, sku }) {
  try {
    let query = supabaseServer
      .from("product_variants")
      .select(
        "id, product_id, sku, price, stock_status, vial_size_mg, size_label, " +
          "inventory_count, low_stock_threshold, " +
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
export async function resolveVariantUnitPrice(variantId, qty) {
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

/**
 * Re-price cart items server-side. Throws on a bad/unknown/out-of-stock item.
 * @returns {Promise<{lines:Array, eligibleSubtotal:number, fullSubtotal:number}>}
 */
export async function priceLines(items) {
  let eligibleSubtotal = 0;
  let fullSubtotal = 0;
  const lines = [];

  for (const item of items) {
    if ((!item?.variantId && !item?.sku) || !item.quantity) {
      throw new Error("Missing item fields (variantId/sku + quantity)");
    }
    const variant = await resolveVariant({ variantId: item.variantId, sku: item.sku });
    if (!variant) throw new Error(`Unknown variant: ${item.variantId || item.sku}`);
    if (variant.stock_status === "out_of_stock") {
      throw new Error(`Out of stock: ${variant.products?.name || variant.id}`);
    }
    const qty = Math.max(1, Math.min(99, Math.floor(Number(item.quantity))));
    // Oversell guard for tracked variants (inventory_count NULL = untracked,
    // manual stock_status only — no cap). Both payment rails inherit this.
    if (variant.inventory_count !== null && variant.inventory_count !== undefined) {
      const available = Math.max(0, Math.floor(Number(variant.inventory_count)));
      if (qty > available) {
        throw new Error(
          `Insufficient stock for ${variant.products?.name || variant.id} (${variant.size_label || variant.sku}): ` +
            `${available} available, ${qty} requested.`
        );
      }
    }
    const tierPrice = await resolveVariantUnitPrice(variant.id, qty);
    const unitDollars = tierPrice ?? Number(variant.price);
    if (!Number.isFinite(unitDollars) || unitDollars <= 0) {
      throw new Error(`Invalid price for ${variant.id}`);
    }
    const product = variant.products || {};
    fullSubtotal += unitDollars * qty;
    if (!product.is_bundle) eligibleSubtotal += unitDollars * qty;
    lines.push({ variant, product, qty, unitDollars, image: item.image || null });
  }

  return { lines, eligibleSubtotal: round2(eligibleSubtotal), fullSubtotal: round2(fullSubtotal) };
}

/**
 * Validate + compute promo + loyalty adjustments against server-trusted subtotals.
 * @returns {Promise<{ok:boolean, error?:string, couponDollars?:number, promoCode?:string, promoAmount?:number, loyaltyPoints?:number, loyaltyDollars?:number}>}
 */
export async function computeAdjustments({
  userId,
  discountCode,
  redeemPoints,
  eligibleSubtotal,
  fullSubtotal,
}) {
  let promoCode = "";
  let promoAmount = 0;
  let loyaltyPoints = 0;
  let loyaltyDollars = 0;

  if (discountCode) {
    const v = await validateDiscount({ code: discountCode, userId, eligibleSubtotal });
    if (!v.ok) return { ok: false, error: v.error };
    promoCode = v.code;
    promoAmount = Math.min(v.amount, eligibleSubtotal);
  }
  if (redeemPoints) {
    const maxDollars = Math.max(0, fullSubtotal - promoAmount);
    const r = await validateLoyaltyRedemption({ userId, points: redeemPoints, maxDollars });
    if (!r.ok) return { ok: false, error: r.error };
    loyaltyPoints = r.points;
    loyaltyDollars = r.dollars;
  }
  return {
    ok: true,
    couponDollars: round2(Math.min(promoAmount + loyaltyDollars, fullSubtotal)),
    promoCode,
    promoAmount: round2(promoAmount),
    loyaltyPoints,
    loyaltyDollars: round2(loyaltyDollars),
  };
}
