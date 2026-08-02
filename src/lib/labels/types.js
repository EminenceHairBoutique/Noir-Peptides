// src/lib/labels/types.js
// JSDoc typedefs + factory for label configurations (repo is plain JS).
// Enums/wording live in lib/labelConstants.js (shared with the server).
import { seedFieldsForVariant } from "../../../lib/labelSeed.js";

/**
 * @typedef {"noir-clinical-core"|"spectral-biotech"|"cryogenic-white"|"neural-grid"} LabelTemplateId
 * @typedef {"full_wrap"|"partial"|"front"|"neck"|"cap"} LabelPresetId
 * @typedef {"draft"|"in_review"|"changes_requested"|"approved"|"production_ready"|"archived"} LabelStatus
 */

/**
 * @typedef {Object} LabelComposition
 * @property {string} name      Component compound name
 * @property {string} quantity  Owner-entered quantity text (e.g. "10 mg"); never derived
 */

/**
 * @typedef {Object} ProductLabelConfig
 * @property {string}  [id]
 * @property {string}  product_id
 * @property {string}  [variant_id]
 * @property {LabelTemplateId} template_id
 * @property {LabelPresetId}   default_preset
 * @property {string}  [accent_family]
 * @property {number}  label_version
 * @property {LabelStatus} status
 * @property {string}  display_name
 * @property {string}  quantity_label       e.g. "5 mg"
 * @property {string}  [material_type]      e.g. "Lyophilized Research Material"
 * @property {LabelComposition[]} [composition]
 * @property {string}  [net_contents]
 * @property {string}  [fill_note]
 * @property {string}  sku
 * @property {string}  [lot_number]
 * @property {string}  [batch_number]
 * @property {string}  [packaged_date]      YYYY-MM-DD
 * @property {string}  [expiration_date]    YYYY-MM-DD
 * @property {string}  [retest_date]        YYYY-MM-DD
 * @property {string}  [barcode_value]
 * @property {string}  [verification_code]
 * @property {string}  [storage_short]
 * @property {string}  [storage_full]
 * @property {boolean} storage_source_verified
 * @property {string}  [manufacturer]
 * @property {string}  [distributed_by]
 * @property {string}  [country_of_origin]
 * @property {boolean} [recalled]
 * @property {string}  [revision_notes]
 */

/**
 * Create a new draft config seeded from a catalog product/variant.
 * @returns {ProductLabelConfig}
 */
export function createDefaultConfig({ product, variant }) {
  // Single-create shares the bulk-rollout seeding rules (lib/labelSeed.js):
  // blend component names come from catalog data with EMPTY quantities;
  // storage seeds unverified; barcode defaults to the SKU.
  return {
    ...seedFieldsForVariant(product, variant),
    accent_family: product.category_slug || null,
    label_version: 1,
    status: "draft",
  };
}
