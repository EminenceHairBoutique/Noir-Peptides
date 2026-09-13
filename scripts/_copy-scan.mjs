/*
  scripts/_copy-scan.mjs   (opt cycle 9 — shared by test-dist-copy.mjs and live-probe.mjs)
  What a person or a crawler reads on a rendered page, and the EXACT
  allowlist of accepted scanner findings per route (negations only, H-006).
  The dist gate and the live probe apply the same standard to the same
  extraction so "scanner hits = 0" means the same thing in CI and on prod.
*/
const decode = (s) => s
  .replace(/&amp;/g, "&").replace(/&#39;|&apos;/g, "'").replace(/&quot;/g, '"')
  .replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&nbsp;/g, " ").replace(/&#(\d+);/g, (_, n) => String.fromCharCode(n));

/** Everything a person or a crawler reads on the page, as one string. */
export function renderedText(html) {
  const parts = [];
  // JSON-LD: every string value.
  for (const m of html.matchAll(/<script[^>]*type="application\/ld\+json"[^>]*>([\s\S]*?)<\/script>/gi)) {
    try {
      const walk = (v) => { if (typeof v === "string") parts.push(v); else if (v && typeof v === "object") Object.values(v).forEach(walk); };
      walk(JSON.parse(m[1]));
    } catch { parts.push(m[1]); }
  }
  // Meta descriptions / titles.
  for (const m of html.matchAll(/<meta[^>]+(?:name|property)="(?:description|og:description|twitter:description|og:title|twitter:title)"[^>]*content="([^"]*)"/gi)) parts.push(m[1]);
  for (const m of html.matchAll(/<title>([\s\S]*?)<\/title>/gi)) parts.push(m[1]);
  // Attribute text a screen reader or a tooltip exposes.
  for (const m of html.matchAll(/\s(?:alt|aria-label|title|placeholder)="([^"]*)"/gi)) if (m[1]) parts.push(m[1]);
  // Visible text.
  const body = html.replace(/<script[\s\S]*?<\/script>/gi, " ").replace(/<style[\s\S]*?<\/style>/gi, " ").replace(/<[^>]+>/g, " ");
  parts.push(body);
  return decode(parts.join(" \n ")).replace(/[ \t]+/g, " ");
}

// ── Accepted findings — negations only ────────────────────────────────────
// route → sorted "category:term" list (lower-cased, duplicates kept so a
// COUNT change is also a change). Regenerate with --dump after a deliberate
// copy change and review the diff; never add a positive claim here.
export const ACCEPTED = {
  "/": ["human-use:for human use","therapeutic-benefit:cure","therapeutic-benefit:treat"],
  "/about": ["dosing:dosing","therapeutic-benefit:therapeutic","therapeutic-benefit:treatment"],
  "/coa-policy": ["administration:injectable","administration:injection","disease-claim:prevent disease","human-use:for human use","therapeutic-benefit:cure","therapeutic-benefit:therapeutic","therapeutic-benefit:treat"],
  "/contact": ["administration:injection","dosing:dosing","therapeutic-benefit:treatment"],
  "/faqs": ["administration:cycle","administration:cycle","administration:injection","administration:injection","administration:stacking","administration:stacking","dosing:dosing","dosing:dosing","dosing:dosing","dosing:dosing","human-use:for human consumption","human-use:for human consumption","human-use:for human consumption","human-use:for human consumption","human-use:for human use","human-use:for human use","therapeutic-benefit:therapeutic","therapeutic-benefit:therapeutic","therapeutic-benefit:therapeutic","therapeutic-benefit:therapeutic"],
  "/legal/fda-disclaimer": ["disease-claim:prevent any disease","disease-claim:prevent any disease","disease-claim:prevent any disease","disease-claim:prevent any disease","disease-claim:prevent any disease","therapeutic-benefit:cure","therapeutic-benefit:cure","therapeutic-benefit:cure","therapeutic-benefit:cure","therapeutic-benefit:cure","therapeutic-benefit:treat","therapeutic-benefit:treat","therapeutic-benefit:treat","therapeutic-benefit:treat","therapeutic-benefit:treat"],
  "/legal/research-use-policy": ["administration:cycling","administration:injection","dosing:dosing","therapeutic-benefit:cures","therapeutic-benefit:therapeutic","therapeutic-benefit:treats"],
  "/legal/returns": ["human-use:for human consumption","therapeutic-benefit:therapeutic","therapeutic-benefit:therapeutic"],
  "/legal/ruo-agreement": ["disease-claim:prevent any disease","dosing:dosing","human-use:for human consumption","therapeutic-benefit:cure","therapeutic-benefit:therapeutic","therapeutic-benefit:treat","therapeutic-benefit:treatment"],
  "/legal/shipping": ["human-use:for human consumption","therapeutic-benefit:therapeutic","therapeutic-benefit:therapeutic"],
  "/quality": ["therapeutic-benefit:therapeutic"],
  // Opt cycle 11: the catalog shell carries the RUO banner sentence React
  // renders above the grid ("Not approved by the FDA for … therapeutic …").
  "/shop": ["therapeutic-benefit:therapeutic"],
  "/legal/terms": ["administration:cycle","administration:injectable","administration:injection","administration:injection","administration:stacking","disease-claim:prevent disease","disease-claim:prevent disease","dosing:dosing","dosing:dosing","therapeutic-benefit:cure","therapeutic-benefit:cure","therapeutic-benefit:therapeutic","therapeutic-benefit:therapeutic","therapeutic-benefit:treat","therapeutic-benefit:treat","therapeutic-benefit:treatment","therapeutic-benefit:treatment"],
};

export const NEGATION = /\b(not|never|no|nor|without|do not|does not|don't|doesn't|isn't|aren't|refuse|outside|prohibit|exclud|forbid|decline|disclaim|unable|cannot)/i;

