/*
  scripts/test-dist-hygiene.mjs   (opt c8 — scorecards 4.8 / 4.4)
  "No dead links, no placeholder text, no lorem, no 'coming soon' on public
  routes" — and no leaked runtime values. Extracts what a person or crawler
  reads from every prerendered page (same extractor as the rendered-copy
  gate: visible text, meta descriptions, JSON-LD strings, alt / aria / title
  attributes — never scripts or class names) and fails on: lorem ipsum,
  "coming soon", TBD / TODO / FIXME, "[object Object]", "undefined", "NaN",
  "null", "Invalid Date", unrendered template braces, and a bare
  "placeholder" outside an input hint.

  Run after `npm run build`: node scripts/test-dist-hygiene.mjs
*/
import { readdirSync, statSync, readFileSync, existsSync } from "node:fs";
import path from "node:path";

let failures = 0;
const ok = (cond, msg) => {
  if (cond) console.log(`  ✓ ${msg}`);
  else { failures++; console.error(`  ✗ ${msg}`); }
};
const DIST = path.join(process.cwd(), "dist");
if (!existsSync(path.join(DIST, "index.html"))) { console.error("dist/index.html missing — run `npm run build` first."); process.exit(1); }

const decode = (s) => s.replace(/&amp;/g, "&").replace(/&#39;|&apos;/g, "'").replace(/&quot;/g, '"').replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&nbsp;/g, " ").replace(/&#(\d+);/g, (_, n) => String.fromCharCode(n));
function renderedText(html) {
  const parts = [];
  for (const m of html.matchAll(/<script[^>]*type="application\/ld\+json"[^>]*>([\s\S]*?)<\/script>/gi)) {
    try { const walk = (v) => { if (typeof v === "string") parts.push(v); else if (v && typeof v === "object") Object.values(v).forEach(walk); }; walk(JSON.parse(m[1])); } catch { parts.push(m[1]); }
  }
  for (const m of html.matchAll(/<meta[^>]+(?:name|property)="(?:description|og:description|twitter:description|og:title|twitter:title)"[^>]*content="([^"]*)"/gi)) parts.push(m[1]);
  for (const m of html.matchAll(/<title>([\s\S]*?)<\/title>/gi)) parts.push(m[1]);
  for (const m of html.matchAll(/\s(?:alt|aria-label|title)="([^"]*)"/gi)) if (m[1]) parts.push(m[1]);
  const body = html.replace(/<script[\s\S]*?<\/script>/gi, " ").replace(/<style[\s\S]*?<\/style>/gi, " ").replace(/<[^>]+>/g, " ");
  parts.push(body);
  return decode(parts.join(" \n ")).replace(/[ \t]+/g, " ");
}
const walk = (d, out = []) => { for (const e of readdirSync(d)) { const p = path.join(d, e); if (statSync(p).isDirectory()) walk(p, out); else if (e === "index.html") out.push(p); } return out; };
const pages = walk(DIST).map((p) => ["/" + path.relative(DIST, path.dirname(p)).split(path.sep).filter(Boolean).join("/"), renderedText(readFileSync(p, "utf8"))]);

const RULES = [
  [/lorem ipsum|\blorem\b/i, "lorem ipsum"],
  [/coming soon/i, "\"coming soon\""],
  [/\b(TBD|TODO|FIXME|XXX)\b/, "TBD / TODO / FIXME"],
  [/\[object Object\]/, "[object Object]"],
  [/\bundefined\b/, "\"undefined\""],
  [/\bNaN\b/, "NaN"],
  [/(^|[\s(>])null([\s)<.,]|$)/, "\"null\""],
  [/Invalid Date/, "Invalid Date"],
  [/\{\{[^}]*\}\}|\$\{[^}]*\}/, "unrendered template braces"],
  [/\bplaceholder\b/i, "the word \"placeholder\""],
];
console.log(`Rendered hygiene — ${pages.length} prerendered pages:`);
let bad = 0;
for (const [re, label] of RULES) {
  const hits = pages.filter(([, t]) => re.test(t)).map(([p, t]) => `${p} …${t.slice(Math.max(0, t.search(re) - 40), t.search(re) + 40).replace(/\s+/g, " ")}…`);
  ok(hits.length === 0, `no page carries ${label} (${hits.length})`);
  for (const h of hits.slice(0, 4)) console.error(`      ${h}`);
  bad += hits.length;
}
ok(pages.length >= 70, `${pages.length} pages scanned`);
console.log(failures ? `\n${failures} assertion(s) failed` : "\nAll rendered-hygiene assertions passed");
process.exit(failures ? 1 : 0);
