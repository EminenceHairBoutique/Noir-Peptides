// src/lib/coas.js
// Public Certificate-of-Analysis (COA) data layer. COAs are publicly readable
// (migration 0013/0014: only `is_published` rows are visible to anon), so the
// /test-results library and the lot-verification lookup work without login —
// the verifiable, batch-specific COA is the core trust signal (Task 3).

import { supabase } from "./supabaseClient";

const COA_COLUMNS =
  "id, product_id, batch_number, lot_number, lab_name, file_url, cas_number, " +
  "purity_percent, hplc, mass_spec, ms_confirmed, endotoxin, tested_at, " +
  "is_published, created_at";

function normalize(row) {
  if (!row) return null;
  return {
    ...row,
    // Prefer an explicit lot_number; fall back to batch_number.
    lot: row.lot_number || row.batch_number || null,
  };
}

/** All published COAs, newest test first. Returns [] on error / none. */
export async function getAllCoas() {
  if (!supabase) return [];
  try {
    const { data, error } = await supabase
      .from("coas")
      .select(COA_COLUMNS)
      .order("tested_at", { ascending: false, nullsFirst: false })
      .limit(500);
    if (error || !Array.isArray(data)) return [];
    return data.map(normalize);
  } catch {
    return [];
  }
}

/** Published COAs for one product, newest first. */
export async function getCoasForProduct(productId) {
  if (!supabase || !productId) return [];
  try {
    const { data, error } = await supabase
      .from("coas")
      .select(COA_COLUMNS)
      .eq("product_id", productId)
      .order("tested_at", { ascending: false, nullsFirst: false });
    if (error || !Array.isArray(data)) return [];
    return data.map(normalize);
  } catch {
    return [];
  }
}

/**
 * Look up a published COA by the lot printed on the vial. Case-insensitive,
 * trims whitespace. Matches lot_number first, then batch_number.
 * @returns {Promise<object|null>}
 */
export async function lookupByLot(lot) {
  const needle = String(lot || "").trim();
  if (!supabase || !needle) return null;
  try {
    const { data, error } = await supabase
      .from("coas")
      .select(COA_COLUMNS)
      .or(`lot_number.ilike.${needle},batch_number.ilike.${needle}`)
      .limit(1)
      .maybeSingle();
    if (error || !data) return null;
    return normalize(data);
  } catch {
    return null;
  }
}
