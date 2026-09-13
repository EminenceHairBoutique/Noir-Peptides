/*
  scripts/test-copy-corpus.mjs   (opt cycle 1 — scorecard 4.1)
  Runs the compliance scanner over the PUBLIC COPY CORPUS — every string that
  can reach a rendered page, an email, or an AI system prompt:
    catalog (category names/descs, product names/blurbs, RUO suffix), research
    articles (published AND drafts), FAQs, page copy, every AI INSTRUCTIONS
    block, and the transactional email templates.

  H-006: the scanner flags NEGATIVE statements ("not for human consumption",
  "we do not provide dosing"). So the gate is an EXACT allowlist of accepted
  findings — (entry, category:term) pairs — reviewed whenever copy changes.
  Any finding not on the list fails; any allowlisted finding that disappears
  is reported (so the list cannot rot). No whole-file exemptions, no
  negation heuristic.

  Run: node scripts/test-copy-corpus.mjs   (wired into npm run test:unit)
*/
import { readFileSync } from "node:fs";
import { scanCopy } from "../src/lib/complianceScan.js";
import * as t1 from "../src/data/tier1Catalog.js";
import { researchArticles, researchDrafts } from "../src/data/research.js";
import * as faqsMod from "../src/data/faqs.js";
import * as pageCopy from "../src/data/pageCopy.js";

let failures = 0;
const ok = (cond, msg) => {
  if (cond) console.log(`  ✓ ${msg}`);
  else {
    failures++;
    console.error(`  ✗ ${msg}`);
  }
};
const read = (rel) => readFileSync(new URL(rel, import.meta.url), "utf8");

// ── Build the corpus ─────────────────────────────────────────────────────
const corpus = [];
for (const c of t1.categories) {
  corpus.push([`category:${c.slug}:name`, c.name]);
  corpus.push([`category:${c.slug}:desc`, c.desc]);
  for (const p of c.products) {
    corpus.push([`product:${p.id}:name`, p.name]);
    corpus.push([`product:${p.id}:blurb`, p.blurb]);
  }
}
corpus.push(["tier1:RUO_SUFFIX", t1.RUO_SUFFIX]);
for (const a of researchArticles) {
  corpus.push([`article:${a.slug}:title`, a.title]);
  corpus.push([`article:${a.slug}:summary`, a.summary]);
  a.sections.forEach((s, i) => corpus.push([`article:${a.slug}:s${i}`, `${s.heading} ${s.body}`]));
}
for (const a of researchDrafts) {
  a.sections.forEach((s, i) => corpus.push([`draft:${a.slug}:s${i}`, `${s.heading} ${s.body}`]));
}
const faqList = faqsMod.FAQS || faqsMod.faqs || faqsMod.default || [];
faqList.forEach((f, i) => corpus.push([`faq:${i}`, `${f.q || f.question || ""} ${f.a || f.answer || ""}`]));
for (const [k, v] of Object.entries(pageCopy)) corpus.push([`pageCopy:${k}`, JSON.stringify(v)]);
const AI = ["concierge", "research-assistant", "literature-summarizer", "semantic-search", "coa-analyzer", "compliance-scan"];
for (const f of AI) {
  const src = read(`../api/ai/${f}.js`);
  const m = src.match(/INSTRUCTIONS = `([\s\S]*?)`;/);
  if (m) corpus.push([`ai:${f}`, m[1]]);
}
corpus.push(["email:lib/email.js", read("../lib/email.js")]);

// ── Accepted findings — two classes only, each stated explicitly ─────────
//   negation: a NEGATIVE compliance statement ("not for human consumption",
//             "we do not provide dosing…") — checked below to actually read as
//             a negation in context;
//   detector: the admin-only compliance-scan instructions, which must NAME
//             the forbidden terms in order to detect them.
// Format: entry → { terms: sorted "category:term" list, reason }. Update
// deliberately when copy changes; the assertion below explains any difference.
const ACCEPTED = {
  "faq:0": { reason: "negation", terms: ["human-use:for human consumption", "therapeutic-benefit:therapeutic"] },
  "faq:1": { reason: "negation", terms: ["human-use:for human consumption", "human-use:for human use", "therapeutic-benefit:therapeutic"] },
  "faq:3": { reason: "negation", terms: ["administration:cycle", "administration:injection", "administration:stacking", "dosing:dosing", "dosing:dosing"] },
  "pageCopy:ABOUT_COPY": { reason: "negation", terms: ["dosing:dosing", "therapeutic-benefit:therapeutic", "therapeutic-benefit:treatment"] },
  "pageCopy:CONTACT_COPY": { reason: "negation", terms: ["administration:injection", "dosing:dosing", "therapeutic-benefit:treatment"] },
  "ai:concierge": { reason: "negation", terms: ["dosing:dosing", "therapeutic-benefit:therapeutic"] },
  "ai:literature-summarizer": { reason: "negation", terms: ["dosing:dosing", "therapeutic-benefit:therapeutic"] },
  "ai:coa-analyzer": { reason: "negation", terms: ["dosing:dosing"] },
  "ai:compliance-scan": { reason: "detector", terms: ["dosing:dosing", "dosing:dosing", "dosing:dosing", "therapeutic-benefit:therapeutic", "therapeutic-benefit:therapeutic"] },
  // The order-email footer carries the standard negative disclaimer.
  "email:lib/email.js": { reason: "negation", terms: ["disease-claim:prevent any disease", "therapeutic-benefit:cure", "therapeutic-benefit:treat"] },
};

