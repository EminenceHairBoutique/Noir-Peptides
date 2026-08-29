// src/lib/catalog.js
// Client catalog data layer. Reads the storefront catalog from the Supabase
// `products` / `product_variants` / `price_tiers` / `product_categories`
// tables. Catalog READS are public (migration 0013) so product/category pages
// are crawlable and render for anonymous visitors; PURCHASE stays gated
// (checkout requires auth + a current research-use attestation, enforced
// server-side). `orders` / `profiles` / `attestation_audit` remain RLS-gated.
//
// RESILIENCE: the live Supabase rows are the runtime source of truth, but a
// storefront that renders ZERO products is worse than one rendering the
// build-time catalog. If a catalog read fails or comes back empty (Supabase
// unconfigured/unreachable, or an RLS regression), these helpers fall back to
// the SAME bundled catalog the prerenderer uses (src/data/tier1Catalog.js) so
// the shop, PDPs, and SEO never go blank. Purchase remains gated server-side,
// and dynamic/DB-only data (stock, COAs, orders) is never faked.

import { supabase } from "./supabaseClient";
import { selectDegrading } from "./pgSelect";
import {
  getAllProducts as staticAllProducts,
  getCategories as staticCategories,
} from "../data/tier1Catalog";

// ── Static fallback adapters (shape-matched to the DB rows) ──────────────
function staticProducts({ category } = {}) {
  const list = staticAllProducts().map((p) => ({
    id: p.id,
    slug: p.slug,
    name: p.name,
    category_slug: p.category_slug,
    price: p.price,
    purity_percent: 99,
    form: "Lyophilized powder",
    storage_temp: "-20°C",
    research_use_only: true,
    stock_status: p.stock_status || "in_stock",
    short_description: p.blurb,
    description: p.description,
    featured: Boolean(p.featured),
    is_new: true,
    images: [],
  }));
  return category ? list.filter((p) => p.category_slug === category) : list;
}

function staticVariantsFor(productId) {
  const p = staticAllProducts().find((x) => x.id === productId);
  return (p?.variants || []).map((v) => ({
    id: v.id,
    product_id: p.id,
    sku: v.sku,
    vial_size_mg: v.vial_size_mg,
    price: v.price,
    size_label: v.size_label,
    sort_order: v.sort_order,
    stock_status: v.stock_status || "in_stock",
  }));
}

function staticTiersFor(variantId) {
  for (const p of staticAllProducts()) {
    const v = p.variants.find((x) => x.id === variantId);
    if (v) return v.tiers || [];
  }
  return [];
}

// Map a Supabase product row to the shape the UI components expect.
function normalizeProduct(row) {
  if (!row) return null;
  const images =
    Array.isArray(row.images) && row.images.length
      ? row.images
      : Array.isArray(row.gallery)
      ? row.gallery
      : [];
  return {
    ...row,
    images,
    isNew: row.isNew ?? row.is_new ?? false,
  };
}

// Columns that exist before migration 0033. Kept as the degradation target so
// a deploy that lands ahead of the migration still reads the LIVE catalog
// instead of silently dropping to the bundled build-time one.
const PRODUCT_COLUMNS_BASE =
  "id, slug, name, subtitle, category_slug, price, compare_at_price, " +
  "vial_size_mg, purity_percent, peptide_sequence, molecular_weight, form, " +
  "storage_temp, cas_number, batch_number, coa_url, research_use_only, " +
  "stock_status, image_url, gallery, short_description, description, " +
  "featured, is_new";

// + migration 0033: Safety Data Sheet pointer and the peptide/lab_supply split.
const PRODUCT_COLUMNS =
  PRODUCT_COLUMNS_BASE + ", sds_file_url, sds_updated_at, product_type";

/**
 * Fetch catalog products, optionally filtered by category slug.
 * @returns {Promise<Array>} normalized products ([] on error / no access)
 */
export async function getProducts({ category } = {}) {
  if (!supabase) return staticProducts({ category });
  try {
    const { data, error } = await selectDegrading(
      (cols) => {
        let q = supabase.from("products").select(cols);
        if (category) q = q.eq("category_slug", category);
        return q;
      },
      PRODUCT_COLUMNS,
      PRODUCT_COLUMNS_BASE
    );
    if (error || !Array.isArray(data) || data.length === 0) return staticProducts({ category });
    return data.map(normalizeProduct);
  } catch {
    return staticProducts({ category });
  }
}

