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

/**
 * Free-shipping nudge math (pure). Given a subtotal in dollars, returns the
 * remaining dollars to the threshold and whether free shipping applies.
 * @param {number} subtotalDollars
 */
export function freeShipProgress(subtotalDollars) {
  const s = Math.max(0, Number(subtotalDollars) || 0);
  const remaining = Math.max(0, FREE_SHIP_THRESHOLD - s);
  return {
    qualifies: s >= FREE_SHIP_THRESHOLD,
    remaining,
    pct: Math.max(0, Math.min(100, (s / FREE_SHIP_THRESHOLD) * 100)),
  };
}
