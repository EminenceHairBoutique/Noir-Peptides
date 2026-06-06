// lib/rewards.js
// Server-side loyalty redemption (service role). Balance is the source of
// truth in profiles.loyalty_points (maintained by the Stripe webhook). Points
// redeem at 100 pts = $5 ($0.05/pt). Never trust a client-supplied dollar value.

import { supabaseServer } from "./supabaseServer.js";

export const POINT_VALUE_USD = 0.05; // 100 points = $5
export const REDEEM_INCREMENT = 100;

export async function getLoyaltyBalance(userId) {
  if (!userId) return 0;
  try {
    const { data } = await supabaseServer
      .from("profiles")
      .select("loyalty_points")
      .eq("id", userId)
      .maybeSingle();
    return Number(data?.loyalty_points || 0);
  } catch {
    return 0;
  }
}

/**
 * Validate a points redemption and compute its dollar value, capped at the
 * order subtotal.
 * @returns {Promise<{ok:boolean, error?:string, points?:number, dollars?:number}>}
 */
export async function validateLoyaltyRedemption({ userId, points, maxDollars }) {
  const p = Math.floor(Number(points) || 0);
  if (p <= 0) return { ok: true, points: 0, dollars: 0 };
  if (p % REDEEM_INCREMENT !== 0) {
    return { ok: false, error: `Redeem points in increments of ${REDEEM_INCREMENT}.` };
  }
  const balance = await getLoyaltyBalance(userId);
  if (p > balance) return { ok: false, error: "Insufficient points balance." };

  let dollars = Math.round(p * POINT_VALUE_USD * 100) / 100;
  let appliedPoints = p;
  if (maxDollars != null && dollars > maxDollars) {
    // Cap to the order total; only consume the points actually used.
    dollars = Math.max(0, Math.floor(maxDollars / POINT_VALUE_USD / REDEEM_INCREMENT) * REDEEM_INCREMENT) * POINT_VALUE_USD;
    appliedPoints = Math.round(dollars / POINT_VALUE_USD);
  }
  return { ok: true, points: appliedPoints, dollars: Math.round(dollars * 100) / 100 };
}

/** Deduct redeemed points (ledger entry + profile decrement) once paid. */
export async function deductLoyaltyPoints({ userId, points, orderNumber }) {
  const p = Math.floor(Number(points) || 0);
  if (!userId || p <= 0) return;
  try {
    const { data: profile } = await supabaseServer
      .from("profiles")
      .select("loyalty_points")
      .eq("id", userId)
      .maybeSingle();
    const next = Math.max(0, Number(profile?.loyalty_points || 0) - p);
    await supabaseServer.from("profiles").update({ loyalty_points: next }).eq("id", userId);
    await supabaseServer.from("loyalty_ledger").insert({
      user_id: userId,
      delta: -p,
      reason: "redemption",
      order_number: orderNumber || null,
    });
  } catch {
    /* best-effort; never block the webhook */
  }
}
