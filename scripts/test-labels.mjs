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
  const lot = buildLotNumber({ productId: "bpc-157", yymm: "2607", batch: 1 });
  assert(lot === "NP-BPC157-2607-001", `builds ${lot}`);
  assert(validateLotFormat("NP-BPC157-2607-001"), "accepts valid lot");
  assert(!validateLotFormat("BPC157-001"), "rejects malformed lot");
  assert(!validateLotFormat("NP-BPC157-267-001"), "rejects 3-digit YYMM");
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
      const svg = await renderLabelSvg(baseConfig, { templateId: tid, presetId: pid });
      if (!svg.includes("RESEARCH USE ONLY")) {
        all = false;
        fail(`RUO warning missing on ${tid}/${pid}`);
      }
    }
  }
  if (all) ok("RUO warning present on every template × preset");

  const fullWrap = await renderLabelSvg(baseConfig, { presetId: "full_wrap" });
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
  const blank = await renderLabelSvg({ ...baseConfig, lot_number: "", expiration_date: null }, { presetId: "full_wrap" });
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
  const svg = await renderLabelSvg(baseConfig, { presetId: "full_wrap" });
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
  const svg1 = await renderLabelSvg(blendPending, { presetId: "full_wrap" });
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
  const svg2 = await renderLabelSvg(blendFull, { presetId: "full_wrap" });
  assert(svg2.includes("GHK-Cu – 50 mg"), "owner-entered quantities render");
  assert(!svg2.includes(COMPOSITION_PENDING_PLACEHOLDER), "no placeholder when data complete");
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

if (failures) {
  console.error(`\n${failures} label test(s) FAILED`);
  process.exit(1);
}
console.log("\nAll label tests passed.");
