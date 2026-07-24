/*
  scripts/test-labels.mjs
  Unit tests for the RUO label system. Pure Node — no DOM, no network.

  Covers: Code 128 known vector + checksum, lot format, verification-code
  charset/length/uniqueness, all-4-templates × all-5-presets rendering with the
  required RUO warnings, storage source-verified gating, blend composition
  pending rule, publishing rule, and date labels.

  Run: node scripts/test-labels.mjs   (also in npm run test:unit)
*/
import { encodeCode128B, code128Svg } from "../src/lib/labels/code128.js";
import { buildLotNumber, validateLotFormat, dateLabel, expiryLine } from "../src/lib/labels/lots.js";
import {
  generateVerificationCode,
  isValidVerificationCode,
  normalizeVerificationCode,
} from "../src/lib/labels/verificationCode.js";
import { renderLabelSvg, TEMPLATES } from "../src/lib/labels/renderLabelSvg.js";
import { storageLineFor } from "../src/lib/labels/storage.js";
import {
  canRenderOutsideStudio,
  LABEL_STATUSES,
  STORAGE_UNVERIFIED_PLACEHOLDER,
  COMPOSITION_PENDING_PLACEHOLDER,
} from "../lib/labelConstants.js";
import { LABEL_PRESETS } from "../src/lib/labels/presets.js";

let failures = 0;
const ok = (msg) => console.log(`  ✓ ${msg}`);
const fail = (msg) => {
  failures += 1;
  console.error(`  ✗ ${msg}`);
};
const assert = (cond, msg) => (cond ? ok(msg) : fail(msg));

/* ── Code 128 ─────────────────────────────────────────────────────────── */
console.log("Code 128:");
{
  // Known vector: "ABC" with Start B → checksum (104 + 33·1 + 34·2 + 35·3) mod 103 = 1
  const { checksum, modules } = encodeCode128B("ABC");
  assert(checksum === 1, `"ABC" checksum = 1 (got ${checksum})`);
  // Start B pattern 211214 leads; stop pattern 2331112 trails.
  assert(modules.slice(0, 6).join("") === "211214", "starts with Start-B pattern");
  assert(modules.slice(-7).join("") === "2331112", "ends with stop pattern");
  const total = modules.reduce((a, b) => a + b, 0);
  // (1 start + 3 data + 1 check) × 11 + 13 stop = 68 modules
  assert(total === 68, `total module width 68 (got ${total})`);
  const { svg } = code128Svg("NP-BPC157-2607-001");
  assert(svg.includes("<rect"), "renders SVG bars");
  let threw = false;
  try {
    encodeCode128B("héllo");
  } catch {
    threw = true;
  }
  assert(threw, "rejects non-ASCII input");
}

/* ── Lots + dates ─────────────────────────────────────────────────────── */
console.log("\nLots + dates:");
{
  const lot = buildLotNumber({ yymm: "2607", batch: 1 });
  assert(lot === "NP2607-001", `builds compact approved lot ${lot}`);
  assert(validateLotFormat("NP2607-001"), "accepts compact lot");
  assert(validateLotFormat("NP-BPC157-2607-001"), "still accepts legacy long lot");
  assert(!validateLotFormat("BPC157-001"), "rejects malformed lot");
  assert(!validateLotFormat("NP267-001"), "rejects 3-digit YYMM");
  assert(dateLabel("exp", "2028-07-01") === "EXP 2028-07", "EXP label");
  assert(dateLabel("retest", "2028-07-01") === "RETEST 2028-07", "RETEST label");
  assert(
    expiryLine({ expiration_date: "2028-07-01", retest_date: "2029-01-01" }) === "EXP 2028-07",
    "expiration wins over retest"
  );
  assert(expiryLine({ retest_date: "2029-01-01" }) === "RETEST 2029-01", "retest used when alone");
}

