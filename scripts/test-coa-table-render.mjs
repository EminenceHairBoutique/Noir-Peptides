/*
  scripts/test-coa-table-render.mjs
  Sept-11 T3 — certificate table honesty. Three rules, each proven on the pure
  helper AND on the rendered component, with fixtures:
    a. the certificate link is labelled by the asset's real type — an image is
       never called "PDF";
    b. the CAS column renders only when some row on the surface carries a CAS
       number (decision reused from deriveCoaStats.casLots);
    c. an MS-confirmed row with no purity figure shows "Identity panel only",
       never a blank cell.

  Rendering uses esbuild (a Vite dep) + react-dom/server, mirroring
  scripts/test-business-config.mjs.

  Run: node scripts/test-coa-table-render.mjs   (wired into npm run test:unit)
*/
import { build } from "esbuild";
import { renderToStaticMarkup } from "react-dom/server";
import { createElement } from "react";
import path from "node:path";
import fs from "node:fs";
import { certificateLabel, purityCell, IDENTITY_ONLY_LABEL } from "../src/lib/coaTable.js";
import { deriveCoaStats, hasAnyCas } from "../src/lib/coaStats.js";

let failures = 0;
const ok = (cond, msg) => {
  if (cond) console.log(`  ✓ ${msg}`);
  else {
    failures++;
    console.error(`  ✗ ${msg}`);
  }
};

const row = (over = {}) => ({
  id: over.id || `r-${Math.random().toString(36).slice(2, 8)}`,
  product_id: "bpc-157",
  lot_number: "L1",
  purity_percent: 99.1,
  tested_at: "2026-05-01",
  ms_confirmed: true,
  hplc: "99.1%",
  is_published: true,
  cas_number: null,
  file_url: null,
  ...over,
});

// ── a. certificate label from the extension ──────────────────────────────
console.log("a. certificate link label derives from the asset type:");
ok(certificateLabel("https://x.test/coa.pdf") === "PDF", ".pdf → PDF");
ok(certificateLabel("https://x.test/coa.PDF?download=1") === "PDF", ".PDF with a query string → PDF (case + query tolerant)");
ok(certificateLabel("https://x.test/coa.jpg") === "Certificate image", ".jpg → Certificate image");
ok(certificateLabel("https://x.test/coa.jpeg#p1") === "Certificate image", ".jpeg with a hash → Certificate image");
ok(certificateLabel("https://x.test/coa.png") === "Certificate image", ".png → Certificate image");
ok(certificateLabel("https://x.test/coa.webp") === "Certificate image", ".webp → Certificate image");
ok(certificateLabel("data:application/pdf;base64,AAAA") === "PDF", "data:application/pdf → PDF");
ok(certificateLabel("data:image/png;base64,AAAA") === "Certificate image", "data:image/* → Certificate image");
ok(certificateLabel("https://x.test/coa") === "Certificate", "no extension → neutral 'Certificate' (never assert a format)");
ok(certificateLabel("https://x.test/coa.docx") === "Certificate", "unknown extension → neutral 'Certificate'");
ok(certificateLabel(null) === null && certificateLabel("") === null, "no URL → null (no link)");

// ── b. CAS column decision reuses the coa-stats derivation ──────────────
console.log("\nb. CAS column decision comes from deriveCoaStats.casLots:");
const noCas = [row({ id: "1" }), row({ id: "2", lot_number: "L2" })];
const someCas = [row({ id: "1" }), row({ id: "2", lot_number: "L2", cas_number: "137525-51-0" })];
ok(deriveCoaStats(noCas).casLots === 0, "casLots = 0 when no row carries a CAS");
ok(deriveCoaStats(someCas).casLots === 1, "casLots counts rows with a CAS (1 of 2)");
ok(deriveCoaStats([row({ cas_number: "   " })]).casLots === 0, "whitespace-only CAS does not count");
ok(hasAnyCas(noCas) === false && hasAnyCas(someCas) === true, "hasAnyCas mirrors casLots > 0");
ok(hasAnyCas([row({ is_published: false, cas_number: "137525-51-0" })]) === false, "an unpublished row cannot switch the column on");

// ── c. purity cell ──────────────────────────────────────────────────────
console.log("\nc. purity cell: value, identity-only chip, or honest blank:");
ok(purityCell(row({ purity_percent: 99.1 })).kind === "value", "numeric purity → value");
ok(purityCell(row({ purity_percent: 99.1 })).text === "99.1%", "value text is the formatted purity");
ok(
  purityCell(row({ purity_percent: 99, purity_operator: ">=" })).text === ">= 99%",
  "purity operator is preserved (>= 99% never shown as 99%)"
);
const identityOnly = purityCell(row({ purity_percent: null, hplc: null, ms_confirmed: true }));
ok(identityOnly.kind === "chip" && identityOnly.text === IDENTITY_ONLY_LABEL, `null purity + MS confirmed → chip "${IDENTITY_ONLY_LABEL}"`);
ok(
  purityCell(row({ purity_percent: null, hplc: "≥ 98%", ms_confirmed: true })).kind === "value",
  "null purity_percent but an HPLC text value → that value, not the chip"
);
ok(purityCell(row({ purity_percent: null, hplc: null, ms_confirmed: false })).kind === "empty", "null purity + MS NOT confirmed → empty (the honest state)");
ok(purityCell(row({ purity_percent: null, hplc: null, ms_confirmed: null })).kind === "empty", "null purity + MS unknown → empty");

