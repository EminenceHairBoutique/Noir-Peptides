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
// Opt cycle 12: scanText removes the exact site-wide RUO disclaimer constant
// before scanning (shared with the live probe — see _copy-scan.mjs).
import { scanText, ACCEPTED, NEGATION } from "./_copy-scan.mjs";

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

const walk = (d, out = []) => {
  for (const e of readdirSync(d)) {
    const p = path.join(d, e);
    if (statSync(p).isDirectory()) walk(p, out);
    else if (e === "index.html") out.push(p);
  }
  return out;
};
const pages = walk(DIST).map((p) => ["/" + path.relative(DIST, path.dirname(p)).split(path.sep).filter(Boolean).join("/"), readFileSync(p, "utf8")]);

console.log(`Rendered copy — ${pages.length} prerendered pages scanned:`);
const dump = {};
let unexpected = 0, badNegation = 0;
for (const [route, html] of pages) {
  const text = scanText(html);
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
// Opt cycle 12: the category shells carry the site-wide RUO disclaimer
// sentence React renders above every grid (shell parity, Hy-008). That exact
// constant — a negation, already accepted on /shop — is the only text
// removed before the scan; a single changed character brings it back.
const dirty = catalog.filter(([, html]) => !scanCopy(scanText(html)).clean).map(([p]) => p);
ok(catalog.length >= 50, `catalog + article pages scanned (${catalog.length})`);
ok(dirty.length === 0, `product / category / article pages carry zero scanner findings (${JSON.stringify(dirty)})`);
// The retired tagline must not reach any rendered page either.
const tagline = pages.filter(([, html]) => /purity\s*[·•-]\s*performance/i.test(html)).map(([p]) => p);
ok(tagline.length === 0, `retired "Purity · Performance" tagline absent from every page (${JSON.stringify(tagline)})`);

console.log(failures ? `\n${failures} assertion(s) failed` : "\nAll rendered-copy assertions passed");
process.exit(failures ? 1 : 0);
