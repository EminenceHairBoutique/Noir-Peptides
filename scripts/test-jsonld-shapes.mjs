/*
  scripts/test-jsonld-shapes.mjs
  Shape assertions for EVERY JSON-LD type the build emits, plus the compliance
  prohibitions that must never regress. Runs against the built dist/.

  COMPLIANCE (load-bearing):
   - Product/Organization-class schema ONLY. Drug / MedicalEntity /
     medicalCondition are forbidden — this is a research-use-only catalogue.
   - Review / AggregateRating / ratingValue are forbidden: the PDP renders a
     real reviews UI, but emitting rating schema would publish trust data as a
     search-result claim. Not fabricated data, but deliberately not asserted.
   - Article dates are forbidden unless a real authored date exists in the
     repo. src/data/research.js has NO date field, so datePublished /
     dateModified must be ABSENT rather than invented from the build date.

  Run: node scripts/test-jsonld-shapes.mjs   (wired into npm run test:unit)
*/
import fs from "node:fs";
import path from "node:path";
import { FAQS } from "../src/data/faqs.js";

const DIST = path.join(process.cwd(), "dist");

let failures = 0;
const ok = (cond, msg) => {
  if (cond) console.log(`  ✓ ${msg}`);
  else {
    failures++;
    console.error(`  ✗ ${msg}`);
  }
};

function routeFiles(dir = DIST, out = []) {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) routeFiles(p, out);
    else if (e.name === "index.html") out.push(p);
  }
  return out;
}
const routeOf = (f) => {
  const r = "/" + path.relative(DIST, f).replace(/index\.html$/, "").replace(/\/$/, "");
  return r === "/" ? "/" : r;
};
function graphOf(file) {
  const html = fs.readFileSync(file, "utf8");
  const m = html.match(/<script type="application\/ld\+json" id="ld-json">([\s\S]*?)<\/script>/);
  if (!m) return null;
  try {
    return JSON.parse(m[1].replace(/\\u003c/g, "<"));
  } catch {
    return null;
  }
}
const nodesOf = (g) => (Array.isArray(g?.["@graph"]) ? g["@graph"] : g ? [g] : []);
const typeIn = (g, t) => nodesOf(g).find((n) => n?.["@type"] === t);

if (!fs.existsSync(path.join(DIST, "index.html"))) {
  console.error("dist/ not built — run `npm run build` first.");
  process.exit(1);
}

const files = routeFiles();
console.log(`JSON-LD shapes — ${files.length} routes:`);

// ── Every route parses and carries Organization ─────────────────────────
let unparsable = [];
let missingOrg = [];
for (const f of files) {
  const g = graphOf(f);
  if (!g) {
    unparsable.push(routeOf(f));
    continue;
  }
  if (!typeIn(g, "Organization")) missingOrg.push(routeOf(f));
}
ok(unparsable.length === 0, `every route emits parseable JSON-LD (bad: ${JSON.stringify(unparsable)})`);
ok(missingOrg.length === 0, `Organization present sitewide (missing: ${JSON.stringify(missingOrg.slice(0, 5))})`);

// ── PROHIBITED types/fields, repo-wide over built output ────────────────
const FORBIDDEN = ["Drug", "MedicalEntity", "medicalCondition", "AggregateRating", "aggregateRating", "ratingValue", "reviewCount"];
let violations = [];
for (const f of files) {
  const raw = JSON.stringify(graphOf(f) || {});
  for (const bad of FORBIDDEN) {
    if (raw.includes(`"${bad}"`)) violations.push(`${routeOf(f)}: ${bad}`);
  }
  // "Review" only as an @type, not as a substring of other words.
  if (/"@type"\s*:\s*"Review"/.test(raw)) violations.push(`${routeOf(f)}: Review`);
}
ok(violations.length === 0, `no Drug/MedicalEntity/Review/AggregateRating anywhere (${JSON.stringify(violations.slice(0, 5))})`);

