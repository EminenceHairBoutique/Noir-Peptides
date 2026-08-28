// src/lib/coas.js
// Public Certificate-of-Analysis (COA) data layer. COAs are publicly readable
// (migration 0013/0014: only `is_published` rows are visible to anon), so the
// /test-results library and the lot-verification lookup work without login —
// the verifiable, batch-specific COA is the core trust signal (Task 3).

import { supabase } from "./supabaseClient";

const COA_COLUMNS =
  "id, product_id, batch_number, lot_number, lab_name, file_url, cas_number, " +
  "purity_percent, hplc, mass_spec, ms_confirmed, endotoxin, tested_at, " +
  "is_published, created_at, " +
  // Two-factor verification + net-content columns (migration 0032). The
  // embedded labs(...) selection is a JOIN, not an extra round trip.
  "lab_id, lab_lookup_code, purity_operator, net_peptide_content_mg, " +
  "label_claim_mg, published_on, status, " +
  "labs ( id, name, accreditation_body, accreditation_number, public_lookup_url_template )";

function normalize(row) {
  if (!row) return null;
  return {
    ...row,
    // Prefer an explicit lot_number; fall back to batch_number.
    lot: row.lot_number || row.batch_number || null,
    // PostgREST returns the embedded row as `labs`; expose it as `lab` and
    // keep lab_name as the fallback label when no lab record is linked.
    lab: row.labs || null,
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


// ── W5: one shared latest-certificate map for card surfaces ──────────────
// Product cards must show a real published certificate when one exists, but
// grids render dozens of cards — a per-card query would be an N+1. This
// module-level memoized fetch runs ONE query per session and every card reads
// from the same map. Returns {} without a client or on error, in which case
// cards fall back to their static behavior.
let _latestCoaPromise = null;

export function getLatestCoaMap() {
  if (!_latestCoaPromise) {
    _latestCoaPromise = (async () => {
      if (!supabase) return {};
      try {
        const { data, error } = await supabase
          .from("coas")
          .select("id, product_id, lot_number, batch_number, tested_at, file_url")
          .order("tested_at", { ascending: false, nullsFirst: false })
          .limit(500);
        if (error || !Array.isArray(data)) return {};
        const map = {};
        for (const row of data) {
          // rows arrive newest-first; keep the first (latest) per product
          if (row.product_id && !map[row.product_id]) map[row.product_id] = normalize(row);
        }
        return map;
      } catch {
        return {};
      }
    })();
  }
  return _latestCoaPromise;
}

/**
 * Analytical test panel for one certificate (migration 0032 batch_tests).
 * RLS exposes rows only for published certificates. Returns [] when the
 * panel has not been entered — callers then render nothing.
 */
export async function getBatchTests(coaId) {
  if (!supabase || !coaId) return [];
  try {
    const { data, error } = await supabase
      .from("batch_tests")
      .select("id, coa_id, panel_category, test_name, method_reference, result_value, result_unit, passed, sort_order")
      .eq("coa_id", coaId)
      .order("sort_order", { ascending: true });
    if (error || !Array.isArray(data)) return [];
    return data;
  } catch {
    return [];
  }
}
