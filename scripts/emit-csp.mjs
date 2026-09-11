/*
  scripts/emit-csp.mjs   (Sept-11 T8) — runs LAST in `npm run build`.

  vercel.json is a static file that the platform reads when the deployment is
  created, not something the build can rewrite, so a build-time-conditional
  policy has to travel in the HTML. When no analytics ID is configured at build
  time, every prerendered page gets a <meta http-equiv="Content-Security-Policy">
  carrying the TIGHTENED policy (no analytics origins; 'unsafe-inline' dropped
  from script-src if, and only if, no inline executable <script> exists in any
  emitted HTML). Browsers enforce both the header and the meta — the effective
  policy is their intersection, i.e. the tighter one.

  With an analytics ID present, nothing is injected: the vercel.json header
  (which allows the analytics origins and the inline bootstrap) governs.

  The decision is written into dist/prerender-meta.json under `csp` for the
  test suite, including which files still need 'unsafe-inline', if any.
*/
import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { analyticsEnabled, buildCsp, injectCspMeta, scanInlineScripts } from "./csp.mjs";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const DIST = path.join(ROOT, "dist");
const META = path.join(DIST, "prerender-meta.json");

async function htmlFiles(dir, out = []) {
  for (const e of await fs.readdir(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) await htmlFiles(p, out);
    else if (e.name === "index.html") out.push(p);
  }
  return out;
}

export async function emitCsp({ env = process.env } = {}) {
  const files = await htmlFiles(DIST);
  const a = analyticsEnabled(env);

  // Scan EVERY emitted HTML for inline executable scripts.
  const inlineScriptFiles = [];
  for (const f of files) {
    const hits = scanInlineScripts(await fs.readFile(f, "utf8"));
    if (hits.length) inlineScriptFiles.push({ file: path.relative(DIST, f), tags: hits });
  }
  const allowInlineScript = a || inlineScriptFiles.length > 0;

  let metaPolicy = null;
  if (!a) {
    metaPolicy = buildCsp({ analyticsEnabled: false, allowInlineScript, forHeader: false });
    for (const f of files) {
      const html = await fs.readFile(f, "utf8");
      await fs.writeFile(f, injectCspMeta(html, metaPolicy), "utf8");
    }
  }

  const decision = {
    analyticsEnabled: a,
    unsafeInlineKept: allowInlineScript,
    inlineScriptFiles: inlineScriptFiles.map((x) => x.file),
    metaInjected: !a,
    metaPolicy,
    files: files.length,
  };

  let meta = {};
  try { meta = JSON.parse(await fs.readFile(META, "utf8")); } catch { /* first writer */ }
  await fs.writeFile(META, JSON.stringify({ ...meta, csp: decision }, null, 2) + "\n", "utf8");

  if (a) {
    console.log("[csp] analytics ID present at build — header policy governs; no <meta> CSP injected");
  } else {
    console.log(`[csp] no analytics at build — tightened <meta> CSP injected into ${files.length} pages` +
      (allowInlineScript ? " ('unsafe-inline' KEPT: inline scripts remain)" : " ('unsafe-inline' removed from script-src)"));
    if (inlineScriptFiles.length) {
      console.warn("[csp] files that still contain an inline executable <script> (need 'unsafe-inline'):");
      for (const x of inlineScriptFiles) console.warn(`  - ${x.file}: ${x.tags.join(" ")}`);
    }
  }
  return decision;
}

const invokedDirectly = process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (invokedDirectly) {
  emitCsp().catch((err) => {
    console.error("[csp] failed:", err);
    process.exit(1);
  });
}
