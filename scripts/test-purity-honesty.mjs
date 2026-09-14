/*
  scripts/test-purity-honesty.mjs   (opt cycle 12 — scorecard 4.4 / 4.1)
  Purity is never a constant. The catalog seed carried purity_percent = 99.0
  on every product and the storefront printed "≥ 99% PURE" on all 44 cards
  and product pages — while the site's own published certificates say KPV
  98.54 %, Semax 98.80 %, Tesamorelin 98.49 %. This gate proves:
    1. the static catalog carries NO purity value (every product null);
    2. the card and the specs panel render NO purity text without a
       published certificate, and exactly the certificate's value with one;
    3. no JSX reads product.purity_percent for display, and no "≥ 99%"-style
       literal exists in src/;
    4. the certificate's own value is what the seeded rows below 99 % show.
  Rendering uses esbuild + react-dom/server (as test-coa-table-render does);
  the Supabase-backed readers are stubbed so nothing touches a network.

  Run: node scripts/test-purity-honesty.mjs   (in npm run test:unit)
*/
import { build } from "esbuild";
import { renderToStaticMarkup } from "react-dom/server";
import { createElement } from "react";
import { StaticRouter } from "react-router";
import path from "node:path";
import fs from "node:fs";
import { getAllProducts } from "../src/data/tier1Catalog.js";
import { COA_SEED } from "../src/data/coaSeed.js";

let failures = 0;
const ok = (c, m) => { if (c) console.log(`  ✓ ${m}`); else { failures++; console.error(`  ✗ ${m}`); } };
const read = (rel) => fs.readFileSync(path.join(process.cwd(), rel), "utf8");

const outfile = path.join(process.cwd(), `.purity-test-${Date.now()}.mjs`);
fs.writeFileSync(path.join(process.cwd(), "scripts/_purity-entry.tmp.mjs"),
  'export { default as ProductCard } from "../src/components/ProductCard.jsx";\nexport { default as PeptideSpecsPanel } from "../src/components/PeptideSpecsPanel.jsx";\nexport { getProducts } from "../src/lib/catalog.js";\n');
try {
  await build({
    entryPoints: [path.join(process.cwd(), "scripts/_purity-entry.tmp.mjs")],
    bundle: true, format: "esm", platform: "node", outfile, logLevel: "silent",
    jsx: "automatic",
    define: { "import.meta.env": "{}" },
    external: ["react", "react-dom", "react-router", "react-router-dom", "lucide-react"],
    plugins: [{ name: "stubs", setup(b) {
      b.onResolve({ filter: /(^|\/)lib\/coas(\.js)?$/ }, () => ({ path: "coas-stub", namespace: "stub" }));
      b.onResolve({ filter: /supabaseClient(\.js)?$/ }, () => ({ path: "sb-stub", namespace: "stub" }));
      b.onLoad({ filter: /.*/, namespace: "stub" }, (a) => ({
        contents: a.path === "coas-stub"
          ? "export const getLatestCoaMap = () => Promise.resolve({}); export const getSeedLatestCoaMap = () => ({}); export const getSeedCoas = () => []; export const getAllCoas = async () => []; export const getCoasForProduct = async () => []; export const lookupByLot = async () => null;"
          : "export const supabase = null;",
        loader: "js",
      }));
    } }],
  });
} finally {
  fs.rmSync(path.join(process.cwd(), "scripts/_purity-entry.tmp.mjs"), { force: true });
}
let mod;
try { mod = await import(`file://${outfile}`); } finally { fs.rmSync(outfile, { force: true }); }
const { ProductCard, PeptideSpecsPanel, getProducts } = mod;

console.log("1. Static catalog carries no purity constant:");
{
  const rows = await getProducts(); // supabase stubbed to null → the static fallback
  ok(rows.length >= 40 && rows.every((p) => p.purity_percent == null), `every static product has purity_percent null (${rows.length} products)`);
  ok(getAllProducts().every((p) => p.purity == null && p.purity_percent == null), "the raw catalog carries no purity field either");
}

