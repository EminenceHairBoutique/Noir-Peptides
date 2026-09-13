// src/lib/tiers.js — bundle-tier maths. PURE: no Supabase import, so Node
// tests import the real functions (scripts/test-next-tier.mjs). The server
// re-prices every order from variant + quantity; these only drive display.

/** Unit price for `qty` given ascending bundle tiers ({ min_quantity, unit_price }). */
export function unitPriceForQuantity(basePrice, tiers, qty) {
  const base = Number(basePrice) || 0;
  if (!Array.isArray(tiers) || !tiers.length) return base;
  let price = base;
  for (const t of tiers) {
    if (qty >= Number(t.min_quantity) && Number.isFinite(Number(t.unit_price))) {
      price = Number(t.unit_price);
    }
  }
  return price;
}

/**
 * Opt cycle 4 (4.5): the next bundle tier ABOVE the current quantity that is
 * actually cheaper per unit, or null. Tells the buyer how many more units
 * unlock the next unit price. Display only.
 */
export function nextTierFor(basePrice, tiers, qty) {
  const q = Math.max(0, Number(qty) || 0);
  const current = unitPriceForQuantity(basePrice, tiers, q);
  if (!Array.isArray(tiers)) return null;
  const higher = tiers
    .map((t) => ({ min: Number(t.min_quantity), unit: Number(t.unit_price) }))
    .filter((t) => Number.isFinite(t.min) && Number.isFinite(t.unit) && t.min > q && t.unit < current)
    .sort((a, b) => a.min - b.min);
  if (!higher.length) return null;
  const t = higher[0];
  return { minQuantity: t.min, unitPrice: t.unit, more: t.min - q, savingsPerUnit: current - t.unit };
}
