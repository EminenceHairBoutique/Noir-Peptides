// src/lib/recentlyViewed.js
// Local-only "recently viewed" history. Slugs live in localStorage (nothing
// leaves the browser — no server round-trip, no per-user tracking table),
// newest first, bounded. Pure functions; every storage touch is try/wrapped
// so private-mode / quota failures degrade to an empty history.

const KEY = "np_recently_viewed";
const MAX = 8;

export function getRecentlyViewedSlugs(excludeSlug) {
  try {
    const raw = window.localStorage.getItem(KEY);
    const list = raw ? JSON.parse(raw) : [];
    if (!Array.isArray(list)) return [];
    return list
      .filter((s) => typeof s === "string" && s && s !== excludeSlug)
      .slice(0, MAX);
  } catch {
    return [];
  }
}

export function recordRecentlyViewed(slug) {
  if (!slug || typeof slug !== "string") return;
  try {
    const current = getRecentlyViewedSlugs();
    const next = [slug, ...current.filter((s) => s !== slug)].slice(0, MAX);
    window.localStorage.setItem(KEY, JSON.stringify(next));
  } catch {
    /* storage unavailable — feature silently off */
  }
}
