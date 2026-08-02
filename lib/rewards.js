// lib/rewards.js
// Server-side loyalty redemption (service role). Balance is the source of
// truth in profiles.loyalty_points (maintained by the Stripe webhook). Points
// redeem at 100 pts = $5 ($0.05/pt). Never trust a client-supplied dollar value.

import { supabaseServer } from "./supabaseServer.js";

export const POINT_VALUE_USD = 0.05; // 100 points = $5
export const REDEEM_INCREMENT = 100;
export const REFERRAL_BONUS_POINTS = 200; // awarded to referrer AND friend

// Mirrors the client referral-code format (UserContext.generateReferralCode).
function codeFor(idOrEmail = "") {
  const base =
    String(idOrEmail).replace(/[^A-Za-z0-9]/g, "").slice(-5).toUpperCase() ||
    Date.now().toString().slice(-5);
  return `NP-${base}`;
}

async function addPoints(userId, delta, reason, orderNumber) {
  if (!userId || !delta) return;
  const { data: p } = await supabaseServer
    .from("profiles")
    .select("loyalty_points")
    .eq("id", userId)
    .maybeSingle();
  await supabaseServer
    .from("profiles")
    .update({ loyalty_points: Math.max(0, Number(p?.loyalty_points || 0) + delta) })
    .eq("id", userId);
  await supabaseServer
    .from("loyalty_ledger")
    .insert({ user_id: userId, delta, reason, order_number: orderNumber || null });
}

/** Ensure a user has a shareable referral code (idempotent). */
export async function ensureReferralCode(userId, email) {
  if (!userId) return;
  try {
    const { data } = await supabaseServer
      .from("referral_codes")
      .select("id")
      .eq("user_id", userId)
      .maybeSingle();
    if (data) return;
    await supabaseServer
      .from("referral_codes")
      .upsert({ user_id: userId, code: codeFor(userId || email) }, { onConflict: "user_id" });
  } catch {
    /* best-effort */
  }
}

/**
 * On a buyer's first paid order, if they used a valid referral code, award the
 * referral bonus to BOTH the referrer and the buyer (once). Best-effort.
 */
export async function applyReferralOnOrder({ buyerId, referralCode, orderNumber }) {
  const code = String(referralCode || "").trim().toUpperCase();
  if (!buyerId || !code) return;
  try {
    // Resolve the referrer from the code.
    const { data: ref } = await supabaseServer
      .from("referral_codes")
      .select("user_id")
      .eq("code", code)
      .maybeSingle();
    const referrerId = ref?.user_id;
    if (!referrerId || referrerId === buyerId) return;

    // Only reward once per buyer (idempotent on re-delivered webhooks).
    const { data: prior } = await supabaseServer
      .from("referral_rewards")
      .select("id")
      .eq("referred_user_id", buyerId)
      .maybeSingle();
    if (prior) return;

    await supabaseServer.from("referral_rewards").insert({
      referrer_id: referrerId,
      referred_user_id: buyerId,
      order_number: orderNumber || null,
      reward_points: REFERRAL_BONUS_POINTS,
      status: "awarded",
    });
    await addPoints(referrerId, REFERRAL_BONUS_POINTS, "referral_referrer", orderNumber);
    await addPoints(buyerId, REFERRAL_BONUS_POINTS, "referral_friend", orderNumber);
  } catch {
    /* best-effort — never block the webhook */
  }
}

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
