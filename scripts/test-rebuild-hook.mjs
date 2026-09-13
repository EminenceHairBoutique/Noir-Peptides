/*
  scripts/test-rebuild-hook.mjs   (opt cycle 4 — scorecards 4.1 / 4.6 / 4.11)
  A category visibility flip must reach the CDN, not only the database.
  Executes the REAL api/admin/catalog.js PATCH against the in-memory stub
  with `fetch` stubbed and proves:
    - flipping soft_launch_hidden POSTs the Vercel deploy hook once and the
      response reports rebuild: "triggered"; the audit log records it;
    - with no hook configured the flip still succeeds and reports
      rebuild: "not_configured" (honest, not silent);
    - a hook that fails or throws reports "failed" and never fails the flip;
    - a non-Vercel URL is refused (no arbitrary outbound POST from an admin
      env var);
    - a product edit, or a flip to the same value, triggers nothing;
    - the Control Room renders the three states.

  Run: node scripts/test-rebuild-hook.mjs   (wired into npm run test:unit)
*/
import { build } from "esbuild";
import path from "node:path";
import fs from "node:fs";

let failures = 0;
const ok = (cond, msg) => {
  if (cond) console.log(`  ✓ ${msg}`);
  else { failures++; console.error(`  ✗ ${msg}`); }
};
process.env.VITE_SUPABASE_URL ||= "https://placeholder.supabase.co";
process.env.VITE_SUPABASE_ANON_KEY ||= "placeholder";
process.env.SUPABASE_SERVICE_ROLE_KEY ||= "placeholder";
delete process.env.VERCEL_DEPLOY_HOOK_URL;

const outfile = path.join(process.cwd(), `.rebuild-hook-test-${Date.now()}.mjs`);
await build({
  entryPoints: [path.join(process.cwd(), "scripts/_admin-entry.mjs")],
  bundle: true, format: "esm", platform: "node", outfile, logLevel: "silent",
  plugins: [{
    name: "stubs",
    setup(b) {
      b.onResolve({ filter: /supabaseServer\.js$/ }, () => ({ path: path.join(process.cwd(), "scripts/_admin-stub-supabase.mjs") }));
      b.onResolve({ filter: /_utils\/auth\.js$/ }, () => ({ path: path.join(process.cwd(), "scripts/_admin-stub-auth.mjs") }));
    },
  }],
});
const { catalogHandler, triggerRebuild, FIXTURES, LOG } = await import(`file://${outfile}`);
fs.unlinkSync(outfile);

function makeRes() {
  const r = { statusCode: null, payload: null, headers: {} };
  r.setHeader = (k, v) => { r.headers[k] = v; };
  r.end = (p) => { try { r.payload = JSON.parse(p); } catch { r.payload = p; } return r; };
  return r;
}
const patch = async (body) => { const res = makeRes(); await catalogHandler({ method: "PATCH", url: "/api/admin/catalog", headers: {}, body }, res); return res; };
const HOOK = "https://api.vercel.com/v1/integrations/deploy/prj_test/abc123";
const calls = [];
const stubFetch = (impl) => { globalThis.fetch = async (url, init) => { calls.push({ url, method: init?.method }); return impl(); }; };

console.log("triggerRebuild:");
ok((await triggerRebuild()) === "not_configured", "no env → not_configured");
process.env.VERCEL_DEPLOY_HOOK_URL = "https://evil.example/hook";
ok((await triggerRebuild(async () => ({ ok: true }))) === "not_configured", "non-Vercel URL → refused (not_configured), nothing fetched");
process.env.VERCEL_DEPLOY_HOOK_URL = HOOK;
ok((await triggerRebuild(async () => ({ ok: true }))) === "triggered", "hook 2xx → triggered");
ok((await triggerRebuild(async () => ({ ok: false, status: 500 }))) === "failed", "hook 5xx → failed");
ok((await triggerRebuild(async () => { throw new Error("ECONNRESET"); })) === "failed", "hook throws → failed (never throws out)");

console.log("\nPATCH category flip:");
FIXTURES.product_categories = [{ slug: "metabolic", name: "Metabolic & Incretin", soft_launch_hidden: false }];
FIXTURES.products = []; FIXTURES.product_variants = []; FIXTURES.audit_logs = [];
stubFetch(async () => ({ ok: true }));
let r = await patch({ kind: "category", id: "metabolic", soft_launch_hidden: true });
ok(r.statusCode === 200, `flip → 200 (${r.statusCode}) ${r.statusCode !== 200 ? JSON.stringify(r.payload) : ""}`);
ok(r.payload?.category?.soft_launch_hidden === true, "category row updated");
ok(r.payload?.rebuild === "triggered", `response reports rebuild: triggered (${r.payload?.rebuild})`);
ok(calls.length === 1 && calls[0].url === HOOK && calls[0].method === "POST", `exactly one POST to the hook (${calls.length})`);
ok(LOG.some((l) => l.table === "audit_logs" && l.row?.action === "catalog.rebuild" && l.row?.metadata?.rebuild === "triggered"), "audit log records catalog.rebuild = triggered");

calls.length = 0;
r = await patch({ kind: "category", id: "metabolic", soft_launch_hidden: true });
ok(r.statusCode === 200 && !("rebuild" in r.payload) && calls.length === 0, "flip to the SAME value → no rebuild, no POST");

delete process.env.VERCEL_DEPLOY_HOOK_URL;
r = await patch({ kind: "category", id: "metabolic", soft_launch_hidden: false });
ok(r.statusCode === 200 && r.payload?.rebuild === "not_configured" && calls.length === 0, "no hook configured → flip succeeds, rebuild: not_configured");

process.env.VERCEL_DEPLOY_HOOK_URL = HOOK;
stubFetch(async () => { throw new Error("down"); });
r = await patch({ kind: "category", id: "metabolic", soft_launch_hidden: true });
ok(r.statusCode === 200 && r.payload?.rebuild === "failed" && r.payload?.category?.soft_launch_hidden === true, "hook down → flip still succeeds, rebuild: failed");

calls.length = 0;
FIXTURES.products = [{ id: "p1", slug: "bpc-157", name: "BPC-157", stock_status: "in_stock", low_stock_threshold: 3 }];
r = await patch({ kind: "product", id: "p1", stock_status: "low_stock" });
ok(r.statusCode === 200 && !("rebuild" in r.payload) && calls.length === 0, `a product edit triggers no rebuild (${r.statusCode})`);

console.log("\nControl Room wiring:");
const ui = fs.readFileSync(path.join(process.cwd(), "src/pages/AdminHome.jsx"), "utf8");
ok(/setRebuild\(r\.rebuild \|\| null\)/.test(ui), "CategoryRow stores the rebuild state from the response");
for (const k of ["triggered", "not_configured", "failed"]) ok(new RegExp(`${k}: "`).test(ui), `REBUILD_COPY has a sentence for "${k}"`);
ok(/data-testid="rebuild-status"/.test(ui), "the sentence renders under the row");
const env = fs.readFileSync(path.join(process.cwd(), ".env.example"), "utf8");
ok(/^VERCEL_DEPLOY_HOOK_URL=/m.test(env), ".env.example documents VERCEL_DEPLOY_HOOK_URL");

console.log(failures ? `\n${failures} assertion(s) failed` : "\nAll rebuild-hook assertions passed");
process.exit(failures ? 1 : 0);
