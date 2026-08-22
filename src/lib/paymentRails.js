// src/lib/paymentRails.js
// Client view of payment rail availability (audit P1.2).
//
// The SERVER decides what is payable (GET /api/payment-rails), because a
// build-time VITE_ flag can disagree with the deployment's runtime config —
// which is how crypto came to be shown, as the recommended option, on a
// deployment where BTCPay was not configured at all.
//
// fetchPaymentRails() is the real source. availableRails() remains only as a
// last-resort fallback for when the endpoint itself is unreachable, and is
// deliberately conservative: it offers card ONLY (a rail whose key is present
// in this build) and never claims crypto, since claiming crypto wrongly is the
// exact failure this replaced.

/** Conservative offline fallback — never asserts crypto. */
export function availableRails() {
  if (!import.meta.env.VITE_STRIPE_PUBLISHABLE_KEY) return [];
  return [
    {
      id: "card",
      label: "Pay with card",
      note: "Visa · Mastercard · Amex — secured by Stripe",
      endpoint: "/api/create-checkout-session",
      primary: true,
    },
  ];
}

/**
 * Ask the server which rails are actually configured.
 * @returns {Promise<{rails: Array, cryptoDiscountPct: number, unavailable: boolean, degraded?: boolean}>}
 */
export async function fetchPaymentRails() {
  try {
    const res = await fetch("/api/payment-rails", { headers: { Accept: "application/json" } });
    if (!res.ok) throw new Error(`rails ${res.status}`);
    const data = await res.json();
    if (!Array.isArray(data?.rails)) throw new Error("malformed rails response");
    return { ...data, degraded: false };
  } catch {
    const rails = availableRails();
    // `degraded` lets the UI say "we couldn't confirm payment options" rather
    // than silently presenting a possibly-wrong list.
    return { rails, cryptoDiscountPct: 0, unavailable: rails.length === 0, degraded: true };
  }
}
