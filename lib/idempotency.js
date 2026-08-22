// lib/idempotency.js
// Deterministic idempotency keys for checkout session creation (audit P1.1).
//
// THE PROBLEM: nothing deduplicated SESSION CREATION. Fulfillment was already
// idempotent (orders.provider_ref is UNIQUE), but that only protects the step
// AFTER payment. Before it, a double-click, a retry, a refresh, a second tab,
// or a network timeout each created:
//   * a brand-new Stripe Checkout Session, and
//   * a brand-new single-use Stripe COUPON (create-checkout-session mints one
//     per attempt when a promo or reward applies)
// so a customer who double-clicked left orphan sessions and orphan coupons
// behind, and could in principle open two payable sessions for one cart.
//
// THE FIX: derive a stable key from the *meaning* of the request — who, what,
// at what price-affecting terms — and hand it to Stripe as a native
// Idempotency-Key. Stripe then returns the SAME session (and the same coupon)
// for a repeat of an identical request within its 24h window, instead of
// minting new ones.
//
// WHY A REQUEST TOKEN IS PART OF THE KEY: without it the key would be so
// stable that a customer legitimately re-buying the same cart the next morning
// would be handed yesterday's session. The client mints one token per checkout
// ATTEMPT (stable across double-clicks and retries of that attempt, new on a
// fresh attempt), which scopes idempotency to "this attempt" rather than "this
// cart, forever".

import crypto from "node:crypto";

/**
 * Normalize cart items so that ordering, casing, and incidental fields cannot
 * change the key. Only price-affecting identity survives: variant + quantity.
 */
function normalizeItems(items) {
  if (!Array.isArray(items)) return [];
  const merged = new Map();
  for (const it of items) {
    if (!it || typeof it !== "object") continue;
    const id = String(it.variantId || it.sku || "").trim().toLowerCase();
    if (!id) continue;
    const qty = Math.max(0, Math.floor(Number(it.quantity) || 0));
    if (qty <= 0) continue;
    merged.set(id, (merged.get(id) || 0) + qty); // aggregate duplicate lines
  }
  return [...merged.entries()].sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0)).map(([id, q]) => `${id}:${q}`);
}

/**
 * Build the idempotency key for a checkout attempt.
 *
 * @param {object} args
 * @param {string} args.userId
 * @param {Array}  args.items
 * @param {string} [args.discountCode]
 * @param {number} [args.redeemPoints]
 * @param {string} [args.referralCode]
 * @param {string} [args.shippingMethod]
 * @param {string} [args.requestToken]  per-attempt token from the client
 * @param {string} [args.rail]          "stripe" | "btcpay" — keys never collide across rails
 * @returns {string} a stable key, safe for Stripe's Idempotency-Key header
 */
export function checkoutIdempotencyKey({
  userId,
  items,
  discountCode,
  redeemPoints,
  referralCode,
  shippingMethod,
  requestToken,
  rail = "stripe",
}) {
  const canonical = JSON.stringify({
    v: 1,
    rail,
    user: String(userId || ""),
    items: normalizeItems(items),
    discount: String(discountCode || "").trim().toUpperCase(),
    points: Math.max(0, Math.floor(Number(redeemPoints) || 0)),
    referral: String(referralCode || "").trim().toUpperCase(),
    shipping: String(shippingMethod || ""),
    // Bounded so a hostile client can't blow up the key or smuggle payload.
    token: String(requestToken || "").trim().slice(0, 64),
  });
  return `np_${rail}_${crypto.createHash("sha256").update(canonical).digest("hex").slice(0, 48)}`;
}
