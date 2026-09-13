/*
  scripts/test-fonts-selfhosted.mjs   (opt cycle 2 — scorecard 4.7)
  Fonts are served from our own origin. Asserts, on the BUILT dist:
    - no prerendered HTML or built CSS references fonts.googleapis.com or
      fonts.gstatic.com (no third-party hop, no preconnect);
    - every @font-face url() in the built CSS resolves to a file in dist/;
    - the three families are declared, and the licence notice ships.

  Run: node scripts/test-fonts-selfhosted.mjs   (wired into npm run test:unit)
*/
import fs from "node:fs";
import path from "node:path";

let failures = 0;
const ok = (cond, msg) => {
  if (cond) console.log(`  ✓ ${msg}`);
  else {
    failures++;
    console.error(`  ✗ ${msg}`);
  }
};
const DIST = path.join(process.cwd(), "dist");
if (!fs.existsSync(path.join(DIST, "index.html"))) {
  if (process.env.CI) { console.error("dist/ missing in CI — build must precede this check."); process.exit(1); }
  console.log("  ⓘ SKIPPED — dist/ not built.");
  process.exit(0);
}
const files = [];
(function walk(d) { for (const e of fs.readdirSync(d, { withFileTypes: true })) { const p = path.join(d, e.name); if (e.isDirectory()) walk(p); else if (/\.(html|css)$/.test(e.name)) files.push(p); } })(DIST);
// A REFERENCE is a <link href>, a CSS @import, or a url() pointing at a
// Google Fonts host — those cause a request. The CSP <meta> merely LISTS the
// hosts as allowed origins and causes no request; that is a separate, proposed
// tightening (the CSP block in vercel.json is ask-before).
const REF = /(href=["']https?:\/\/fonts\.(googleapis|gstatic)\.com|@import\s+(url\()?["']?https?:\/\/fonts\.(googleapis|gstatic)\.com|url\(["']?https?:\/\/fonts\.(googleapis|gstatic)\.com)/;
const hits = files.filter((f) => REF.test(fs.readFileSync(f, "utf8"))).map((f) => path.relative(DIST, f));
console.log(`Self-hosted fonts — ${files.length} HTML/CSS files scanned:`);
ok(hits.length === 0, `no HTML/CSS makes a request to a Google Fonts host (${JSON.stringify(hits.slice(0, 4))})`);
ok(!/rel="preconnect"[^>]*google/.test(fs.readFileSync(path.join(DIST, "index.html"), "utf8")), "no preconnect to a Google Fonts host");
const css = files.filter((f) => f.endsWith(".css")).map((f) => fs.readFileSync(f, "utf8")).join("\n");
const urls = [...css.matchAll(/@font-face\s*\{[^}]*url\((['"]?)([^'")]+)\1\)/g)].map((m) => m[2]);
ok(urls.length >= 3, `built CSS declares ≥3 self-hosted @font-face sources (${urls.length})`);
const missing = urls.filter((u) => !fs.existsSync(path.join(DIST, u.replace(/^\//, ""))));
ok(missing.length === 0, `every @font-face file exists in dist (${JSON.stringify(missing)})`);
ok(urls.every((u) => u.startsWith("/fonts/")), "every font is served from /fonts on our origin");
for (const fam of ["Syne", "DM Sans", "IBM Plex Mono"]) ok(new RegExp(`font-family:\\s*['"]?${fam}['"]?`).test(css), `${fam} declared`);
ok(fs.existsSync(path.join(process.cwd(), "public/fonts/LICENSE.txt")) && /Open Font License/.test(fs.readFileSync(path.join(process.cwd(), "public/fonts/LICENSE.txt"), "utf8")), "OFL licence notice ships with the files");
const total = urls.reduce((n, u) => n + (fs.existsSync(path.join(DIST, u.replace(/^\//, ""))) ? fs.statSync(path.join(DIST, u.replace(/^\//, ""))).size : 0), 0);
ok(total <= 400 * 1024, `font payload ≤ 400 KB (${(total / 1024).toFixed(0)} KB)`);

if (failures) { console.error(`\n${failures} self-hosted-font check(s) FAILED`); process.exit(1); }
console.log("\nAll self-hosted-font checks passed.");
