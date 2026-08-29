// src/lib/sds.js
// Safety Data Sheet helpers (migration 0033: products.sds_file_url /
// sds_updated_at). Pure predicates — no fetching, no fabricated values. A
// product without a published SDS is reported as such; nothing here ever
// synthesises a URL or a revision date.

/** True only when the product carries a real, non-empty SDS URL. */
export function hasSds(product) {
  return typeof product?.sds_file_url === "string" && product.sds_file_url.trim() !== "";
}

/** ISO day of the SDS revision, or null when unrecorded. */
export function sdsRevision(product) {
  const d = String(product?.sds_updated_at || "").slice(0, 10);
  return /^\d{4}-\d{2}-\d{2}$/.test(d) ? d : null;
}

/** Products with a published SDS, ordered by name. */
export function withSds(products) {
  return (Array.isArray(products) ? products : [])
    .filter(hasSds)
    .sort((a, b) => String(a.name || "").localeCompare(String(b.name || "")));
}

/** Coverage counters for the documents index. Never rounds a partial up. */
export function sdsCoverage(products) {
  const list = Array.isArray(products) ? products : [];
  const published = list.filter(hasSds).length;
  return { published, total: list.length };
}
