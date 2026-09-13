/*
  scripts/test-label-copy.mjs   (opt cycle 4 — scorecard 4.1, H-010)
  The printed label is the artifact a regulator reads first. This gate
  renders real labels through renderLabelSvg (every template × the front and
  full-wrap presets, plus a blend and an unverified-storage config), extracts
  the text, and:
    - runs the compliance scanner with an EXACT allowlist of accepted
      findings (negations only — "NOT FOR … THERAPEUTIC …");
    - forbids, on any label, anything that reads as preparation-for-use:
      a solvent, a volume, a route of administration, a schedule, a dose;
    - scans the engine's fixed strings (storage presets, RUO warnings,
      templates) the same way, so a new preset cannot slip past.

  Run: node scripts/test-label-copy.mjs   (wired into npm run test:unit)
  `--dump` prints every rendered label's text and findings.
*/
import { readFileSync, readdirSync } from "node:fs";
import { scanCopy } from "../src/lib/complianceScan.js";
import { renderLabelSvg, TEMPLATES } from "../src/lib/labels/renderLabelSvg.js";
import { STORAGE_PRESETS, RECONSTITUTION_NOTE } from "../src/lib/labels/storage.js";
import { RUO_PRIMARY_WARNING, RUO_SECONDARY_WARNING, STORAGE_UNVERIFIED_PLACEHOLDER, COMPOSITION_PENDING_PLACEHOLDER } from "../lib/labelConstants.js";
import { LABEL_USE_PATTERNS, NEGATION } from "../lib/labelCopyRules.js";