console.log("\n2. Rendered surfaces (react-dom/server):");

const product = { id: "kpv", slug: "kpv", name: "KPV", price: 42, stock_status: "in_stock", category_slug: "immune-research", purity_percent: 99 };
const cert = { id: "seed-3", product_id: "kpv", lot_number: "JAN-169316", lot: "JAN-169316", purity_percent: 98.54, hplc: "98.537%", ms_confirmed: true, is_published: true, file_url: "/coas/janoshik/kpv.jpg", tested_at: "2026-01-20" };
const card = (props) => renderToStaticMarkup(createElement(StaticRouter, { location: "/shop" }, createElement(ProductCard, props)));
const text = (html) => html.replace(/<[^>]+>/g, " ");
{
  const none = text(card({ product, latestCoa: null }));
  ok(!/PURE|HPLC|\d{2}(\.\d+)?\s*%/.test(none), "card without a published certificate shows no purity text (even when product.purity_percent is set)");
  const withCert = text(card({ product, latestCoa: cert }));
  ok(/98\.54%\s*HPLC/.test(withCert), "card with a published certificate shows that certificate's value (98.54% HPLC)");
  ok(!/99/.test(withCert.replace(/JAN-169316/g, "")), "…and never the seeded 99");
  const panelNone = text(renderToStaticMarkup(createElement(PeptideSpecsPanel, { product })));
  ok(!/Purity/.test(panelNone) || !/%/.test(panelNone), "specs panel without a certificate omits the purity row");
  const panelCert = text(renderToStaticMarkup(createElement(PeptideSpecsPanel, { product, latestCoa: cert })));
  ok(/98\.54%\s*\(HPLC, lot JAN-169316\)/.test(panelCert), "specs panel with a certificate shows value + lot (98.54% (HPLC, lot JAN-169316))");
}

console.log("\n3. Source guards:");
{
  const jsx = [];
  (function walk(d) { for (const e of fs.readdirSync(d, { withFileTypes: true })) { const p = path.join(d, e.name); if (e.isDirectory()) walk(p); else if (/\.(jsx|js)$/.test(e.name)) jsx.push(p); } })(path.join(process.cwd(), "src"));
  const offenders = [];
  for (const f of jsx) {
    const src = fs.readFileSync(f, "utf8").replace(/\/\*[\s\S]*?\*\//g, "").replace(/(^|[^:"'`])\/\/[^\n]*/g, "$1");
    const rel = path.relative(process.cwd(), f);
    if (/≥\s*\{?\s*(product|p)\.purity_percent/.test(src) || /≥ 9[0-9]%/.test(src)) offenders.push(rel);
  }
  ok(offenders.length === 0, `no JSX renders a product-level purity claim or a "≥ 99%" literal (offenders: ${JSON.stringify(offenders)})`);
  const cat = read("src/lib/catalog.js");
  ok(/purity_percent: null,/.test(cat) && !/purity_percent: 99/.test(cat), "src/lib/catalog.js static fallback: purity_percent null");
  ok(fs.existsSync("supabase/migrations/0039_null_seeded_purity.sql") && /where purity_percent = 99\.0/.test(read("supabase/migrations/0039_null_seeded_purity.sql")), "migration 0039 clears only the seeded 99.0");
}

console.log("\n4. The published certificates below 99 % are real data the gate protects:");
{
  const below = COA_SEED.filter((r) => r.is_published && r.purity_percent != null && Number(r.purity_percent) < 99).map((r) => `${r.product_id} ${r.purity_percent}`);
  ok(below.length >= 3, `seeded certificates below 99 %: ${below.join(", ")}`);
}

if (failures) { console.error(`\n${failures} purity-honesty check(s) FAILED`); process.exit(1); }
console.log("\nAll purity-honesty checks passed.");
