// src/lib/labelsApi.js
// Client for the admin label endpoints (bearer via adminApi helpers) and the
// public verification endpoint. Server enforcement is the boundary; this is
// convenience only.
import { adminGet, adminSend } from "./adminApi";

export const listLabelConfigs = () => adminGet("/api/admin/labels");
export const getLabelConfig = (id) => adminGet(`/api/admin/labels?id=${encodeURIComponent(id)}`);
export const getLabelHistory = (id) => adminGet(`/api/admin/labels?history=${encodeURIComponent(id)}`);
export const getLabelMatrix = () => adminGet("/api/admin/labels?matrix=1");
export const createLabelConfig = (fields) => adminSend("/api/admin/labels", "POST", fields);
export const bulkSeedLabels = () => adminSend("/api/admin/labels", "POST", { action: "bulk_seed" });
export const patchLabelConfig = (id, fields) => adminSend("/api/admin/labels", "PATCH", { id, ...fields });

/** Public: verify a label code (no auth). */
export async function verifyCode(code) {
  const res = await fetch(`/api/verify?code=${encodeURIComponent(code)}`);
  const data = await res.json().catch(() => ({}));
  if (!res.ok) return { state: "unavailable" };
  return data;
}

/**
 * Public: fetch the APPROVED label for a product/variant (customer-facing 3D
 * vial + flat label). Returns null when no publishable label exists — the PDP
 * then shows its placeholder. No auth; server enforces approved-only.
 */
export async function getProductLabel(productId, variantId) {
  if (!productId) return null;
  try {
    const qs = new URLSearchParams({ product_id: productId });
    if (variantId) qs.set("variant_id", variantId);
    const res = await fetch(`/api/product-label?${qs.toString()}`);
    if (!res.ok) return null;
    const data = await res.json().catch(() => ({}));
    return data?.label || null;
  } catch {
    return null;
  }
}
