/*
  scripts/test-csp.mjs   (Sept-11 T8)
  Content-Security-Policy tightening. Proves:
    - the no-analytics policy carries NO analytics origin and NO
      'unsafe-inline' in script-src (style-src keeps it — Tailwind/inline
      styles), and no cdn.jsdelivr.net anywhere;
    - the analytics policy carries the origins and 'unsafe-inline';
    - vercel.json's static header EQUALS the builder's header variant (single
      source; no drift), and no longer mentions cdn.jsdelivr.net;
    - the inline-script scanner flags executable inline scripts and ignores
      JSON-LD / src'd / data blocks;
    - on the BUILT dist with no analytics: every page carries the <meta> CSP
      with the tightened policy; 'unsafe-inline' is kept iff an inline script
      remained, and those files are named.

  Run: node scripts/test-csp.mjs   (wired into npm run test:unit)
*/
import fs from "node:fs";
import path from "node:path";
import { buildCsp, scanInlineScripts, injectCspMeta, analyticsEnabled, ANALYTICS } from "./csp.mjs";

let failures = 0;
const ok = (cond, msg) => {
  if (cond) console.log(`  ✓ ${msg}`);
  else {
    failures++;
    console.error(`  ✗ ${msg}`);
  }
};
const directive = (policy, name) => (policy.split(";").map((s) => s.trim()).find((s) => s.startsWith(name + " ")) || "");
const ALL_ANALYTICS = [...new Set([...ANALYTICS.script, ...ANALYTICS.img, ...ANALYTICS.connect])];

console.log("analyticsEnabled(env):");
ok(analyticsEnabled({}) === false, "no IDs → off");
ok(analyticsEnabled({ VITE_GA_MEASUREMENT_ID: "G-1" }) === true, "GA id → on");
ok(analyticsEnabled({ VITE_META_PIXEL_ID: "123" }) === true, "Meta pixel id → on");
ok(analyticsEnabled({ VITE_GA_MEASUREMENT_ID: "  " }) === false, "whitespace id → off");

console.log("\nno-analytics policy (the launch default):");
const tight = buildCsp({ analyticsEnabled: false, allowInlineScript: false });
for (const o of ALL_ANALYTICS) ok(!tight.includes(o), `no ${o}`);
ok(!tight.includes("cdn.jsdelivr.net"), "no cdn.jsdelivr.net (nothing loads from it)");
ok(!directive(tight, "script-src").includes("'unsafe-inline'"), "script-src has no 'unsafe-inline'");
ok(directive(tight, "style-src").includes("'unsafe-inline'"), "style-src keeps 'unsafe-inline' (Tailwind / inline styles)");
ok(directive(tight, "script-src").includes("*.stripe.com") && directive(tight, "frame-src").includes("js.stripe.com"), "Stripe stays allowed");
ok(directive(tight, "connect-src").includes("*.supabase.co") && directive(tight, "connect-src").includes("wss://*.supabase.co"), "Supabase REST + realtime stay allowed");
ok(!tight.includes("frame-ancestors"), "meta variant omits frame-ancestors (ignored in <meta>; the header carries it)");
ok(/object-src 'none'/.test(tight) && /base-uri 'self'/.test(tight) && /upgrade-insecure-requests;/.test(tight), "hardening directives present");
const tightKeepInline = buildCsp({ analyticsEnabled: false, allowInlineScript: true });
ok(directive(tightKeepInline, "script-src").includes("'unsafe-inline'") && !ALL_ANALYTICS.some((o) => tightKeepInline.includes(o)), "inline-kept variant: 'unsafe-inline' back, analytics still out");

console.log("\nanalytics policy:");
const loose = buildCsp({ analyticsEnabled: true, allowInlineScript: true, forHeader: true });
for (const o of ANALYTICS.script) ok(directive(loose, "script-src").includes(o), `script-src allows ${o}`);
for (const o of ANALYTICS.connect) ok(directive(loose, "connect-src").includes(o), `connect-src allows ${o}`);
ok(directive(loose, "script-src").includes("'unsafe-inline'"), "script-src allows 'unsafe-inline' (analytics bootstrap is inline)");
ok(/frame-ancestors 'none'/.test(loose), "header variant carries frame-ancestors 'none'");
ok(!loose.includes("cdn.jsdelivr.net"), "even the loose policy has no cdn.jsdelivr.net");

console.log("\nvercel.json is derived from the same builder:");
{
  const v = JSON.parse(fs.readFileSync(new URL("../vercel.json", import.meta.url), "utf8"));
  const header = v.headers.flatMap((h) => h.headers).find((kv) => kv.key === "Content-Security-Policy")?.value;
  ok(typeof header === "string" && header.length > 0, "vercel.json has a CSP header");
  ok(header === loose, "vercel.json CSP === buildCsp({analytics:true, inline:true, forHeader:true}) — no drift");
  ok(!header.includes("cdn.jsdelivr.net"), "vercel.json CSP no longer allows cdn.jsdelivr.net");
}