/* ── Verification codes ───────────────────────────────────────────────── */
console.log("\nVerification codes:");
{
  const codes = new Set();
  let charsetOk = true;
  for (let i = 0; i < 500; i++) {
    const c = generateVerificationCode();
    codes.add(c);
    if (!isValidVerificationCode(c)) charsetOk = false;
    if (/[ILOU]/.test(c)) charsetOk = false;
  }
  assert(charsetOk, "500 codes: valid Crockford charset (no I/L/O/U), length 13");
  assert(codes.size === 500, "500 codes: all unique");
  assert(normalizeVerificationCode(" a1-b2 o l ") === "A1B201", "normalizes case/separators/ambiguous glyphs");
}

/* ── Rendering invariants ─────────────────────────────────────────────── */
console.log("\nRender invariants (4 templates × 5 presets):");
const baseConfig = {
  display_name: "BPC-157",
  quantity_label: "5 mg",
  material_type: "Lyophilized Research Material",
  sku: "BPC157-5",
  product_id: "bpc-157",
  lot_number: "NP-BPC157-2607-001",
  expiration_date: "2028-07-01",
  barcode_value: "BPC157-5",
  verification_code: "A1B2C3D4E5F6G",
  storage_source_verified: false,
  storage_short: "Store 2–8 °C. Protect from light.",
};
{
  let all = true;
  for (const tid of Object.keys(TEMPLATES)) {
    for (const pid of Object.keys(LABEL_PRESETS)) {
      const svg = await renderLabelSvg(baseConfig, { templateId: tid, presetId: pid, forceProcedural: true });
      if (!svg.includes("RESEARCH USE ONLY")) {
        all = false;
        fail(`RUO warning missing on ${tid}/${pid}`);
      }
    }
  }
  if (all) ok("RUO warning present on every template × preset");

  const fullWrap = await renderLabelSvg(baseConfig, { presetId: "full_wrap", forceProcedural: true });
  assert(fullWrap.includes("NOT FOR DIAGNOSTIC, THERAPEUTIC,"), "secondary restriction on full wrap");
  // The /v/:code URL is encoded inside the QR modules; the human-readable
  // code caption + verify prompt must accompany it on the label.
  assert(fullWrap.includes("A1B2C3D4E5F6G"), "verification code caption rendered under QR");
  assert(fullWrap.includes("SCAN TO VERIFY"), "scan-to-verify prompt rendered");
  assert(fullWrap.includes("NP-BPC157-2607-001"), "lot rendered");
  // Expiry renders as a labelled row: "EXP" header + MM/DD/YYYY value.
  assert(fullWrap.includes("07/01/2028"), "expiration date rendered");
  assert(/>EXP</.test(fullWrap), "EXP row label rendered");

  // Blank lot/expiry must render fill-in rules, never invented values or
  // placeholder words that could be mistaken for data.
  const blank = await renderLabelSvg({ ...baseConfig, lot_number: "", expiration_date: null }, { presetId: "full_wrap", forceProcedural: true });
  assert(!blank.includes("PENDING"), "blank lot/expiry render ruled fields, not PENDING text");
  assert(/>LOT</.test(blank) && />EXP</.test(blank), "LOT/EXP row labels still present when blank");
}

/* ── Storage gating ───────────────────────────────────────────────────── */
console.log("\nStorage gating:");
{
  assert(
    storageLineFor({ storage_source_verified: false, storage_short: "Store 2–8 °C." }) ===
      STORAGE_UNVERIFIED_PLACEHOLDER,
    "unverified storage → safe placeholder (never the entered temp)"
  );
  assert(
    storageLineFor({ storage_source_verified: true, storage_short: "Store 2–8 °C. Protect from light." }) ===
      "Store 2–8 °C. Protect from light.",
    "verified storage → renders the verified text"
  );
  const svg = await renderLabelSvg(baseConfig, { presetId: "full_wrap", forceProcedural: true });
  // Placeholder word-wraps in the storage section; assert on its words.
  assert(
    /refer to accompanying/i.test(svg) && svg.includes("documentation."),
    "label renders placeholder when unverified"
  );
  assert(!svg.includes("2–8"), "label does NOT render the unverified temperature");
}