/**
 * Fetch a single product by slug (falls back to id).
 * @returns {Promise<object|null>}
 */
function staticProduct(slugOrId) {
  return staticProducts().find((p) => p.slug === slugOrId || p.id === slugOrId) || null;
}

export async function getProduct(slugOrId) {
  if (!slugOrId) return null;
  if (!supabase) return staticProduct(slugOrId);
  try {
    const bySlug = await selectDegrading(
      (cols) => supabase.from("products").select(cols).eq("slug", slugOrId).maybeSingle(),
      PRODUCT_COLUMNS,
      PRODUCT_COLUMNS_BASE
    );
    if (bySlug.data) return normalizeProduct(bySlug.data);

    const byId = await selectDegrading(
      (cols) => supabase.from("products").select(cols).eq("id", slugOrId).maybeSingle(),
      PRODUCT_COLUMNS,
      PRODUCT_COLUMNS_BASE
    );
    return byId.data ? normalizeProduct(byId.data) : staticProduct(slugOrId);
  } catch {
    return staticProduct(slugOrId);
  }
}

/**
 * Fetch featured, in-stock products for the homepage.
 * @returns {Promise<Array>}
 */
function staticFeatured(limit) {
  return staticProducts()
    .filter((p) => p.stock_status !== "out_of_stock")
    .slice(0, limit);
}

export async function getFeaturedProducts(limit = 8) {
  if (!supabase) return staticFeatured(limit);
  try {
    const { data, error } = await selectDegrading(
      (cols) =>
        supabase
          .from("products")
          .select(cols)
          .eq("featured", true)
          .neq("stock_status", "out_of_stock")
          .limit(limit),
      PRODUCT_COLUMNS,
      PRODUCT_COLUMNS_BASE
    );
    if (error || !Array.isArray(data) || data.length === 0) return staticFeatured(limit);
    return data.map(normalizeProduct);
  } catch {
    return staticFeatured(limit);
  }
}

/**
 * Fetch dosage variants for a product, ascending by sort_order.
 * RLS-gated (attested read). Returns [] when none / no access.
 * @returns {Promise<Array<{id,sku,vial_size_mg,price,size_label,sort_order,stock_status}>>}
 */
export async function getVariants(productId) {
  if (!productId) return [];
  if (!supabase) return staticVariantsFor(productId);
  try {
    const { data, error } = await supabase
      .from("product_variants")
      .select("id, sku, vial_size_mg, price, size_label, sort_order, stock_status")
      .eq("product_id", productId)
      .order("sort_order", { ascending: true });
    if (error || !Array.isArray(data) || data.length === 0) return staticVariantsFor(productId);
    return data;
  } catch {
    return staticVariantsFor(productId);
  }
}

// ── STRICT reads for admin tooling (Label Studio) ────────────────────────
// The storefront fallback above is deliberately forgiving; an ADMIN authoring
// tool must be the opposite. label_configs.product_id / variant_id are
// foreign keys into products / product_variants — the studio's pickers must
// show exactly what those tables contain in THIS environment's database,
// including "nothing" (a phantom bundled list produces doomed inserts that
// die on the FK). These return { rows, error } and NEVER substitute the
// static catalog or mask zero rows.

export async function getProductsAuthoritative() {
  if (!supabase) return { rows: [], error: "Supabase is not configured in this build." };
  try {
    const { data, error } = await selectDegrading(
      (cols) => supabase.from("products").select(cols).order("name", { ascending: true }),
      PRODUCT_COLUMNS,
      PRODUCT_COLUMNS_BASE
    );
    if (error) return { rows: [], error: error.message };
    return { rows: (data || []).map(normalizeProduct), error: null };
  } catch (e) {
    return { rows: [], error: e?.message || "Catalog read failed." };
  }
}

export async function getVariantsAuthoritative(productId) {
  if (!productId) return { rows: [], error: null };
  if (!supabase) return { rows: [], error: "Supabase is not configured in this build." };
  try {
    const { data, error } = await supabase
      .from("product_variants")
      .select("id, sku, vial_size_mg, price, size_label, sort_order, stock_status")
      .eq("product_id", productId)
      .order("sort_order", { ascending: true });
    if (error) return { rows: [], error: error.message };
    return { rows: data || [], error: null };
  } catch (e) {
    return { rows: [], error: e?.message || "Variant read failed." };
  }
}

