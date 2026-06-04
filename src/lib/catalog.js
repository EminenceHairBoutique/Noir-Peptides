// src/lib/catalog.js
// Client catalog data layer. Reads the storefront catalog from the RLS-gated
// Supabase `products` / `product_categories` tables (migration 0003 gates SELECT
// on is_attested()). This is what makes the auth wall REAL for the catalog:
// an unauthenticated/unattested client receives zero rows from the network, and
// the catalog is no longer shipped in the JS bundle.
//
// IMPORTANT: there is intentionally NO static fallback here. Falling back to a
// bundled catalog would defeat the wall. When Supabase is unconfigured (no auth
// is possible, so the storefront is unreachable anyway) these helpers return
// empty results rather than leaking data.

import { supabase } from "./supabaseClient";

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

const PRODUCT_COLUMNS =
  "id, slug, name, subtitle, category_slug, price, compare_at_price, " +
  "vial_size_mg, purity_percent, peptide_sequence, molecular_weight, form, " +
  "storage_temp, cas_number, batch_number, coa_url, research_use_only, " +
  "stock_status, image_url, gallery, short_description, description, " +
  "featured, is_new";

/**
 * Fetch catalog products, optionally filtered by category slug.
 * @returns {Promise<Array>} normalized products ([] on error / no access)
 */
export async function getProducts({ category } = {}) {
  if (!supabase) return [];
  try {
    let q = supabase.from("products").select(PRODUCT_COLUMNS);
    if (category) q = q.eq("category_slug", category);
    const { data, error } = await q;
    if (error || !Array.isArray(data)) return [];
    return data.map(normalizeProduct);
  } catch {
    return [];
  }
}

/**
 * Fetch a single product by slug (falls back to id).
 * @returns {Promise<object|null>}
 */
export async function getProduct(slugOrId) {
  if (!supabase || !slugOrId) return null;
  try {
    const bySlug = await supabase
      .from("products")
      .select(PRODUCT_COLUMNS)
      .eq("slug", slugOrId)
      .maybeSingle();
    if (bySlug.data) return normalizeProduct(bySlug.data);

    const byId = await supabase
      .from("products")
      .select(PRODUCT_COLUMNS)
      .eq("id", slugOrId)
      .maybeSingle();
    return byId.data ? normalizeProduct(byId.data) : null;
  } catch {
    return null;
  }
}

/**
 * Fetch featured, in-stock products for the homepage.
 * @returns {Promise<Array>}
 */
export async function getFeaturedProducts(limit = 8) {
  if (!supabase) return [];
  try {
    const { data, error } = await supabase
      .from("products")
      .select(PRODUCT_COLUMNS)
      .eq("featured", true)
      .neq("stock_status", "out_of_stock")
      .limit(limit);
    if (error || !Array.isArray(data)) return [];
    return data.map(normalizeProduct);
  } catch {
    return [];
  }
}

/**
 * Fetch active research categories (excludes deprecated rows, sort_order >= 900).
 * @returns {Promise<Array>}
 */
export async function getCategories() {
  if (!supabase) return [];
  try {
    const { data, error } = await supabase
      .from("product_categories")
      .select("slug, name, description, sort_order")
      .lt("sort_order", 900)
      .order("sort_order", { ascending: true });
    if (error || !Array.isArray(data)) return [];
    return data;
  } catch {
    return [];
  }
}
