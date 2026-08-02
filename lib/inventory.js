// lib/inventory.js
// Pure inventory logic shared by fulfillment (decrement on paid orders),
// pricing (oversell guard), and the admin catalog editor (derived status).
// Deliberately free of imports/IO so it unit-tests in plain Node; the
// database writes live with their callers.

/**
 * Derive stock_status for a TRACKED variant from its count.
 * Callers must not invoke this for untracked variants (count == null).
 */
export function deriveStockStatus(count, threshold = 5) {
  const n = Math.max(0, Math.floor(Number(count) || 0));
  if (n === 0) return "out_of_stock";
  if (n <= Math.max(0, Math.floor(Number(threshold) || 0))) return "low_stock";
  return "in_stock";
}

/** True when the variant row participates in counting at all. */
export function isTracked(variantRow) {
  return variantRow != null && variantRow.inventory_count !== null && variantRow.inventory_count !== undefined;
}

/**
 * Normalize a fulfilled order's line items into [{ sku, quantity }],
 * accepting every shape the rails produce:
 *   * BTCPay invoice metadata:  { sku, quantity, ... }
 *   * Stripe listLineItems (price.product expanded): { quantity,
 *     price: { product: { metadata: { sku } } } }
 * Lines with no resolvable sku or a non-positive quantity are dropped —
 * fulfillment must never guess which variant to decrement.
 */
export function normalizeOrderItems(items) {
  if (!Array.isArray(items)) return [];
  const out = [];
  for (const it of items) {
    if (!it || typeof it !== "object") continue;
    const sku =
      (typeof it.sku === "string" && it.sku.trim()) ||
      (typeof it.price?.product?.metadata?.sku === "string" && it.price.product.metadata.sku.trim()) ||
      null;
    const quantity = Math.floor(Number(it.quantity));
    if (!sku || !Number.isFinite(quantity) || quantity <= 0) continue;
    out.push({ sku, quantity: Math.min(quantity, 99) });
  }
  return out;
}
