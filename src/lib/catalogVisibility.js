// src/lib/catalogVisibility.js
// Category soft-launch visibility (Sept-11 T7). Pure helpers shared by the
// static catalog (src/data/tier1Catalog.js), the client data layer
// (src/lib/catalog.js) and the build-time prerenderer, so a hidden category is
// hidden the same way on every surface.
//
// A category is hidden when its `soft_launch_hidden` (DB column, migration
// 0034) or `softLaunchHidden` (static mirror) is exactly true. Absent/null/
// false → visible. Nothing here hides anything on its own.

export function isHiddenCategory(c) {
  return c?.soft_launch_hidden === true || c?.softLaunchHidden === true;
}

/** @returns {Set<string>} slugs of hidden categories */
export function hiddenCategorySlugs(categories) {
  return new Set((Array.isArray(categories) ? categories : []).filter(isHiddenCategory).map((c) => c.slug));
}

export function visibleCategories(categories) {
  return (Array.isArray(categories) ? categories : []).filter((c) => !isHiddenCategory(c));
}

/** Products whose category is not hidden. */
export function visibleProducts(products, hiddenSlugs) {
  const hidden = hiddenSlugs instanceof Set ? hiddenSlugs : new Set(hiddenSlugs || []);
  return (Array.isArray(products) ? products : []).filter((p) => !hidden.has(p?.category_slug));
}
