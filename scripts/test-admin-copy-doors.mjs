/*
  scripts/test-admin-copy-doors.mjs   (opt c7 — scorecard 4.1)
  Two more admin-entered texts render publicly: a discount's description
  (/deals) and a lab's name (every COA card). Executes the REAL
  api/admin/discounts.js and api/admin/labs.js handlers against the stub and
  proves both are held to lib/labelCopyRules.js at create and patch — 400
  naming the field, nothing written — while clean copy passes.

  Run: node scripts/test-admin-copy-doors.mjs   (wired into npm run test:unit)
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

const outfile = path.join(process.cwd(), `.copy-doors-test-${Date.now()}.mjs`);
await build({
  entryPoints: [path.join(process.cwd(), "scripts/_admin-entry.mjs")],
  bundle: true, format: "esm", platform: "node", outfile, logLevel: "silent",
  plugins: [{ name: "stubs", setup(b) {
    b.onResolve({ filter: /supabaseServer\.js$/ }, () => ({ path: path.join(process.cwd(), "scripts/_admin-stub-supabase.mjs") }));
    b.onResolve({ filter: /_utils\/auth\.js$/ }, () => ({ path: path.join(process.cwd(), "scripts/_admin-stub-auth.mjs") }));
    b.onResolve({ filter: /_utils\/rateLimit\.js$/ }, () => ({ path: path.join(process.cwd(), "scripts/_stub-rate-limit.mjs") }));
  } }],
});
const { discountsHandler, labsHandler, catalogHandler, FIXTURES, LOG } = await import(`file://${outfile}`);
fs.unlinkSync(outfile);
function makeRes() { const r = { statusCode: null, payload: null, headers: {} }; r.setHeader = (k, v) => { r.headers[k] = v; }; r.end = (p) => { try { r.payload = JSON.parse(p); } catch { r.payload = p; } return r; }; return r; }
const call = async (h, method, body, url) => { const r = makeRes(); await h({ method, url, headers: {}, body }, r); return r; };
const writes = (t) => LOG.filter((l) => l.table === t).length;

console.log("Discounts:");
FIXTURES.discounts = []; FIXTURES.audit_logs = [];
let r = await call(discountsHandler, "POST", { code: "LAB10", kind: "percent", value: 10, description: "10% off reference materials for institutional accounts" }, "/api/admin/discounts");
ok(r.statusCode === 200 && r.payload?.discount?.code === "LAB10", `clean description → created (${r.statusCode}) ${r.statusCode !== 200 ? JSON.stringify(r.payload) : ""}`);
const n = writes("discounts");
r = await call(discountsHandler, "POST", { code: "HEAL10", kind: "percent", value: 10, description: "10% off — speeds recovery and healing" }, "/api/admin/discounts");
ok(r.statusCode === 400 && r.payload?.details?.some((d) => d.field === "description"), `outcome claim in a description → 400 naming the field (${r.statusCode})`);
ok(writes("discounts") === n, "the rejected discount was not written");
const id = FIXTURES.discounts[0]?.id;
r = await call(discountsHandler, "PATCH", { id, description: "Reconstitute with 2 mL bacteriostatic water — 10% off" }, "/api/admin/discounts");
ok(r.statusCode === 400 && r.payload?.details?.some((d) => d.reason === "a solvent"), `use language in a patch → 400 (${r.statusCode})`);
ok(FIXTURES.discounts[0].description === "10% off reference materials for institutional accounts", "the rejected patch changed nothing");
r = await call(discountsHandler, "PATCH", { id, description: "10% off for verified institutional accounts" }, "/api/admin/discounts");
ok(r.statusCode === 200, `clean patch → 200 (${r.statusCode})`);

console.log("\nLabs:");
FIXTURES.labs = [];
r = await call(labsHandler, "POST", { name: "Janoshik Analytics", public_lookup_url_template: "https://a.test/r?id={code}" }, "/api/admin/labs");
ok(r.statusCode === 200, `clean lab name → created (${r.statusCode}) ${r.statusCode !== 200 ? JSON.stringify(r.payload) : ""}`);
const m = writes("labs");
r = await call(labsHandler, "POST", { name: "Dosing & Injection Labs" }, "/api/admin/labs");
ok(r.statusCode === 400 && r.payload?.details?.some((d) => d.field === "name"), `use language in a lab name → 400 naming the field (${r.statusCode})`);
ok(writes("labs") === m, "the rejected lab was not written");
const labId = FIXTURES.labs[0]?.id;
r = await call(labsHandler, "PATCH", { id: labId, name: "Therapeutic Outcomes Lab" }, "/api/admin/labs");
ok(r.statusCode === 400, `benefit claim in a renamed lab → 400 (${r.statusCode})`);
r = await call(labsHandler, "PATCH", { id: labId, name: "Janoshik Analytics s.r.o." }, "/api/admin/labs");
ok(r.statusCode === 200, `clean rename → 200 (${r.statusCode})`);

console.log(failures ? `\n${failures} assertion(s) failed` : "\nAll copy-door assertions passed");

// Opt cycle 9 (C7): the storefront code name is admin-entered PUBLIC text
// (shop, PDP, cart, checkout) — same door, same 400, nothing written.
console.log("\nCatalog code_name:");
{
  FIXTURES.products = [{ id: "bpc-157", slug: "bpc-157", name: "BPC-157", price: 44, stock_status: "in_stock", featured: false, is_new: false, code_name: null }];
  const before = writes("products");
  let r = await call(catalogHandler, "PATCH", { kind: "product", id: "bpc-157", code_name: "Weight loss compound for daily use" }, "/api/admin/catalog");
  ok(r.statusCode === 400 && JSON.stringify(r.payload).includes("code_name"), `use language in code_name → 400 naming the field (got ${r.statusCode})`);
  ok(writes("products") === before, "nothing written on rejection");
  r = await call(catalogHandler, "PATCH", { kind: "product", id: "bpc-157", code_name: "x".repeat(81) }, "/api/admin/catalog");
  ok(r.statusCode === 400 && /too long/.test(JSON.stringify(r.payload)), "81 characters → 400 (max 80)");
  r = await call(catalogHandler, "PATCH", { kind: "product", id: "bpc-157", code_name: "<b>Compound</b>" }, "/api/admin/catalog");
  ok(r.statusCode === 400 && /markup/.test(JSON.stringify(r.payload)), "markup → 400");
  r = await call(catalogHandler, "PATCH", { kind: "product", id: "bpc-157", code_name: "  Compound   A-7 " }, "/api/admin/catalog");
  const upd = LOG.filter((l) => l.table === "products" && l.op === "update").pop();
  ok(r.statusCode === 200 && upd && upd.payload?.code_name === "Compound A-7", `clean code name → 200, written trimmed and single-spaced (got ${r.statusCode}, ${JSON.stringify(upd?.payload?.code_name)})`);
  r = await call(catalogHandler, "PATCH", { kind: "product", id: "bpc-157", code_name: "" }, "/api/admin/catalog");
  const upd2 = LOG.filter((l) => l.table === "products" && l.op === "update").pop();
  ok(r.statusCode === 200 && upd2 && upd2.payload && "code_name" in upd2.payload && upd2.payload.code_name === null, `"" clears the code name (written as null)`);
}

process.exit(failures ? 1 : 0);
