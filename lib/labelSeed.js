// lib/labelSeed.js
// Shared (server + client + tests) seeding rules for catalog-wide label
// rollout. Seeds are DERIVED ONLY from real catalog data:
//   * blend COMPONENT NAMES come from the catalog (product names / published
//     descriptions) — per-component QUANTITIES are never invented and seed
//     empty (labels render "pending administrative input" until entered).
//   * storage seeds UNVERIFIED (safe placeholder prints until the owner
//     confirms per-product documentation).
// Default direction: Core Black (owner-approved evergreen); switchable
// per-config in the studio.

/** Blend component names that appear only in catalog prose (not the name). */
export const BLEND_COMPONENT_NAMES = {
  glow: ["GHK-Cu", "BPC-157", "TB-500"],
  klow: ["GHK-Cu", "BPC-157", "TB-500", "KPV"],
};

/** Parse "A + B Blend" style names into component names. */
export function blendComponentsFor(productId, productName) {
  if (BLEND_COMPONENT_NAMES[productId]) return BLEND_COMPONENT_NAMES[productId];
  const name = String(productName || "");
  if (!/blend/i.test(name)) return null;
  const stripped = name.replace(/\s*blend\s*$/i, "");
  const parts = stripped.split("+").map((s) => s.trim()).filter(Boolean);
  return parts.length >= 2 ? parts : null;
}

export function isBlendProduct(productId, productName) {
  return Boolean(blendComponentsFor(productId, productName));
}

/**
 * Build the draft-creation fields for one catalog product/variant.
 * @param {{id: string, name: string}} product
 * @param {{id?: string, sku?: string, size_label?: string, vial_size_mg?: number}|null} variant
 */
export function seedFieldsForVariant(product, variant) {
  const components = blendComponentsFor(product.id, product.name);
  const sku = variant?.sku || String(product.id || "").toUpperCase();
  return {
    product_id: product.id,
    variant_id: variant?.id || null,
    template_id: "noir-clinical-core",
    default_preset: "full_wrap",
    display_name: product.name,
    quantity_label: variant?.size_label || (variant?.vial_size_mg ? `${variant.vial_size_mg} mg` : ""),
    material_type: components ? "Research Blend" : "Lyophilized Research Material",
    composition: components ? components.map((name) => ({ name, quantity: "" })) : null,
    sku,
    barcode_value: sku,
    lot_number: "",
    storage_short: "",
    storage_full: "",
    storage_source_verified: false,
    recalled: false,
  };
}