console.log("\nscanInlineScripts:");
ok(scanInlineScripts('<script type="application/ld+json">{}</script>').length === 0, "JSON-LD data block is not executable");
ok(scanInlineScripts('<script type="module" crossorigin src="/a.js"></script>').length === 0, "src'd module is not inline");
ok(scanInlineScripts("<script>alert(1)</script>").length === 1, "bare inline <script> IS flagged");
ok(scanInlineScripts('<script type="text/javascript">x()</script>').length === 1, "type=text/javascript inline IS flagged");
ok(scanInlineScripts('<script type="module">import x from "/a.js"</script>').length === 1, "inline module IS flagged");
ok(scanInlineScripts('<script type="application/json" id="d">{}</script>').length === 0, "JSON data block ignored");
ok(scanInlineScripts("").length === 0 && scanInlineScripts(null).length === 0, "empty/null → none");

console.log("\ninjectCspMeta:");
{
  const html = '<!doctype html><html><head><meta charset="UTF-8" />\n<title>t</title></head><body></body></html>';
  const out = injectCspMeta(html, tight);
  ok(out.indexOf('http-equiv="Content-Security-Policy"') > out.indexOf('<meta charset') && out.indexOf('http-equiv="Content-Security-Policy"') < out.indexOf("<title>"), "meta lands right after charset, before anything else");
  ok(injectCspMeta(out, tight) === out, "idempotent (a second injection is a no-op)");
  ok(injectCspMeta("<html><head><title>t</title></head></html>", tight).includes('<head>\n    <meta http-equiv="Content-Security-Policy"'), "falls back to after <head> when no charset meta");
}

console.log("\nbuilt dist:");
{
  const DIST = path.join(process.cwd(), "dist");
  const metaPath = path.join(DIST, "prerender-meta.json");
  if (!fs.existsSync(metaPath)) {
    if (process.env.CI) { console.error("dist/prerender-meta.json missing in CI — build must precede this check."); process.exit(1); }
    console.log("  ⓘ SKIPPED — dist/ not built.");
  } else {
    const meta = JSON.parse(fs.readFileSync(metaPath, "utf8"));
    ok(meta.csp && typeof meta.csp.analyticsEnabled === "boolean", "build recorded its CSP decision");
    const files = [];
    (function walk(d) { for (const e of fs.readdirSync(d, { withFileTypes: true })) { const p = path.join(d, e.name); if (e.isDirectory()) walk(p); else if (e.name === "index.html") files.push(p); } })(DIST);
    if (meta.csp.analyticsEnabled) {
      ok(files.every((f) => !fs.readFileSync(f, "utf8").includes('http-equiv="Content-Security-Policy"')), "analytics on → no <meta> CSP injected (header governs)");
    } else {
      const expected = buildCsp({ analyticsEnabled: false, allowInlineScript: meta.csp.unsafeInlineKept, forHeader: false });
      ok(meta.csp.metaPolicy === expected, "recorded meta policy matches the builder for this build's decision");
      const missing = files.filter((f) => !fs.readFileSync(f, "utf8").includes(`content="${expected.replace(/"/g, "&quot;")}"`)).map((f) => path.relative(DIST, f));
      ok(missing.length === 0, `every prerendered page carries the tightened <meta> CSP (missing: ${JSON.stringify(missing.slice(0, 5))})`);
      ok(meta.csp.unsafeInlineKept === (meta.csp.inlineScriptFiles.length > 0), "'unsafe-inline' kept iff an inline executable script remained");
      if (meta.csp.inlineScriptFiles.length) console.log(`  ⓘ files needing 'unsafe-inline': ${meta.csp.inlineScriptFiles.join(", ")}`);
      else ok(!directive(meta.csp.metaPolicy, "script-src").includes("'unsafe-inline'"), "no inline scripts remained → 'unsafe-inline' removed from script-src");
      // Independent re-scan: the recorded list must match reality.
      const rescan = files.filter((f) => scanInlineScripts(fs.readFileSync(f, "utf8")).length > 0).map((f) => path.relative(DIST, f)).sort();
      ok(JSON.stringify(rescan) === JSON.stringify([...meta.csp.inlineScriptFiles].sort()), "recorded inline-script files match an independent re-scan of dist");
    }
  }
}

if (failures) {
  console.error(`\n${failures} CSP check(s) FAILED`);
  process.exit(1);
}
console.log("\nAll CSP checks passed.");