/* ── Blend composition rule ───────────────────────────────────────────── */
console.log("\nBlend composition:");
{
  const blendPending = {
    ...baseConfig,
    display_name: "GLOW Blend",
    material_type: "Research Blend",
    composition: [{ name: "GHK-Cu", quantity: "" }, { name: "BPC-157", quantity: "" }],
  };
  const svg1 = await renderLabelSvg(blendPending, { presetId: "full_wrap", forceProcedural: true });
  // Placeholder renders under the COMPOSITION header with its redundant
  // "Composition:" prefix stripped.
  assert(/pending administrative input/i.test(svg1), "missing quantities → pending placeholder");

  const blendFull = {
    ...blendPending,
    composition: [
      { name: "GHK-Cu", quantity: "50 mg" },
      { name: "BPC-157", quantity: "10 mg" },
      { name: "TB-500", quantity: "10 mg" },
    ],
  };
  const svg2 = await renderLabelSvg(blendFull, { presetId: "full_wrap", forceProcedural: true });
  assert(svg2.includes("GHK-Cu – 50 mg"), "owner-entered quantities render");
  assert(!svg2.includes(COMPOSITION_PENDING_PLACEHOLDER), "no placeholder when data complete");
}

/* ── Catalog rollout seeding rules (Phase 4) ──────────────────────────── */
console.log("\nCatalog rollout seeding:");
{
  const { blendComponentsFor, seedFieldsForVariant } = await import("../lib/labelSeed.js");

  assert(JSON.stringify(blendComponentsFor("glow", "GLOW Blend")) === JSON.stringify(["GHK-Cu", "BPC-157", "TB-500"]),
    "GLOW components from catalog data");
  assert(blendComponentsFor("klow", "KLOW Blend").length === 4, "KLOW has 4 components");
  assert(JSON.stringify(blendComponentsFor("bpc-157-tb-500", "BPC-157 + TB-500 Blend")) === JSON.stringify(["BPC-157", "TB-500"]),
    'parses "A + B Blend" names');
  assert(blendComponentsFor("bpc-157", "BPC-157") === null, "non-blend → null");

  const blendSeed = seedFieldsForVariant({ id: "cjc-1295-ipamorelin", name: "CJC-1295 + Ipamorelin Blend" }, { id: "v1", sku: "CJC1295IPAM-10", size_label: "10 mg (5/5)", vial_size_mg: 10 });
  assert(blendSeed.material_type === "Research Blend", "blend seeds Research Blend material");
  assert(blendSeed.composition.length === 2 && blendSeed.composition.every((c) => c.quantity === ""),
    "blend seeds component NAMES with EMPTY quantities (never invented)");
  assert(blendSeed.barcode_value === "CJC1295IPAM-10", "barcode defaults to SKU");
  assert(blendSeed.template_id === "noir-clinical-core", "default direction is Core Black");
  assert(blendSeed.storage_source_verified === false && blendSeed.lot_number === "", "storage unverified + lot blank");

  const plain = seedFieldsForVariant({ id: "bpc-157", name: "BPC-157" }, { id: "v2", sku: "BPC157-5", size_label: "5 mg", vial_size_mg: 5 });
  assert(plain.composition === null && plain.material_type === "Lyophilized Research Material", "non-blend seeds lyophilized, no composition");
  assert(plain.quantity_label === "5 mg", "quantity from variant size label");
}

/* ── Publishing rule ──────────────────────────────────────────────────── */
console.log("\nPublishing rule:");
{
  const expected = { draft: false, in_review: false, changes_requested: false, approved: true, production_ready: true, archived: false };
  let all = true;
  for (const s of LABEL_STATUSES) {
    if (canRenderOutsideStudio(s) !== expected[s]) {
      all = false;
      fail(`canRenderOutsideStudio(${s}) wrong`);
    }
  }
  if (all) ok("only approved/production_ready render outside the studio");
}

