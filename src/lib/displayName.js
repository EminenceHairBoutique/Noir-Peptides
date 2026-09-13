// src/lib/displayName.js   (opt cycle 9 — addendum C7)
// The one rule for what a shopper sees as a product's name: the optional
// `code_name` when set, otherwise the substance `name`. Shared by the client
// catalog mapper, the prerender and the admin API so the rule cannot drift.
// Certificates, safety data sheets and order records keep the substance name.

export const CODE_NAME_MAX = 80;

/** Storefront display name for a product row (DB row or static product). */
export function displayNameOf(row) {
  if (!row) return "";
  const code = typeof row.code_name === "string" ? row.code_name.trim() : "";
  return code || row.name || "";
}
