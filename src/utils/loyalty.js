// src/utils/loyalty.js
// Canonical loyalty configuration + point math. Shared by the Stripe webhook
// (server) and any client surface that displays loyalty balances. Keep this the
// single source of truth so earned points are computed identically everywhere.

export const LOYALTY = {
  // Points awarded per whole US dollar of paid order value.
  pointsPerDollar: 1,
  // One-time bonus granted on a researcher's first completed purchase.
  firstPurchaseBonusPoints: 100,
  // Display label for the program.
  programName: "Noir Research Rewards",
};

/**
 * Points earned for a purchase, given the paid amount in cents.
 * Floors to whole points; never negative.
 * @param {number} amountTotalCents
 * @returns {number}
 */
export function pointsForPurchaseCents(amountTotalCents) {
  const cents = Number(amountTotalCents);
  if (!Number.isFinite(cents) || cents <= 0) return 0;
  return Math.floor((cents / 100) * LOYALTY.pointsPerDollar);
}

/**
 * Convenience helper for client display: points earned for a dollar amount.
 * @param {number} dollars
 * @returns {number}
 */
export function pointsForPurchaseDollars(dollars) {
  const value = Number(dollars);
  if (!Number.isFinite(value) || value <= 0) return 0;
  return Math.floor(value * LOYALTY.pointsPerDollar);
}