/**
 * Fetch ALL variants across the catalog (for shop-wide filters like vial size).
 * Public read. Returns [] on error.
 * @returns {Promise<Array<{id,product_id,vial_size_mg,size_label,price,stock_status}>>}
 */
function staticAllVariants() {
  return staticAllProducts().flatMap((p) => staticVariantsFor(p.id));
}

export async function getAllVariants() {
  if (!supabase) return staticAllVariants();
  try {
    const { data, error } = await supabase
      .from("product_variants")
      .select("id, product_id, vial_size_mg, size_label, price, stock_status")
      .order("product_id", { ascending: true });
    if (error || !Array.isArray(data) || data.length === 0) return staticAllVariants();
    return data;
  } catch {
    return staticAllVariants();
  }
}

/**
 * Laboratory consumables (products.product_type = 'lab_supply', migration
 * 0033) — bacteriostatic water, syringes, alcohol prep pads and the like.
 *
 * These are catalogue items in their own right, listed so a laboratory can
 * order what it needs in one go. They are NOT presented as a step in any
 * procedure involving the peptides: no reconstitution instruction, no ratio,
 * no protocol. Returns [] when none are configured (the default state — the
 * migration seeds nothing) and NEVER falls back to the bundled catalog, which
 * contains no consumables and would otherwise invent a list.
 * @returns {Promise<Array>}
 */
export async function getLabSupplies() {
  if (!supabase) return [];
  try {
    const { data, error } = await selectDegrading(
      (cols) =>
        supabase
          .from("products")
          .select(cols)
          .eq("product_type", "lab_supply")
          .order("name", { ascending: true }),
      PRODUCT_COLUMNS,
      // Pre-0033 there is no product_type column at all, so there are no lab
      // supplies to find; the degraded query is filtered out below.
      PRODUCT_COLUMNS_BASE
    );
    if (error || !Array.isArray(data)) return [];
    // Guard the degraded path: without product_type the filter cannot have
    // applied, so drop anything that does not actually declare itself.
    return data.filter((r) => r?.product_type === "lab_supply").map(normalizeProduct);
  } catch {
    return [];
  }
}

/**
 * Fetch the bundle/volume price tiers for a VARIANT, ascending by quantity.
 * RLS-gated (attested read). Returns [] when none configured.
 * @returns {Promise<Array<{min_quantity,unit_price,savings_pct,label}>>}
 */
export async function getTiers(variantId) {
  if (!variantId) return [];
  if (!supabase) return staticTiersFor(variantId);
  try {
    const { data, error } = await supabase
      .from("price_tiers")
      .select("min_quantity, unit_price, savings_pct, label")
      .eq("variant_id", variantId)
      .order("min_quantity", { ascending: true });
    if (error || !Array.isArray(data) || data.length === 0) return staticTiersFor(variantId);
    return data;
  } catch {
    return staticTiersFor(variantId);
  }
}

/**
 * The unit price for a quantity given a product's base price + tiers.
 * Mirrors the server's resolveUnitPriceDollars so displayed price == charged.
 */
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
 * Fetch published reviews for a product (RLS: attested read). Returns [].
 * @returns {Promise<Array<{rating,aspect,title,body,verified_purchase,created_at}>>}
 */
export async function getReviews(productId) {
  if (!supabase || !productId) return [];
  try {
    const { data, error } = await supabase
      .from("product_reviews")
      .select("rating, aspect, title, body, verified_purchase, created_at")
      .eq("product_id", productId)
      .eq("status", "published")
      .order("created_at", { ascending: false })
      .limit(50);
    if (error || !Array.isArray(data)) return [];
    return data;
  } catch {
    return [];
  }
}

/**
 * Fetch active research categories (excludes deprecated rows, sort_order >= 900).
 * @returns {Promise<Array>}
 */
function staticCategoryRows() {
  return staticCategories().map((c) => ({
    slug: c.slug,
    name: c.name,
    description: c.desc ?? c.description ?? null,
    sort_order: c.sort ?? c.sort_order ?? 0,
  }));
}

export async function getCategories() {
  if (!supabase) return staticCategoryRows();
  try {
    const { data, error } = await supabase
      .from("product_categories")
      .select("slug, name, description, sort_order")
      .lt("sort_order", 900)
      .order("sort_order", { ascending: true });
    if (error || !Array.isArray(data) || data.length === 0) return staticCategoryRows();
    return data;
  } catch {
    return staticCategoryRows();
  }
}
