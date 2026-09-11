/*
  scripts/assert-prerender-data.mjs   (Sept-11 T2)

  Build-time data-presence assertion for the trust pages.

  THE FAILURE THIS CLOSES: the prerenderer fetches published certificates and
  SDS rows at build time when it has Supabase credentials, and falls back to an
  honest static shell when it does not. That fallback is correct in CI (no
  env). It is WRONG on a production build that HAS env — a fetch that failed
  silently (network, RLS regression, an expired key) would ship /test-results
  and /documents as empty shells with no error, and nobody would notice until a
  customer did. With credentials present, a shell is a build failure.

  Pure and importable: scripts/generate-static-seo.mjs calls it after writing
  the routes; scripts/test-assert-prerender-data.mjs feeds it fixtures.
*/

/** Same env contract as fetchPublishedCoasAtBuild / fetchSdsProductsAtBuild. */
export function hasDbEnv(env = process.env) {
  const url = String(env.VITE_SUPABASE_URL || env.SUPABASE_URL || "").trim();
  const key = String(env.VITE_SUPABASE_ANON_KEY || env.SUPABASE_ANON_KEY || "").trim();
  return Boolean(url && key);
}

/** The crawlable root of a prerendered page, or "" if it has none. */
export function rootOf(html) {
  const s = String(html || "");
  const start = s.indexOf('<div id="root">');
  if (start < 0) return "";
  const end = s.indexOf("</body>", start);
  return s.slice(start, end < 0 ? undefined : end);
}

// What each page must carry when the build had database access. These are the
// exact markers the generator emits — not heuristics over prose.
export const MARKERS = {
  testResultsCounters: 'aria-label="Certificate library summary"',
  testResultsRow: /<tbody>\s*<tr>/,
  documentsSdsContainer: 'id="sds-list"',
};

/**
 * Check one page. Returns [] when fine, else the list of what is missing.
 * @param {"/test-results"|"/documents"} route
 * @param {string} html
 */
export function missingFor(route, html) {
  const root = rootOf(html);
  const missing = [];
  if (route === "/test-results") {
    if (!root.includes(MARKERS.testResultsCounters)) missing.push("counters block");
    if (!MARKERS.testResultsRow.test(root)) missing.push("at least one certificate row");
  } else if (route === "/documents") {
    if (!root.includes(MARKERS.documentsSdsContainer)) missing.push("SDS list container");
  } else {
    throw new Error(`assert-prerender-data: unknown route ${route}`);
  }
  return missing;
}

/**
 * Assert the prerendered trust pages carry real data whenever the build had
 * credentials to fetch it.
 *
 * @param {{ pages: Record<string,string>, env?: object }} opts
 *        pages: route → full HTML of the emitted file
 * @returns {{ ok: true, skipped: boolean, checked: string[] }}
 * @throws {Error} naming the route(s) and what is missing, when env is present
 *         and a page is a shell
 */
export function assertPrerenderData({ pages, env = process.env }) {
  if (!hasDbEnv(env)) {
    return { ok: true, skipped: true, checked: [] };
  }
  const problems = [];
  const checked = [];
  for (const route of ["/test-results", "/documents"]) {
    const html = pages?.[route];
    if (typeof html !== "string") {
      problems.push(`${route}: not emitted`);
      continue;
    }
    checked.push(route);
    const missing = missingFor(route, html);
    if (missing.length) problems.push(`${route}: missing ${missing.join(" + ")}`);
  }
  if (problems.length) {
    throw new Error(
      `Prerender data assertion FAILED — Supabase credentials were present at build time but the ` +
        `output is a static shell:\n  - ${problems.join("\n  - ")}\n` +
        `A shell here means the build-time fetch failed (network, key, or RLS) or the tables are empty. ` +
        `Fix the data or the credentials; do not ship an empty trust page.`
    );
  }
  return { ok: true, skipped: false, checked };
}
