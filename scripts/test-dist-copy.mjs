/*
  scripts/test-dist-copy.mjs   (opt cycle 3 — scorecard 4.1)
  Runs the compliance scanner over what the buyer actually SEES: every
  prerendered page in dist/ — visible text, meta / OG / Twitter descriptions,
  JSON-LD text, and alt / aria-label / title attributes. The corpus gate
  (test-copy-corpus.mjs) covers the data files a page is built from; this
  gate covers the rendered result, so a sentence typed straight into JSX
  (cycle 2 found the retired tagline that way) can no longer bypass the
  scanner.

  H-006: negative compliance statements ("not sold for human consumption",
  "does not establish that the product is injectable") trip the scanner, so
  the gate is an EXACT allowlist of accepted findings per page — reviewed on
  every copy change. Every accepted finding must read as a negation within
  a sentence-scale window. Any new finding fails; any accepted finding that
  disappears is reported so the list cannot rot.

  Run after `npm run build`: node scripts/test-dist-copy.mjs
  Wired into npm run test:unit. `--dump` prints the current allowlist.
*/
import { readdirSync, statSync, readFileSync, existsSync } from "node:fs";
import path from "node:path";
import { scanCopy } from "../src/lib/complianceScan.js";

const DIST = path.join(process.cwd(), "dist");
const DUMP = process.argv.includes("--dump");
let failures = 0;
const ok = (cond, msg) => {
  if (cond) console.log(`  ✓ ${msg}`);
  else { failures++; console.error(`  ✗ ${msg}`); }
};

if (!existsSync(path.join(DIST, "index.html"))) {
  console.error("dist/index.html missing — run `npm run build` first.");
  process.exit(1);
}

// ── Extraction ────────────────────────────────────────────────────────────
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

const walk = (d, out = []) => {
  for (const e of readdirSync(d)) {
    const p = path.join(d, e);
    if (statSync(p).isDirectory()) walk(p, out);
    else if (e === "index.html") out.push(p);
  }
  return out;
};
const pages = walk(DIST).map((p) => ["/" + path.relative(DIST, path.dirname(p)).split(path.sep).filter(Boolean).join("/"), readFileSync(p, "utf8")]);

// ── Accepted findings — negations only ────────────────────────────────────
// route → sorted "category:term" list (lower-cased, duplicates kept so a
// COUNT change is also a change). Regenerate with --dump after a deliberate
// copy change and review the diff; never add a positive claim here.
const ACCEPTED = {
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
  "/legal/terms": ["administration:cycle","administration:injectable","administration:injection","administration:injection","administration:stacking","disease-claim:prevent disease","disease-claim:prevent disease","dosing:dosing","dosing:dosing","therapeutic-benefit:cure","therapeutic-benefit:cure","therapeutic-benefit:therapeutic","therapeutic-benefit:therapeutic","therapeutic-benefit:treat","therapeutic-benefit:treat","therapeutic-benefit:treatment","therapeutic-benefit:treatment"],
};

const NEGATION = /\b(not|never|no|nor|without|do not|does not|don't|doesn't|isn't|aren't|refuse|outside|prohibit|exclud|forbid|decline|disclaim|unable|cannot)/i;

console.log(`Rendered copy — ${pages.length} prerendered pages scanned:`);
const dump = {};
let unexpected = 0, badNegation = 0;
for (const [route, html] of pages) {
  const text = renderedText(html);
  const r = scanCopy(text);
  const got = r.findings.map((f) => `${f.category}:${f.term.toLowerCase()}`).sort();
  if (got.length) dump[route] = got;
  const want = (ACCEPTED[route] || []).slice().sort();
  if (DUMP) continue;
  if (JSON.stringify(got) !== JSON.stringify(want)) {
    unexpected++;
    console.error(`  ✗ ${route}: findings ${JSON.stringify(got)} ≠ accepted ${JSON.stringify(want)}`);
    for (const f of r.findings) console.error(`      ${f.category}:"${f.term}" — …${f.context}…`);
    continue;
  }
  for (const f of r.findings) {
    // Sentence-scale is not enough for list-form disclaimers ("A COA does not
    // mean: … The product is injectable …"; "Refunds are not available for: …
    // therapeutic … use") — the negation heads a list. 480 chars covers the
    // longest such list in the tree; this is a sanity check on the allowlist,
    // the allowlist itself is the gate.
    const win = text.slice(Math.max(0, f.index - 480), f.index + f.term.length + 60);
    if (!NEGATION.test(win)) { badNegation++; console.error(`  ✗ ${route}: "${f.term}" is not inside a negation window: …${win.replace(/\s+/g, " ")}…`); }
  }
}
if (DUMP) { console.log(JSON.stringify(dump, null, 2)); process.exit(0); }

ok(unexpected === 0, `every finding on every page is on the exact allowlist (${unexpected} page(s) differ)`);
ok(badNegation === 0, `every accepted finding reads as a negation in context (${badNegation} do not)`);
const stale = Object.keys(ACCEPTED).filter((r) => !pages.some(([p]) => p === r));
ok(stale.length === 0, `no allowlisted route is missing from dist (${JSON.stringify(stale)})`);
// Product, category and article pages — the pages that carry catalog copy —
// must be scanner-clean with NO allowlist at all.
const catalog = pages.filter(([p]) => /^\/(product|shop|research)\//.test(p));
const dirty = catalog.filter(([, html]) => !scanCopy(renderedText(html)).clean).map(([p]) => p);
ok(catalog.length >= 50, `catalog + article pages scanned (${catalog.length})`);
ok(dirty.length === 0, `product / category / article pages carry zero scanner findings (${JSON.stringify(dirty)})`);
// The retired tagline must not reach any rendered page either.
const tagline = pages.filter(([, html]) => /purity\s*[·•-]\s*performance/i.test(html)).map(([p]) => p);
ok(tagline.length === 0, `retired "Purity · Performance" tagline absent from every page (${JSON.stringify(tagline)})`);

console.log(failures ? `\n${failures} assertion(s) failed` : "\nAll rendered-copy assertions passed");
process.exit(failures ? 1 : 0);