const DUMP = process.argv.includes("--dump");
let failures = 0;
const ok = (cond, msg) => {
  if (cond) console.log(`  ✓ ${msg}`);
  else { failures++; console.error(`  ✗ ${msg}`); }
};
const decode = (s) => s.replace(/&amp;/g, "&").replace(/&#39;|&apos;/g, "'").replace(/&quot;/g, '"').replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&#(\d+);/g, (_, n) => String.fromCharCode(n));
const svgText = (svg) => decode([...svg.matchAll(/<(?:text|tspan|textPath)[^>]*>([^<]*)<\/(?:text|tspan|textPath)>/g)].map((m) => m[1]).join(" ")).replace(/\s+/g, " ").trim();

const base = {
  display_name: "BPC-157",
  quantity_label: "5 mg",
  material_type: "Lyophilized Research Material",
  sku: "BPC157-5",
  product_id: "bpc-157",
  lot_number: "NP-BPC157-2607-001",
  expiration_date: "2028-07-01",
  barcode_value: "BPC157-5",
  verification_code: "A1B2C3D4E5F6G",
  storage_source_verified: true,
  storage_short: STORAGE_PRESETS[0].shortLabelText,
  storage_full: STORAGE_PRESETS[0].fullStorageText,
};
const configs = [
  ["verified-storage", base],
  ["unverified-storage", { ...base, storage_source_verified: false, storage_short: "", storage_full: "" }],
  ["blend", { ...base, display_name: "CJC-1295 / Ipamorelin Blend", sku: "CJCIPA-10", composition_pending: true }],
  ["no-lot", { ...base, lot_number: "", expiration_date: null }],
];

// The rule set is shared with api/admin/labels.js (lib/labelCopyRules.js), so
// what an admin types is held to exactly what this gate renders against.
const FORBIDDEN = LABEL_USE_PATTERNS;

// route → sorted accepted "category:term" findings (negations only).
const ACCEPTED = {
  "noir-clinical-core/front": [],
  "noir-clinical-core/full_wrap": ["therapeutic-benefit:therapeutic"],
  "spectral-biotech/front": [],
  "spectral-biotech/full_wrap": ["therapeutic-benefit:therapeutic"],
  "cryogenic-white/front": [],
  "cryogenic-white/full_wrap": ["therapeutic-benefit:therapeutic"],
  "neural-grid/front": [],
  "neural-grid/full_wrap": ["therapeutic-benefit:therapeutic"],
};

console.log(`Label copy — ${Object.keys(TEMPLATES).length} templates × 2 presets × ${configs.length} configs:`);
let rendered = 0, unexpected = 0, forbidden = 0, badNeg = 0;
const seen = {};
for (const templateId of Object.keys(TEMPLATES)) {
  for (const presetId of ["front", "full_wrap"]) {
    for (const [cname, cfg] of configs) {
      const svg = await renderLabelSvg(cfg, { templateId, presetId, forceProcedural: true });
      const text = svgText(svg);
      rendered++;
      if (DUMP) console.log(`\n## ${templateId}/${presetId} (${cname})\n${text}`);
      for (const [re, label] of FORBIDDEN) {
        if (re.test(text)) { forbidden++; console.error(`  ✗ ${templateId}/${presetId} (${cname}) carries ${label}: "${text.match(re)[0]}"`); }
      }
      const r = scanCopy(text);
      const got = r.findings.map((f) => `${f.category}:${f.term.toLowerCase()}`).sort();
      const key = `${templateId}/${presetId}`;
      seen[key] = got;
      const want = (ACCEPTED[key] || []).slice().sort();
      if (!DUMP && JSON.stringify(got) !== JSON.stringify(want)) {
        unexpected++;
        console.error(`  ✗ ${key} (${cname}): findings ${JSON.stringify(got)} ≠ accepted ${JSON.stringify(want)}`);
        for (const f of r.findings) console.error(`      ${f.category}:"${f.term}" — …${f.context}…`);
      }
      for (const f of r.findings) {
        const win = text.slice(Math.max(0, f.index - 80), f.index + f.term.length + 20);
        if (!NEGATION.test(win)) { badNeg++; console.error(`  ✗ ${key}: "${f.term}" not inside a negation: …${win}…`); }
      }
    }
  }
}
if (DUMP) { console.log("\nfindings by template/preset:", JSON.stringify(seen, null, 1)); process.exit(0); }
ok(rendered === Object.keys(TEMPLATES).length * 2 * configs.length, `${rendered} labels rendered`);
ok(forbidden === 0, `no label carries a volume, solvent, route, dose, schedule or reconstitution instruction (${forbidden})`);
ok(unexpected === 0, `every scanner finding on every label is on the exact allowlist (${unexpected} differ)`);
ok(badNeg === 0, `every accepted finding sits inside a negation (${badNeg} do not)`);
const stale = Object.keys(ACCEPTED).filter((k) => !(k in seen));
ok(stale.length === 0, `allowlist names only rendered template/preset pairs (${JSON.stringify(stale)})`);

console.log("\nEngine fixed strings:");
const fixed = [
  ...STORAGE_PRESETS.flatMap((p) => [p.shortLabelText, p.fullStorageText]),
  RECONSTITUTION_NOTE, RUO_PRIMARY_WARNING, RUO_SECONDARY_WARNING, STORAGE_UNVERIFIED_PLACEHOLDER, COMPOSITION_PENDING_PLACEHOLDER,
];
const tplDir = new URL("../src/lib/labels/templates/", import.meta.url);
for (const f of readdirSync(tplDir)) fixed.push(...[...readFileSync(new URL(f, tplDir), "utf8").matchAll(/"([^"\n]{8,})"/g)].map((m) => m[1]));
let fixedBad = 0;
for (const s of fixed) {
  for (const [re, label] of FORBIDDEN) if (re.test(s)) { fixedBad++; console.error(`  ✗ fixed string carries ${label}: "${s}"`); }
  const r = scanCopy(s);
  for (const f of r.findings) if (!NEGATION.test(s)) { fixedBad++; console.error(`  ✗ fixed string flagged (${f.category}:${f.term}) outside a negation: "${s}"`); }
}
ok(fixed.length >= 12, `${fixed.length} fixed strings scanned (storage presets, RUO warnings, placeholders, templates)`);
ok(fixedBad === 0, `no fixed string carries use language or an un-negated finding (${fixedBad})`);

console.log(failures ? `\n${failures} assertion(s) failed` : "\nAll label-copy assertions passed");
process.exit(failures ? 1 : 0);
