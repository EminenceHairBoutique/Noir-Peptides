// lib/orderLines.js   (opt cycle 5)
// Line items arrive in two shapes (Stripe lineItems / BTCPay orderItems);
// read both defensively. Shared by the confirmation email; the Control
// Room's order detail carries the same readers.
export const lineName = (it) => it?.name || it?.description || "Item";
export const lineQty = (it) => Number(it?.quantity || 1);
export const lineUnitCents = (it) => {
  if (Number.isFinite(Number(it?.unit_dollars))) return Math.round(Number(it.unit_dollars) * 100);
  if (Number.isFinite(Number(it?.price?.unit_amount))) return Number(it.price.unit_amount);
  if (Number.isFinite(Number(it?.amount_total)) && lineQty(it) > 0) return Math.round(Number(it.amount_total) / lineQty(it));
  return null;
};
export const lineSku = (it) => it?.sku || it?.price?.product?.metadata?.sku || null;