// ── Rendered components: the rules hold in real markup ──────────────────
const outfile = path.join(process.cwd(), `.coa-table-test-${Date.now()}.mjs`);
await build({
  entryPoints: [path.join(process.cwd(), "scripts/_coa-table-entry.jsx")],
  bundle: true,
  format: "esm",
  outfile,
  jsx: "automatic",
  external: ["react", "react-dom", "react/jsx-runtime"],
  logLevel: "silent",
});
const { BatchHistoryTable, CoaCard, MemoryRouter } = await import(`file://${outfile}`);
const inRouter = (el) => renderToStaticMarkup(createElement(MemoryRouter, null, el));
const table = (rows, props = {}) =>
  inRouter(createElement(BatchHistoryTable, { rows, captionId: "c", productName: "BPC-157", ...props }));

console.log("\n<BatchHistoryTable> renders the rules:");
{
  const html = table([row({ id: "1", file_url: "https://x.test/coa.jpg" })]);
  ok(html.includes(">Certificate image<") || />\s*Certificate image\s*</.test(html), "image certificate link reads 'Certificate image'");
  ok(!/>\s*PDF\s*</.test(html), "an image certificate is NOT labelled PDF");
  ok(html.includes('aria-label="Certificate image for lot L1"'), "aria-label carries the real type");
}
{
  const html = table([row({ id: "1", file_url: "https://x.test/coa.pdf" })]);
  ok(/>\s*PDF\s*</.test(html), "a .pdf certificate link reads 'PDF'");
}
{
  const html = table(noCas);
  ok(!html.includes(">CAS<"), "CAS column absent when no row has a CAS");
  const html2 = table(someCas);
  ok(html2.includes(">CAS<") && html2.includes("137525-51-0"), "CAS column present, with the value, when a row has one");
  ok(!table(someCas, { showCas: false }).includes(">CAS<"), "explicit showCas=false (page-level decision) overrides");
  ok(table(noCas, { showCas: true }).includes(">CAS<"), "explicit showCas=true keeps every table on a page consistent");
}
{
  const html = table([row({ id: "1", purity_percent: null, hplc: null, ms_confirmed: true })]);
  ok(html.includes('data-testid="identity-only-chip"') && html.includes(IDENTITY_ONLY_LABEL), "identity-only chip renders for MS-confirmed rows without purity");
  const blank = table([row({ id: "1", purity_percent: null, hplc: null, ms_confirmed: false })]);
  ok(!blank.includes(IDENTITY_ONLY_LABEL), "no chip when identity is not confirmed");
}

console.log("\n<CoaCard> link label:");
{
  const card = (file_url) => inRouter(createElement(CoaCard, { coa: row({ id: "1", file_url }), productName: "BPC-157", showQr: false }));
  ok(card("https://x.test/coa.pdf").includes("View COA (PDF)"), ".pdf → 'View COA (PDF)'");
  ok(card("https://x.test/coa.png").includes("View certificate image"), ".png → 'View certificate image'");
  ok(!card("https://x.test/coa.png").includes("(PDF)"), "image is never called PDF on the card");
  ok(card("https://x.test/coa").includes("View full certificate"), "unknown type → neutral wording");
}

// ── Prerenderer emits the same rules (static guard) ────────────────────
console.log("\nPrerenderer shares the helpers:");
{
  const gen = fs.readFileSync(new URL("../scripts/generate-static-seo.mjs", import.meta.url), "utf8");
  ok(/from "\.\.\/src\/lib\/coaTable\.js"/.test(gen), "generate-static-seo imports src/lib/coaTable");
  ok(/certificateLabel\(c\.file_url\)/.test(gen), "prerendered certificate link uses certificateLabel()");
  ok(/purityCell\(c\)/.test(gen), "prerendered purity cell uses purityCell()");
  ok(/showCas: hasAnyCas\(coaRows\)/.test(gen), "/test-results makes one page-wide CAS decision");
  ok(!/<a href="\$\{escapeHtml\(c\.file_url\)\}">PDF<\/a>/.test(gen), "hardcoded 'PDF' link label is gone");
}

fs.rmSync(outfile, { force: true });

if (failures) {
  console.error(`\n${failures} COA-table-render check(s) FAILED`);
  process.exit(1);
}
console.log("\nAll COA-table-render checks passed.");
