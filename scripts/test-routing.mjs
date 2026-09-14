/*
  scripts/test-routing.mjs   (opt c8 — scorecard 4.6)
  Unknown paths must be REAL 404s, and every real page must still be served.
  Reads the routes React Router declares (src/App.jsx), the prerendered set
  (dist/), and the client-route rewrites (vercel.json), and proves:
    - every declared route is either prerendered or rewritten to the shell
      (dynamic segments are checked with sample values);
    - /api/* is never rewritten; a junk path is never rewritten;
    - the generator emits dist/404.html (what Vercel serves with a 404);
    - scripts/serve-dist.mjs takes its rule from vercel.json (no drift), and
      its matcher agrees on a sample of paths.
  Run after `npm run build`: node scripts/test-routing.mjs
*/
import { readFileSync, existsSync } from "node:fs";
import path from "node:path";

let failures = 0;
const ok = (cond, msg) => {
  if (cond) console.log(`  ✓ ${msg}`);
  else { failures++; console.error(`  ✗ ${msg}`); }
};
const ROOT = process.cwd();
const app = readFileSync(path.join(ROOT, "src/App.jsx"), "utf8");
const routes = [...new Set([...app.matchAll(/<Route path="([^"]+)"/g)].map((m) => m[1]))].filter((p) => p !== "*");
const vercel = JSON.parse(readFileSync(path.join(ROOT, "vercel.json"), "utf8"));
const rewrites = (vercel.rewrites || []).filter((r) => r.destination === "/index.html").map((r) => r.source);
const { rewriteToRegex } = await import("./serve-dist.mjs").catch(() => ({}));
ok(typeof rewriteToRegex === "function", "serve-dist.mjs exports its rewrite matcher");
const matchers = rewrites.map(rewriteToRegex);
const rewritten = (p) => matchers.some((re) => re.test(p));
const prerendered = (p) => existsSync(path.join(ROOT, "dist", p === "/" ? "index.html" : `${p.replace(/^\//, "")}/index.html`));

// Sample values for dynamic segments.
const sample = (p) => p.replace(":category", "tissue-repair-research").replace(":productSlug", "bpc-157")
  .replace("/research/:slug", "/research/purity-vs-content").replace(":slug", "bpc-157").replace(":code", "A1B2C3D4E5F6G");
console.log(`Routing — ${routes.length} declared routes, ${rewrites.length} client rewrites:`);
const unreachable = routes.filter((r) => { const p = sample(r); return !prerendered(p) && !rewritten(p); });
ok(unreachable.length === 0, `every declared route is prerendered or rewritten (missing: ${JSON.stringify(unreachable)})`);
// Prerendered pages must NOT be rewritten to the shell (the file wins on
// Vercel anyway; this keeps the rewrite list minimal and honest).
const doubled = routes.filter((r) => { const p = sample(r); return prerendered(p) && rewritten(p) && !/:/.test(r); });
ok(doubled.length === 0, `no prerendered static route is also rewritten (${JSON.stringify(doubled)})`);
ok(!rewritten("/api/reviews") && !rewritten("/api/admin/labs"), "/api/* is never rewritten");
for (const junk of ["/asdf", "/product/does-not-exist", "/shop/no-such-category", "/research/not-an-article", "/wp-admin", "/index.php"]) {
  ok(!rewritten(junk) && !prerendered(junk), `junk path ${junk} falls to the 404 page`);
}
for (const page of ["/cart", "/checkout", "/account/orders", "/admin/labels", "/v/A1B2C3D4E5F6G", "/products/bpc-157", "/coa/bpc-157", "/catalog", "/auth/confirm"]) {
  ok(rewritten(page), `client route ${page} reaches the shell`);
}
ok(existsSync(path.join(ROOT, "dist/404.html")) && existsSync(path.join(ROOT, "dist/404/index.html")), "dist/404.html and dist/404/index.html both exist");
if (existsSync(path.join(ROOT, "dist/404.html"))) {
  const h = readFileSync(path.join(ROOT, "dist/404.html"), "utf8");
  ok(/noindex/.test(h) && /<script src="\/boot\.js" defer data-entry="\/assets\/index-/.test(h), "404.html is the noindex SPA shell (client routes still hydrate through the boot loader if ever served)");
}
const serve = readFileSync(path.join(ROOT, "scripts/serve-dist.mjs"), "utf8");
ok(/vercel\.json/.test(serve) && /CLIENT_ROUTES/.test(serve), "serve-dist.mjs reads the client routes from vercel.json");

console.log(failures ? `\n${failures} assertion(s) failed` : "\nAll routing assertions passed");
process.exit(failures ? 1 : 0);