// A "negation" entry must read as a negation in context — a cheap sanity check
// that the allowlist never quietly accepts a positive claim.
const NEGATION = /\b(not|never|no|nor|without|do not|does not|don't|doesn't|isn't|aren't|refuse|outside|prohibit|exclud)/i;

console.log(`Copy corpus — ${corpus.length} entries scanned:`);
const seen = new Set();
let unexpected = 0;
for (const [key, text] of corpus) {
  const r = scanCopy(text);
  if (r.clean) continue;
  seen.add(key);
  const got = r.findings.map((f) => `${f.category}:${f.term.toLowerCase()}`).sort();
  const want = (ACCEPTED[key]?.terms || []).slice().sort();
  if (JSON.stringify(got) !== JSON.stringify(want)) {
    unexpected++;
    console.error(`  ✗ ${key}: findings ${JSON.stringify(got)} ≠ accepted ${JSON.stringify(want)}`);
    for (const f of r.findings) console.error(`      ${f.category}:"${f.term}" — …${f.context}…`);
  } else {
    // The scanner's own context is a 24-char snippet; a negation ("does not
    // provide dosing, administration, injection…") is often further away.
    // Judge on the sentence-scale window of the ENTRY text instead.
    const window = (f) => text.slice(Math.max(0, f.index - 160), f.index + f.term.length + 40);
    if (ACCEPTED[key].reason === "detector") {
      ok(key.startsWith("ai:compliance-scan"), `${key}: ${got.length} accepted finding(s) — detector instructions naming the terms they flag (admin-only)`);
    } else {
      const allNeg = r.findings.every((f) => NEGATION.test(window(f)));
      ok(allNeg, `${key}: ${got.length} accepted finding(s), all in a negative statement`);
      if (!allNeg) for (const f of r.findings.filter((f) => !NEGATION.test(window(f)))) console.error(`      not negated: ${f.category}:"${f.term}" — …${window(f).replace(/\s+/g, " ")}…`);
    }
  }
}
ok(unexpected === 0, `no unexpected scanner findings in the public copy corpus (${unexpected} entr${unexpected === 1 ? "y" : "ies"} differ)`);
const stale = Object.keys(ACCEPTED).filter((k) => !seen.has(k));
ok(stale.length === 0, `every allowlist entry still corresponds to a real finding (stale: ${JSON.stringify(stale)})`);

console.log("\nAI instructions carry no pharmacology framing:");
for (const f of AI) {
  const src = read(`../api/ai/${f}.js`);
  const m = src.match(/INSTRUCTIONS = `([\s\S]*?)`;/);
  const txt = (m ? m[1] : "") + (src.match(/`Summarize[^`]*`/g) || []).join(" ");
  ok(!/mechanism|pathway|receptor|signal(l)?ing/i.test(txt), `${f}: no "mechanism/pathway/receptor/signaling" in its instructions or prompts`);
}

console.log("\nRetired tagline never reappears (Aug-26 audit: Performance → Provenance):");
{
  const { readdirSync, statSync } = await import("node:fs");
  const walk = (d, out = []) => { for (const e of readdirSync(d)) { const p = `${d}/${e}`; if (statSync(p).isDirectory()) walk(p, out); else if (/\.(jsx?|mjs|css|html)$/.test(e)) out.push(p); } return out; };
  const files = [...walk(new URL("../src", import.meta.url).pathname), new URL("../index.html", import.meta.url).pathname];
  const hits = files.filter((f) => /purity\s*[·•-]\s*performance/i.test(readFileSync(f, "utf8")));
  ok(hits.length === 0, `no source file carries "Purity · Performance" (found: ${JSON.stringify(hits.map((f) => f.split("/src/")[1] || f))})`);
}

console.log("\nCatalog + research carry no injection-consumable naming:");
{
  const blob = corpus.map(([, t]) => t).join("\n");
  ok(!/bacteriostatic|syringe|alcohol (prep|pad|swab)|bac water|injection water/i.test(blob), "no injection consumable named anywhere in the corpus");
}

if (failures) {
  console.error(`\n${failures} copy-corpus check(s) FAILED`);
  process.exit(1);
}
console.log("\nAll copy-corpus checks passed.");
