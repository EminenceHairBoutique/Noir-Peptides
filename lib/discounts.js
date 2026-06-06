// lib/discounts.js
// Server-side promo-code validation (service role). Never trust a client price
// or a client-computed discount — the eligible subtotal is computed server-side
// from re-priced line items, and the discount amount is derived here.

import { supabaseServer } from "./supabaseServer.js";

/**
 * Validate a promo code and compute its dollar amount against an eligible
 * subtotal (bundles/kits are excluded by the caller before this is called when
 * the code has excludes_bundles).
 *
 * @param {object} args
 * @param {string} args.code
 * @param {string|null} args.userId
 * @param {number} args.eligibleSubtotal  dollars (non-bundle lines when excluded)
 * @returns {Promise<{ok:boolean, error?:string, code?:string, kind?:string, amount?:number}>}
 */
export async function validateDiscount({ code, userId, eligibleSubtotal }) {
  const norm = String(code || "").trim().toUpperCase();
  if (!norm) return { ok: false, error: "Enter a code." };
  if (!(eligibleSubtotal > 0)) {
    return { ok: false, error: "No eligible items for this code." };
  }

  let d;
  try {
    const { data } = await supabaseServer
      .from("discounts")
      .select("*")
      .eq("code", norm)
      .maybeSingle();
    d = data;
  } catch {
    return { ok: false, error: "Could not validate code." };
  }
  if (!d || !d.active) return { ok: false, error: "Invalid or inactive code." };

  const now = Date.now();
  if (d.starts_at && now < Date.parse(d.starts_at)) {
    return { ok: false, error: "This code is not active yet." };
  }
  if (d.ends_at && now > Date.parse(d.ends_at)) {
    return { ok: false, error: "This code has expired." };
  }
  if (Number(eligibleSubtotal) < Number(d.min_subtotal || 0)) {
    return {
      ok: false,
      error: `Minimum eligible subtotal of $${Number(d.min_subtotal)} required.`,
    };
  }

  // Redemption caps.
  try {
    if (d.max_redemptions != null) {
      const { count } = await supabaseServer
        .from("discount_redemptions")
        .select("id", { count: "exact", head: true })
        .eq("discount_id", d.id);
      if ((count || 0) >= d.max_redemptions) {
        return { ok: false, error: "This code has reached its redemption limit." };
      }
    }
    if (d.per_user_limit != null && userId) {
      const { count } = await supabaseServer
        .from("discount_redemptions")
        .select("id", { count: "exact", head: true })
        .eq("discount_id", d.id)
        .eq("user_id", userId);
      if ((count || 0) >= d.per_user_limit) {
        return { ok: false, error: "You have already used this code." };
      }
    }
  } catch {
    /* if redemption table is unavailable, do not block — fail open on caps */
  }

  const subtotal = Number(eligibleSubtotal);
  let amount =
    d.kind === "percent"
      ? (subtotal * Number(d.value)) / 100
      : Math.min(Number(d.value), subtotal);
  amount = Math.max(0, Math.round(amount * 100) / 100);
  if (amount <= 0) return { ok: false, error: "This code yields no discount here." };

  return { ok: true, id: d.id, code: norm, kind: d.kind, value: Number(d.value), amount, excludes_bundles: d.excludes_bundles };
}

/** Record a redemption (called from the webhook once an order is paid). */
export async function recordRedemption({ code, userId, orderNumber, amount }) {
  const norm = String(code || "").trim().toUpperCase();
  if (!norm) return;
  try {
    const { data: d } = await supabaseServer
      .from("discounts")
      .select("id")
      .eq("code", norm)
      .maybeSingle();
    await supabaseServer.from("discount_redemptions").insert({
      discount_id: d?.id || null,
      code: norm,
      user_id: userId || null,
      order_number: orderNumber || null,
      amount: amount != null ? Number(amount) : null,
    });
  } catch {
    /* best-effort */
  }
}
