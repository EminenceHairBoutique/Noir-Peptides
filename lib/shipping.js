// lib/shipping.js
// THE single server-authoritative shipping calculation (audit P0.1).
//
// THE BUG THIS FIXES: shipping had FOUR disagreeing sources of truth —
//   src/config/checkout.js (what the customer sees):  free over $250; $16.95 / $35 / $50
//   api/btcpay/create-invoice.js:                     free over $200; $9 flat
//   api/create-checkout-session.js:                   NEVER free;     $9 flat (or an env rate id)
// So a customer who selected Next-Day and qualified for free shipping was
// charged $9 on crypto and $9-always on card. The browser was effectively
// deciding eligibility it had no authority over, and neither rail honored it.
//
// THE RULE: every rail imports resolveShipping() and charges exactly what it
// returns. The method list and threshold come from src/config/checkout.js, the
// same module the UI renders from, so display and charge cannot drift again.
//
// MONEY IS INTEGER CENTS throughout. Callers converting to provider dollars do
// it once, at the boundary.

import { SHIPPING_METHODS, FREE_SHIP_THRESHOLD } from "../src/config/checkout.js";

export const FREE_SHIP_THRESHOLD_CENTS = Math.round(FREE_SHIP_THRESHOLD * 100);

/** Default when a request omits a method (e.g. the legacy single-step flow). */
export const DEFAULT_SHIPPING_METHOD_ID = SHIPPING_METHODS[0]?.id || "standard";

export function shippingMethodById(id) {
  return SHIPPING_METHODS.find((m) => m.id === id) || null;
}

/**
 * Resolve what shipping to CHARGE.
 *
 * Threshold is evaluated against the PRE-discount goods subtotal — the same
 * number the storefront shows in its free-shipping nudge. Using the
 * post-discount figure would recreate the original defect in miniature: the UI
 * would promise free shipping at $260 and the charge would apply $16.95 after a
 * $20 coupon.
 *
 * @param {{ methodId?: string, subtotalCents: number }} args
 * @returns {{ methodId: string, label: string, detail: string,
 *             amountCents: number, free: boolean, thresholdCents: number,
 *             remainingCents: number }}
 */
export function resolveShipping({ methodId, subtotalCents }) {
  const subtotal = Math.max(0, Math.round(Number(subtotalCents) || 0));
  const method = shippingMethodById(methodId) || shippingMethodById(DEFAULT_SHIPPING_METHOD_ID);
  const free = subtotal >= FREE_SHIP_THRESHOLD_CENTS;
  return {
    methodId: method.id,
    label: method.label,
    detail: method.detail,
    amountCents: free ? 0 : Math.max(0, Math.round(method.priceCents)),
    free,
    thresholdCents: FREE_SHIP_THRESHOLD_CENTS,
    remainingCents: Math.max(0, FREE_SHIP_THRESHOLD_CENTS - subtotal),
  };
}

/**
 * Stripe shipping option built from the SAME resolution, so the hosted page
 * shows and charges what the site promised. A free result still renders a $0
 * line (rather than omitting shipping) so the customer sees why it's free.
 */
export function stripeShippingOption(shipping) {
  return {
    shipping_rate_data: {
      type: "fixed_amount",
      display_name: shipping.free ? `${shipping.label} — Free` : shipping.label,
      fixed_amount: { amount: shipping.amountCents, currency: "usd" },
      delivery_estimate: deliveryEstimateFor(shipping.methodId),
    },
  };
}

function deliveryEstimateFor(methodId) {
  switch (methodId) {
    case "overnight":
      return { minimum: { unit: "business_day", value: 1 }, maximum: { unit: "business_day", value: 1 } };
    case "expedited":
      return { minimum: { unit: "business_day", value: 1 }, maximum: { unit: "business_day", value: 2 } };
    default:
      return { minimum: { unit: "business_day", value: 3 }, maximum: { unit: "business_day", value: 5 } };
  }
}
