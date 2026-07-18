// src/lib/labels/lots.js
// Lot-number + date-label helpers. Format: NP-[PRODUCTCODE]-[YYMM]-[BATCH]
// e.g. NP-BPC157-2607-001. Pure + Node-safe.

const LOT_RE = /^NP-[A-Z0-9]{2,12}-\d{4}-\d{3}$/;

/** Compact uppercase product code (mirrors skuFor()'s sanitization). */
export function productCode(productId) {
  return String(productId || "")
    .replace(/[^a-z0-9]/gi, "")
    .toUpperCase()
    .slice(0, 12);
}

/**
 * Build a lot number. yymm must be provided by the caller (comes from the
 * packaging date the admin enters — never auto-stamped, so a lot always
 * reflects real batch data).
 */
export function buildLotNumber({ productId, yymm, batch = 1 }) {
  const code = productCode(productId);
  const b = String(batch).padStart(3, "0");
  if (!/^\d{4}$/.test(String(yymm))) throw new Error("lots: yymm must be 4 digits (YYMM)");
  if (!code) throw new Error("lots: productId required");
  return `NP-${code}-${yymm}-${b}`;
}

export function validateLotFormat(lot) {
  return LOT_RE.test(String(lot || "").trim().toUpperCase());
}

/** "EXP 2028-07" / "RETEST 2028-07" from a YYYY-MM-DD date string. */
export function dateLabel(kind, isoDate) {
  const m = /^(\d{4})-(\d{2})/.exec(String(isoDate || ""));
  if (!m) return "";
  const prefix = kind === "retest" ? "RETEST" : "EXP";
  return `${prefix} ${m[1]}-${m[2]}`;
}

/** Pick the right dated line for a config: retest wins only when set alone. */
export function expiryLine(config) {
  if (config?.expiration_date) return dateLabel("exp", config.expiration_date);
  if (config?.retest_date) return dateLabel("retest", config.retest_date);
  return "";
}