// ── Product ─────────────────────────────────────────────────────────────
const pdp = files.find((f) => routeOf(f).startsWith("/product/"));
const pg = graphOf(pdp);
const product = typeIn(pg, "Product");
ok(!!product, "PDP emits a Product node");
ok(product?.["@id"]?.endsWith("#product"), "Product has a stable @id");
ok(!!product?.offers, "Product carries offers");
ok(product?.brand?.["@type"] === "Brand", "Product brand is a Brand node");

// ── BreadcrumbList: PDP + category, mirroring the rendered trail ────────
for (const [label, file] of [
  ["PDP", pdp],
  ["category", files.find((f) => /^\/shop\/[^/]+$/.test(routeOf(f)))],
]) {
  const g = graphOf(file);
  const bc = typeIn(g, "BreadcrumbList");
  ok(!!bc, `${label} emits BreadcrumbList`);
  const items = bc?.itemListElement || [];
  ok(items.length === 3, `${label} BreadcrumbList has 3 crumbs (Home/Shop/Category), got ${items.length}`);
  ok(
    items.every((it, i) => it["@type"] === "ListItem" && it.position === i + 1 && it.name && it.item),
    `${label} crumbs are well-formed ListItems with sequential positions`
  );
  // Must mirror what the page actually renders.
  const html = fs.readFileSync(file, "utf8");
  const rendered = html.includes('<nav aria-label="Breadcrumb">');
  ok(rendered, `${label} actually RENDERS the breadcrumb it claims in JSON-LD`);
}

// ── FAQPage on /faqs, strictly from the shared data ─────────────────────
const faqFile = files.find((f) => routeOf(f) === "/faqs");
const faqGraph = graphOf(faqFile);
const faqNode = typeIn(faqGraph, "FAQPage");
ok(!!faqNode, "/faqs emits FAQPage");
ok(
  faqNode?.mainEntity?.length === FAQS.length,
  `FAQPage has exactly ${FAQS.length} questions (got ${faqNode?.mainEntity?.length})`
);
ok(
  faqNode?.mainEntity?.every(
    (q, i) =>
      q["@type"] === "Question" &&
      q.name === FAQS[i].q &&
      q.acceptedAnswer?.["@type"] === "Answer" &&
      q.acceptedAnswer.text === FAQS[i].a
  ),
  "every FAQPage Q&A matches src/data/faqs.js VERBATIM (no invented Q&A)"
);

// ── Article: shape + NO invented dates + resolvable references ──────────
const artFile = files.find((f) => /^\/research\/[^/]+$/.test(routeOf(f)));
const artGraph = graphOf(artFile);
const article = typeIn(artGraph, "Article");
ok(!!article, "research article emits Article");
ok(!!article?.headline && !!article?.description, "Article has headline + description");
ok(
  !("datePublished" in (article || {})) && !("dateModified" in (article || {})),
  "Article omits datePublished/dateModified — src/data/research.js has no real date, and inventing one is prohibited"
);
// isPartOf previously pointed at a WebSite node absent from the graph.
const ids = new Set(nodesOf(artGraph).map((n) => n?.["@id"]).filter(Boolean));
const refs = [];
for (const n of nodesOf(artGraph)) {
  for (const key of ["isPartOf", "author", "publisher", "about"]) {
    const ref = n?.[key]?.["@id"];
    if (ref) refs.push(ref);
  }
}
const dangling = refs.filter((r) => !ids.has(r));
ok(dangling.length === 0, `no dangling @id references in the article graph (${JSON.stringify(dangling)})`);

// ── Home keeps its FAQPage ──────────────────────────────────────────────
ok(!!typeIn(graphOf(path.join(DIST, "index.html")), "FAQPage"), "home page still emits its FAQPage");

if (failures) {
  console.error(`\n${failures} JSON-LD shape check(s) FAILED`);
  process.exit(1);
}
console.log("\nAll JSON-LD shape checks passed.");