/* ── EXACT-master engine (Noir Label Engine v1) ───────────────────────── */
console.log("\nEXACT-master engine:");
{
  const { createHash } = await import("node:crypto");
  const { readFileSync } = await import("node:fs");
  const { TEMPLATE_MASTERS, hasMasterRollout } = await import("../src/lib/labels/masters/registry.js");
  const { LabelOverflowError } = await import("../src/lib/labels/masters/renderMasterLabel.js");

  // 1. Immutability: every registered master file hashes to its recorded
  //    sha256 — any byte of drift in the approved artwork fails the build.
  let hashesOk = true;
  for (const [tid, m] of Object.entries(TEMPLATE_MASTERS)) {
    const bytes = readFileSync(`public${m.file}`);
    const hash = createHash("sha256").update(bytes).digest("hex");
    if (hash !== m.sha256) {
      hashesOk = false;
      fail(`master artwork drift: ${tid} (${m.masterId})`);
    }
  }
  if (hashesOk) ok("all 4 registered masters match their recorded sha256 (immutable)");
  assert(
    ["noir-clinical-core", "spectral-biotech", "cryogenic-white", "neural-grid"].every(hasMasterRollout),
    "all four templates rolled out on EXACT masters"
  );

  // 2. Master mode engages for Core Black full wrap and embeds the approved
  //    raster VERBATIM (never redrawn) under a locked group.
  const masterSvg = readFileSync("public/labels/masters/core-black.svg", "utf8");
  const masterDataUri = /(?:xlink:)?href="(data:image\/png;base64,[^"]+)"/.exec(masterSvg)[1];
  // The approved artwork's LOT area fits the compact master lot format
  // (NPYYMM-BBB); the longer legacy format correctly rejects (see overflow
  // test below) — format decision flagged for the owner.
  const masterConfig = { ...baseConfig, lot_number: "NP2607-001" };
  const out = await renderLabelSvg(masterConfig, { templateId: "noir-clinical-core", presetId: "full_wrap" });
  assert(out.includes('id="MASTER_ARTWORK"') && out.includes('data-locked="true"'), "output carries locked MASTER_ARTWORK group");
  assert(out.includes(masterDataUri), "approved raster embedded byte-for-byte (unchanged)");
  assert(out.includes('id="VARIABLE_DATA"'), "product data confined to VARIABLE_DATA overlay");
  assert(out.includes("BPC-157") && out.includes("5 mg"), "product name + quantity overlay");
  assert(out.includes("NP2607-001"), "lot value overlay (compact approved format)");
  assert(out.includes("07/01/2028"), "expiration value overlay (MM/DD/YYYY)");
  assert(/refer to accompanying/i.test(out), "unverified storage → safe placeholder overlay");
  assert(!out.includes("2–8"), "unverified temperature never rendered");

  // 3. Blank identification fields stay blank (fill-in rules live in the
  //    immutable artwork; nothing is invented).
  const blank = await renderLabelSvg(
    { ...masterConfig, lot_number: "", expiration_date: null, packaged_date: null },
    { templateId: "noir-clinical-core", presetId: "full_wrap" }
  );
  assert(!blank.includes("PENDING") && !blank.includes("NP2405-001"), "blank lot/dates render clean patched fields");

  // 4. Overflow REJECTS (nothing on the approved artwork ever moves).
  let threw = null;
  try {
    await renderLabelSvg(
      { ...masterConfig, quantity_label: "1000000 mg extremely long quantity string that cannot fit" },
      { templateId: "noir-clinical-core", presetId: "full_wrap" }
    );
  } catch (e) {
    threw = e;
  }
  assert(threw instanceof LabelOverflowError, "overflowing value rejects the render (LabelOverflowError)");
  let threwLot = null;
  try {
    await renderLabelSvg(baseConfig, { templateId: "noir-clinical-core", presetId: "full_wrap" });
  } catch (e) {
    threwLot = e;
  }
  assert(threwLot instanceof LabelOverflowError && threwLot.field === "lot",
    "legacy long lot format rejects on the approved LOT area (format decision flagged)");

  // 5. Every rolled-out template embeds ITS OWN master verbatim and swaps
  //    product data deterministically.
  for (const [tid, m] of Object.entries(TEMPLATE_MASTERS)) {
    const own = /(?:xlink:)?href="(data:image\/png;base64,[^"]+)"/.exec(readFileSync(`public${m.file}`, "utf8"))[1];
    const svg = await renderLabelSvg(masterConfig, { templateId: tid, presetId: "full_wrap" });
    if (!svg.includes(own)) fail(`master bytes not verbatim for ${tid}`);
    else if (!svg.includes("BPC-157")) fail(`overlay name missing for ${tid}`);
    else ok(`${m.displayName}: master verbatim + overlay renders`);
  }
  // Presets without master artwork keep the procedural engine (which carries
  // the RUO warnings as text).
  const front = await renderLabelSvg(baseConfig, { templateId: "noir-clinical-core", presetId: "front" });
  assert(front.includes("RESEARCH USE ONLY"), "front preset stays procedural (no master die yet)");

  // 6. Composition: up to 4 components ALWAYS all render on every template
  //    (compressed rows past the approved two) — never silent truncation;
  //    a fifth component rejects.
  const klow = {
    ...masterConfig,
    display_name: "KLOW Blend",
    material_type: "Research Blend",
    composition: [
      { name: "GHK-Cu", quantity: "50 mg" },
      { name: "BPC-157", quantity: "10 mg" },
      { name: "TB-500", quantity: "10 mg" },
      { name: "KPV", quantity: "10 mg" },
    ],
  };
  for (const tid of Object.keys(TEMPLATE_MASTERS)) {
    const svg = await renderLabelSvg(klow, { templateId: tid, presetId: "full_wrap" });
    const missing = klow.composition.filter((c) => !svg.includes(`${c.name} – ${c.quantity}`));
    if (missing.length) fail(`${tid}: composition rows missing (${missing.map((c) => c.name).join(", ")})`);
    else ok(`${tid}: all 4 composition rows render`);
  }
  let fiveThrew = null;
  try {
    await renderLabelSvg(
      { ...klow, composition: [...klow.composition, { name: "Extra", quantity: "1 mg" }] },
      { templateId: "noir-clinical-core", presetId: "full_wrap" }
    );
  } catch (e) {
    fiveThrew = e;
  }
  assert(fiveThrew instanceof LabelOverflowError && fiveThrew.field === "composition",
    "5th component rejects (no silent truncation)");

  // 7. Legal lines render only when owner-supplied — on every template.
  const legal = { ...masterConfig, manufacturer: "WTW Research Ltd", distributed_by: "Noir Peptides", country_of_origin: "USA" };
  for (const tid of Object.keys(TEMPLATE_MASTERS)) {
    const svg = await renderLabelSvg(legal, { templateId: tid, presetId: "full_wrap" });
    if (!svg.includes("Manufactured by WTW Research Ltd") || !svg.includes("Distributed by Noir Peptides") || !svg.includes("Origin: USA")) {
      fail(`${tid}: legal line missing`);
    } else ok(`${tid}: legal line renders`);
  }
  const noLegal = await renderLabelSvg(masterConfig, { templateId: "noir-clinical-core", presetId: "full_wrap" });
  assert(!noLegal.includes("Manufactured by") && !noLegal.includes("Distributed by"),
    "no legal line when fields are empty");

  // 8. Determinism: same payload → identical output bytes.
  const again = await renderLabelSvg(masterConfig, { templateId: "noir-clinical-core", presetId: "full_wrap" });
  assert(again === out, "same input payload reproduces identical output");
}

if (failures) {
  console.error(`\n${failures} label test(s) FAILED`);
  process.exit(1);
}
console.log("\nAll label tests passed.");
