// src/config/checkout.js
// Config-driven checkout options (Stage 2). Shipping rates + the free-shipping
// threshold live here, NOT in the component, so the owner can retune them
// without touching JSX. All research-entity / protocol labels are strictly
// research-framed — none may imply human or veterinary use.

// Free US shipping at/above this order subtotal (owner-set). SINGLE SOURCE OF
// TRUTH — src/pages/ProductDetail.jsx imports this, so the PDP nudge and the
// checkout nudge can never disagree.
export const FREE_SHIP_THRESHOLD = 250;

// Shipping methods (owner-set rates). `priceCents` is the display rate; the
// SERVER is authoritative at payment (Stripe shipping rate id / BTCPay amount),
// so these drive display + the free-ship nudge. `id` is what the order records.
export const SHIPPING_METHODS = [
  {
    id: "standard",
    label: "Standard Shipping",
    detail: "3–5 business days",
    priceCents: 1695,
  },
  {
    id: "expedited",
    label: "Expedited Shipping",
    detail: "1–2 business days",
    priceCents: 3500,
  },
  {
    id: "overnight",
    label: "Next-Day (Overnight)",
    detail: "Next business day if ordered before 2pm ET",
    priceCents: 5000,
  },
];

// Research Entity (required). RUO-consistent; no human-use implication.
export const RESEARCH_ENTITIES = [
  "Academic / University Lab",
  "Research Institution",
  "Commercial / Industry Lab",
  "Analytical / Testing Laboratory",
  "Other Professional Entity",
];

// Research Protocol / Intended Research Use (required).
export const RESEARCH_PROTOCOLS = [
  "In-vitro study",
  "Analytical / reference standard",
  "Assay or method development",
  "Stability / reference testing",
  "Other research use",
];

// The threshold in integer cents. Derived from FREE_SHIP_THRESHOLD (never a
// second literal) so the two can never disagree.
export const FREE_SHIP_THRESHOLD_CENTS = Math.round(FREE_SHIP_THRESHOLD * 100);

/** Dollars → integer cents, rounding once. Never returns a negative. */
export function toCents(dollars) {
  const n = Number(dollars);
  return Number.isFinite(n) && n > 0 ? Math.round(n * 100) : 0;
}

/** Integer cents → "$1,234.56" / "$12" (whole dollars drop the ".00"). */
export function formatCents(cents) {
  const c = Math.max(0, Math.round(Number(cents) || 0));
  const dollars = Math.floor(c / 100);
  const rem = c % 100;
  const whole = dollars.toLocaleString("en-US");
  return rem === 0 ? `$${whole}` : `$${whole}.${String(rem).padStart(2, "0")}`;
}

/**
 * Free-shipping math in INTEGER CENTS (Sept-11 T5). Float subtraction on
 * dollar values ("$0.01 away" at 249.99 becoming 0.010000000000019) is exactly
 * the class of bug a nudge must not have, so every comparison here is on
 * integers and the dollar helper below delegates to this one.
 * @param {number} subtotalCents
 */
export function freeShipProgressCents(subtotalCents) {
  const s = Math.max(0, Math.round(Number(subtotalCents) || 0));
  const remainingCents = Math.max(0, FREE_SHIP_THRESHOLD_CENTS - s);
  return {
    qualifies: s >= FREE_SHIP_THRESHOLD_CENTS,
    remainingCents,
    pct: Math.max(0, Math.min(100, (s / FREE_SHIP_THRESHOLD_CENTS) * 100)),
  };
}

/**
 * The single-line nudge copy, from cents. No urgency language, no countdown.
 * Returns null for an empty cart (nothing to nudge toward).
 */
export function freeShipNudgeText(subtotalCents) {
  const s = Math.max(0, Math.round(Number(subtotalCents) || 0));
  if (s === 0) return null;
  const { qualifies, remainingCents } = freeShipProgressCents(s);
  return qualifies ? "Free shipping unlocked." : `Add ${formatCents(remainingCents)} for free shipping`;
}

/**
 * Free-shipping nudge math (pure), dollar-denominated. Given a subtotal in
 * dollars, returns the remaining dollars to the threshold and whether free
 * shipping applies. Thin wrapper over the cents helper so there is ONE
 * comparison, not two.
 * @param {number} subtotalDollars
 */
export function freeShipProgress(subtotalDollars) {
  const { qualifies, remainingCents, pct } = freeShipProgressCents(toCents(subtotalDollars));
  return { qualifies, remaining: remainingCents / 100, pct };
}
