// src/lib/coaStats.js
// Pure, shared derivations over published COA rows. Used by the /test-results
// dashboard (client), the per-product batch pages, and the build-time
// prerenderer — one implementation so no surface can disagree with another.
//
// EVERY number here is DERIVED from the rows passed in. Nothing is ever
// defaulted, estimated, or invented; when there is no data the caller gets
// zeros/nulls and must suppress the display entirely.

import { normalizeCas } from "../../lib/cas.js";

// W6: a mean over a couple of certificates is not a trust signal. Suppress
// average purity below this many lots carrying a numeric purity value.
export const MIN_LOTS_FOR_AVERAGE = 5;

/** Defensive: only rows that are explicitly published (or legacy-null). */
export function publishedOnly(rows) {
  return (Array.isArray(rows) ? rows : []).filter((r) => r && r.is_published !== false);
}

/**
 * Headline trust counters + computed metrics (W2 + W6), derived from
 * published rows only.
 * @returns {{
 *   productsWithCerts: number,
 *   totalCerts: number,
 *   latestTestedAt: string|null,
 *   avgPurity: number|null,     // suppressed (null) below MIN_LOTS_FOR_AVERAGE
 *   purityLots: number,         // lots contributing a numeric purity value
 *   msConfirmedLots: number,    // lots with mass-spec identity confirmed
 *   hplcLots: number            // lots carrying HPLC data
 * }}
 */
export function deriveCoaStats(rows) {
  const pub = publishedOnly(rows);
  const products = new Set();
  let latest = null;
  const purities = [];
  let msConfirmed = 0;
  let hplc = 0;

  for (const r of pub) {
    if (r.product_id) products.add(r.product_id);
    if (r.tested_at && (!latest || String(r.tested_at) > latest)) latest = String(r.tested_at);
    const p = Number(r.purity_percent);
    if (r.purity_percent != null && Number.isFinite(p)) purities.push(p);
    if (r.ms_confirmed === true) msConfirmed += 1;
    if (r.hplc || r.purity_percent != null) hplc += 1;
  }

  const avg =
    purities.length >= MIN_LOTS_FOR_AVERAGE
      ? Math.round((purities.reduce((a, b) => a + b, 0) / purities.length) * 100) / 100
      : null;

  return {
    productsWithCerts: products.size,
    totalCerts: pub.length,
    latestTestedAt: latest,
    avgPurity: avg,
    purityLots: purities.length,
    msConfirmedLots: msConfirmed,
    hplcLots: hplc,
  };
}

/**
 * W3 filter over published rows. `catalogIndex` maps product_id →
 * { category_slug, name } from the SAME catalog taxonomy /shop uses.
 * CAS matching normalizes dashes/whitespace on both sides.
 */
export function filterCoas(rows, { productId = "all", category = "all", cas = "" } = {}, catalogIndex = {}) {
  const casNeedle = normalizeCas(cas);
  return publishedOnly(rows).filter((r) => {
    if (productId !== "all" && r.product_id !== productId) return false;
    if (category !== "all") {
      const meta = catalogIndex[r.product_id];
      if (!meta || meta.category_slug !== category) return false;
    }
    if (casNeedle) {
      if (!r.cas_number || normalizeCas(r.cas_number) !== casNeedle) return false;
    }
    return true;
  });
}

/** Group published rows by product, each group newest-test-first (W4). */
export function groupByProduct(rows) {
  const map = new Map();
  for (const r of publishedOnly(rows)) {
    const key = r.product_id || "unknown";
    if (!map.has(key)) map.set(key, []);
    map.get(key).push(r);
  }
  for (const list of map.values()) {
    list.sort((a, b) => String(b.tested_at || "").localeCompare(String(a.tested_at || "")));
  }
  return map;
}

/** The most recent published certificate per product (W5), as a plain map. */
export function latestByProduct(rows) {
  const out = {};
  for (const [pid, list] of groupByProduct(rows)) {
    out[pid] = list[0];
  }
  return out;
}
