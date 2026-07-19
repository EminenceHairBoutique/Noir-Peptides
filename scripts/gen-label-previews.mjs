/*
  scripts/gen-label-previews.mjs
  Generates the Checkpoint-1 sample label SVGs into docs/labels/previews/.
  Quantities/SKUs come from the REAL catalog (src/data/tier1Catalog.js) — never
  assumed. Lot/date fields use clearly-sample values (SAMPLE watermark note in
  the filename + docs); storage stays the unverified placeholder because no
  product has owner-verified storage yet.

  Run: node scripts/gen-label-previews.mjs
*/
import fs from "node:fs";
import path from "node:path";
import { getAllProducts } from "../src/data/tier1Catalog.js";
import { renderLabelSvg } from "../src/lib/labels/renderLabelSvg.js";

const OUT = path.join(process.cwd(), "docs", "labels", "previews");
fs.mkdirSync(OUT, { recursive: true });

const products = getAllProducts();
const byId = Object.fromEntries(products.map((p) => [p.id, p]));

function cfgFor(productId, sizeMg) {
  const p = byId[productId];
  if (!p) throw new Error(`No catalog product: ${productId}`);
  const v = sizeMg != null ? p.variants.find((x) => x.vial_size_mg === sizeMg) : p.variants[0];
  if (!v) throw new Error(`No ${sizeMg} mg variant for ${productId}`);
  return {
    product_id: p.id,
    display_name: p.name,
    quantity_label: v.size_label,
    material_type: "Lyophilized Research Material",
    sku: v.sku,
    // Lot/expiry are deliberately BLANK — the engine renders ruled fill-in
    // fields; real batch data is entered by the owner in the studio.
    lot_number: "",
    expiration_date: null,
    barcode_value: v.sku,
    verification_code: "SAMPLE0000000",
    storage_source_verified: false,
    composition: null,
  };
}

const jobs = [];

// 1) The four directions on BPC-157 5 mg (full wrap).
for (const tid of ["noir-clinical-core", "spectral-biotech", "cryogenic-white", "neural-grid"]) {
  jobs.push({ file: `direction-${tid}-bpc-157-5mg-fullwrap.svg`, cfg: cfgFor("bpc-157", 5), opts: { templateId: tid, presetId: "full_wrap" } });
}

// 2) Sample coverage: high quantity, long name, blend (composition pending),
//    variant pair, plus the smaller dies.
jobs.push({ file: "sample-nad-plus-1000mg-fullwrap.svg", cfg: cfgFor("nad-plus", 1000), opts: { presetId: "full_wrap" } });
jobs.push({ file: "sample-cjc-1295-ipamorelin-10mg-fullwrap.svg", cfg: cfgFor("cjc-1295-ipamorelin", 10), opts: { presetId: "full_wrap" } });

const glow = cfgFor("glow", 70);
glow.material_type = "Research Blend";
glow.composition = [
  { name: "GHK-Cu", quantity: "" },
  { name: "BPC-157", quantity: "" },
  { name: "TB-500", quantity: "" },
]; // per-component quantities are NOT in the catalog — renders "pending"
jobs.push({ file: "sample-glow-blend-70mg-fullwrap.svg", cfg: glow, opts: { presetId: "full_wrap" } });

jobs.push({ file: "sample-selank-5mg-fullwrap.svg", cfg: cfgFor("selank", 5), opts: { presetId: "full_wrap" } });
jobs.push({ file: "sample-selank-10mg-fullwrap.svg", cfg: cfgFor("selank", 10), opts: { presetId: "full_wrap" } });
jobs.push({ file: "die-front-bpc-157-5mg.svg", cfg: cfgFor("bpc-157", 5), opts: { presetId: "front" } });
jobs.push({ file: "die-neck-bpc-157-5mg.svg", cfg: cfgFor("bpc-157", 5), opts: { presetId: "neck" } });
jobs.push({ file: "die-cap-bpc-157-5mg.svg", cfg: cfgFor("bpc-157", 5), opts: { presetId: "cap" } });
jobs.push({ file: "guides-bpc-157-5mg-fullwrap.svg", cfg: cfgFor("bpc-157", 5), opts: { presetId: "full_wrap", showGuides: true } });

for (const j of jobs) {
  // Direction/sample previews document the PROCEDURAL system (kept for the
  // presets/templates that have no EXACT master yet).
  const svg = await renderLabelSvg(j.cfg, { siteUrl: "https://www.noirpeptides.com", forceProcedural: true, ...j.opts });
  fs.writeFileSync(path.join(OUT, j.file), svg);
  console.log(`[labels] wrote ${j.file}`);
}

// EXACT-master showcases (Noir Label Engine v1, Core Black rollout): the
// approved artwork with deterministic VARIABLE_DATA overlays.
const masterJobs = [
  {
    file: "master-core-black-cjc-sample.svg",
    cfg: {
      ...cfgFor("cjc-1295-ipamorelin", 10),
      display_name: "CJC-1295 + Ipamorelin Blend",
      material_type: "Lyophilized Research Material",
      lot_number: "NP2607-001",
      packaged_date: "2026-07-01",
      expiration_date: "2028-07-01",
      composition: [
        { name: "CJC-1295 (DAC)", quantity: "5 mg" },
        { name: "Ipamorelin", quantity: "5 mg" },
      ],
    },
  },
  { file: "master-core-black-bpc-157-5mg.svg", cfg: cfgFor("bpc-157", 5) },
];
for (const j of masterJobs) {
  const svg = await renderLabelSvg(j.cfg, {
    siteUrl: "https://www.noirpeptides.com",
    templateId: "noir-clinical-core",
    presetId: "full_wrap",
  });
  fs.writeFileSync(path.join(OUT, j.file), svg);
  console.log(`[labels] wrote ${j.file} (EXACT master)`);
}
console.log(`[labels] ${jobs.length + masterJobs.length} previews → docs/labels/previews/`);
