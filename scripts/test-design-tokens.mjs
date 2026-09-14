/*
  scripts/test-design-tokens.mjs   (opt cycle 11 — scorecard 4.8)
  The design-token contract (docs/DESIGN_TOKENS.md):
    1. src/index.css :root is the ONLY place a palette hex is written; the
       Tailwind namespace (@theme inline) maps onto those tokens with var()
       references and carries no literal.
    2. Every @theme colour is used by at least one utility in src/ (no dead
       tokens), and every :root token is referenced somewhere (CSS or theme).
    3. The dead artefacts stay dead: no tailwind.config.js, no src/input.css,
       no --font-family-* theme lines (not a v4 namespace).
    4. Ratchet on colour literals in src JSX — hex, rgba(), arbitrary
       colour classes (bg-[#…]), and palette hexes re-typed as literals. The
       ceilings are the counts at the audit; they may go down, never up.
  Run: node scripts/test-design-tokens.mjs [--dump]   (in npm run test:unit)
*/
import fs from "node:fs";
import path from "node:path";

let failures = 0;
const ok = (c, m) => { if (c) console.log(`  ✓ ${m}`); else { failures++; console.error(`  ✗ ${m}`); } };
const DUMP = process.argv.includes("--dump");
const css = fs.readFileSync(path.join(process.cwd(), "src/index.css"), "utf8");
const stripComments = (s) => s.replace(/\/\*[\s\S]*?\*\//g, "");

function block(src, opener) {
  const i = src.indexOf(opener);
  if (i < 0) return "";
  let depth = 0;
  for (let j = i; j < src.length; j++) {
    if (src[j] === "{") depth++;
    else if (src[j] === "}") { depth--; if (depth === 0) return src.slice(i, j + 1); }
  }
  return "";
}
const root = stripComments(block(css, ":root {"));
const theme = stripComments(block(css, "@theme inline {"));
const HEX = /#[0-9a-fA-F]{3,8}\b/g;

function* walk(dir) {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) yield* walk(p);
    else if (/\.(jsx|js|css)$/.test(e.name)) yield p;
  }
}
const srcFiles = [...walk(path.join(process.cwd(), "src"))];
const jsx = srcFiles.filter((f) => f.endsWith(".jsx")).map((f) => [path.relative(process.cwd(), f), fs.readFileSync(f, "utf8")]);
const allSrc = srcFiles.map((f) => fs.readFileSync(f, "utf8")).join("\n");

console.log("1. One source of hex — :root; the theme maps with var():");
{
  ok(root.length > 0 && theme.length > 0, ":root and @theme inline blocks exist in src/index.css");
  ok(!HEX.test(theme) && !/rgba?\(/.test(theme), "@theme inline carries no colour literal (every entry is a var() reference)");
  ok(!/--font-family-/.test(css), "no --font-family-* theme lines (dead v3-style namespace)");
  const rootHex = (root.match(HEX) || []).map((h) => h.toLowerCase());
  const dupes = rootHex.filter((h, i) => rootHex.indexOf(h) !== i);
  ok(dupes.length === 0, `each palette hex is written once in :root (dupes: ${JSON.stringify([...new Set(dupes)])})`);
  const rest = stripComments(css.replace(block(css, ":root {"), "").replace(block(css, "@theme inline {"), ""));
  const leaked = (rest.match(HEX) || []).map((h) => h.toLowerCase()).filter((h) => rootHex.includes(h));
  ok(leaked.length === 0, `no palette hex is re-typed elsewhere in index.css (found: ${JSON.stringify([...new Set(leaked)])})`);
}

console.log("\n2. No dead tokens:");
{
  const themeNames = [...theme.matchAll(/--color-([\w-]+):/g)].map((m) => m[1]);
  ok(themeNames.length >= 20, `theme exposes ${themeNames.length} colour tokens`);
  const dead = themeNames.filter((n) => !new RegExp(`[a-z-]-${n.replace(/[-]/g, "\\-")}(?![\\w-])`).test(allSrc));
  ok(dead.length === 0, `every theme colour is used by a utility in src/ (unused: ${JSON.stringify(dead)})`);
  const rootNames = [...root.matchAll(/(--[\w-]+):/g)].map((m) => m[1]);
  const unref = rootNames.filter((n) => !new RegExp(`var\\(${n}\\)`).test(theme + stripComments(css).replace(root, "") + allSrc));
  ok(unref.length === 0, `every :root token is referenced (unreferenced: ${JSON.stringify(unref)})`);
}

console.log("\n3. Dead artefacts stay deleted:");
ok(!fs.existsSync(path.join(process.cwd(), "tailwind.config.js")), "tailwind.config.js is gone (v4 reads no config; it described another brand)");
ok(!fs.existsSync(path.join(process.cwd(), "src/input.css")), "src/input.css is gone (never imported)");
ok(!/tailwind\.config|input\.css/.test(fs.readFileSync(path.join(process.cwd(), "package.json"), "utf8") + fs.readFileSync(path.join(process.cwd(), "vite.config.js"), "utf8")), "nothing references them");

console.log("\n4. Literal ratchet (src JSX) — may fall, never rise:");
{
  const CEIL = { hex: 37, rgba: 9, arbitrary: 26, paletteLiterals: 6 };
  const rootHexSet = new Set((root.match(HEX) || []).map((h) => h.toLowerCase()));
  const counts = { hex: 0, rgba: 0, arbitrary: 0, paletteLiterals: 0 };
  const perFile = {};
  for (const [rel, src] of jsx) {
    const s = stripComments(src).replace(/(^|[^:"'`])\/\/[^\n]*/g, "$1");
    const hex = (s.match(/#[0-9a-fA-F]{6}\b/g) || []);
    const rgba = (s.match(/rgba?\(/g) || []);
    const arb = (s.match(/(bg|text|border|from|to|via|ring|shadow|fill|stroke|outline|decoration|accent)-\[#[0-9a-fA-F]{3,8}\]/g) || []);
    const pal = hex.filter((h) => rootHexSet.has(h.toLowerCase()));
    counts.hex += hex.length; counts.rgba += rgba.length; counts.arbitrary += arb.length; counts.paletteLiterals += pal.length;
    if (hex.length || rgba.length || arb.length) perFile[rel] = { hex: hex.length, rgba: rgba.length, arbitrary: arb.length, palette: pal.length };
  }
  if (DUMP) console.log(JSON.stringify({ counts, perFile }, null, 1));
  for (const k of Object.keys(CEIL)) ok(counts[k] <= CEIL[k], `${k}: ${counts[k]} ≤ ${CEIL[k]}`);
  console.log(`  ⓘ counts ${JSON.stringify(counts)} — lower the ceilings in this file when they fall`);
}

if (failures) { console.error(`\n${failures} design-token check(s) FAILED`); process.exit(1); }
console.log("\nAll design-token checks passed.");
