/*
  scripts/test-admin-screens.mjs   (opt cycle 10 — addendum C8; scorecard 4.11)
  The two read-only Control Room screens, executed for real:
    - Feature flags: GET only, reports names + on/off, never a value; the
      inventory is exactly lib/featureFlags.js's three flags, all off by default.
    - Owner Sprint: D1–D12 rows; statuses derived from data (green / partial)
      or grey; env checks report presence only; a pre-migration database is a
      finding, not a 500.
  Run: node scripts/test-admin-screens.mjs   (wired into npm run test:unit)
*/
import { build } from "esbuild";
import path from "node:path";
import fs from "node:fs";
let failures = 0;
const ok = (cond, msg) => { if (cond) console.log(`  ✓ ${msg}`); else { failures++; console.error(`  ✗ ${msg}`); } };
process.env.VITE_SUPABASE_URL ||= "https://placeholder.supabase.co";
process.env.VITE_SUPABASE_ANON_KEY ||= "placeholder";
process.env.SUPABASE_SERVICE_ROLE_KEY ||= "placeholder";
const outfile = path.join(process.cwd(), `.admin-screens-test-${Date.now()}.mjs`);
await build({
  entryPoints: [path.join(process.cwd(), "scripts/_admin-entry.mjs")],
  bundle: true, format: "esm", platform: "node", outfile, logLevel: "silent",
  plugins: [{ name: "stubs", setup(b) {
    b.onResolve({ filter: /supabaseServer\.js$/ }, () => ({ path: path.join(process.cwd(), "scripts/_admin-stub-supabase.mjs") }));
    b.onResolve({ filter: /_utils\/auth\.js$/ }, () => ({ path: path.join(process.cwd(), "scripts/_admin-stub-auth.mjs") }));
    b.onResolve({ filter: /_utils\/rateLimit\.js$/ }, () => ({ path: path.join(process.cwd(), "scripts/_stub-rate-limit.mjs") }));
  } }],
});
const { flagsHandler, flagStates, FLAG_INVENTORY, ownerSprintHandler, deriveOwnerSprint, FIXTURES, FAULTS } = await import(`file://${outfile}`);
fs.unlinkSync(outfile);
function makeRes() { const r = { statusCode: null, payload: null, headers: {} }; r.setHeader = (k, v) => { r.headers[k] = v; }; r.end = (p) => { try { r.payload = JSON.parse(p); } catch { r.payload = p; } return r; }; return r; }
const call = async (h, method) => { const r = makeRes(); await h({ method, headers: {}, body: {} }, r); return r; };

console.log("Feature flags screen:");
{
  const src = fs.readFileSync("api/admin/flags.js", "utf8");
  ok(!/PATCH|POST|PUT|DELETE/.test(src.replace(/\/\/[^\n]*/g, "")), "the endpoint has no write path (GET only)");
  ok(FLAG_INVENTORY.map((f) => f.env).sort().join() === ["FEATURE_AI_PUBLIC", "VITE_FEATURE_AI_PUBLIC", "VITE_FEATURE_CALCULATOR"].join(), "inventory is exactly the three flags lib/featureFlags.js knows");
  const off = flagStates({});
  ok(off.every((f) => f.on === false && f.set === false), "with nothing set every flag reports off / not set");
  const on = flagStates({ VITE_FEATURE_CALCULATOR: "1", FEATURE_AI_PUBLIC: "off", VITE_FEATURE_AI_PUBLIC: "sk_live_secretvalue" });
  ok(on.find((f) => f.env === "VITE_FEATURE_CALCULATOR").on === true && on.find((f) => f.env === "FEATURE_AI_PUBLIC").on === false, "parseFlag semantics: 1 → on, off → off");
  ok(!JSON.stringify(on).includes("secretvalue"), "a raw env value never appears in the response shape");
  let r = await call(flagsHandler, "GET");
  ok(r.statusCode === 200 && Array.isArray(r.payload.flags) && r.payload.readOnly === true && /vercel\.com\/docs/.test(r.payload.docs), "GET → flags, readOnly, docs link");
  r = await call(flagsHandler, "PATCH");
  ok(r.statusCode === 405, "PATCH → 405");
}

console.log("\nOwner Sprint panel:");
{
  // Pre-migration database: no labs/server_errors tables, no newer columns.
  FIXTURES.coas.length = 0; FIXTURES.labs.length = 0;
  FIXTURES.products = [{ id: "bpc-157", name: "BPC-157" }];
  FIXTURES.product_categories = [{ slug: "tissue-repair-research", name: "Tissue Repair" }];
  FIXTURES.coas.push({ id: 1, product_id: "bpc-157", is_published: true, lab_name: "Janoshik", file_url: null });
  FAULTS.missingTables = ["labs", "server_errors"];
  FAULTS.missingColumns = ["coas.cas_number", "products.sds_file_url", "product_categories.soft_launch_hidden", "products.code_name", "coas.file_path"];
  let d = await deriveOwnerSprint({});
  const byId = (rows) => Object.fromEntries(rows.map((r) => [r.id, r]));
  let m = byId(d.rows);
  ok(d.rows.length === 13 && d.rows.map((r) => r.id).join() === "D1,D2,D3,D4,D5,D5b,D6,D7,D8,D9,D10,D11,D12", "thirteen rows D1–D12 (+ D5b specs) in order");
  ok(m.D2.status === "grey" && /missing: 0031/.test(m.D2.detail) && /no CLI ledger/.test(m.D2.detail), `pre-migration database → D2 grey with the missing list (${m.D2.detail.slice(0, 60)}…)`);
  ok(m.D5.status === "grey" && /1 published/.test(m.D5.detail), "one published certificate with nothing linked → D5 grey, counts shown");
  ok(m.D4.status === "grey" && m.D8.status === "grey" && m.D9.status === "grey", "no env → D4 / D8 / D9 grey");
  ok(["D1", "D3", "D7", "D10", "D11", "D12"].every((k) => m[k].status === "grey" && m[k].how), "owner-only steps are grey and carry a command or screen");
  ok(d.rows.every((r) => r.how && r.detail && /^(green|partial|grey)$/.test(r.status)), "every row has status, detail and how");

  // Post-migration database with real data.
  FAULTS.missingTables = []; FAULTS.missingColumns = [];
  FIXTURES.labs.push({ id: 1, name: "Janoshik", public_lookup_url_template: "https://janoshik.com/verify/{code}" });
  FIXTURES.server_errors = [{ id: 1 }];
  FIXTURES.products = [{ id: "bpc-157", name: "BPC-157", sds_file_url: null, code_name: "Compound A-7" }];
  FIXTURES.product_categories = [{ slug: "tissue-repair-research", soft_launch_hidden: false }];
  FIXTURES.coas.length = 0;
  FIXTURES.coas.push({ id: 1, product_id: "bpc-157", is_published: true, cas_number: "137525-51-0", lab_lookup_code: "JAN-1", file_url: "/api/coa-file/1.pdf", file_path: "coas/1/x.pdf" });
  FIXTURES.coas.push({ id: 2, product_id: "bpc-157", is_published: true, cas_number: "137525-51-0", lab_lookup_code: "JAN-2", file_url: "/api/coa-file/2.pdf", file_path: "coas/2/x.pdf" });
  FIXTURES.coas.push({ id: 3, product_id: "bpc-157", is_published: false, cas_number: null, lab_lookup_code: null, file_url: null, file_path: null });
  const ENV2 = { VITE_SITE_URL: "https://www.noirpeptides.com", BTCPAY_URL: "https://btc.example", BTCPAY_API_KEY: "k", BTCPAY_STORE_ID: "s", BTCPAY_WEBHOOK_SECRET: "w", VITE_GA_MEASUREMENT_ID: "G-1" };
  d = await deriveOwnerSprint(ENV2);
  m = byId(d.rows);
  ok(m.D2.status === "green" && /7\/7 proven/.test(m.D2.detail), `all columns present → D2 green (${m.D2.detail.slice(0, 40)}…)`);
  ok(m.D5.status === "green" && /2 published certificate\(s\): 2 lab-linked, 2 with CAS, 2 with a file; 1 lab\(s\), 1 with a lookup template/.test(m.D5.detail), `every published certificate lab-linked + CAS + file, lab has a template → D5 green (${m.D5.detail})`);
  ok(m.D6.status === "partial" && /1 product\(s\) with a code name/.test(m.D6.detail), "a code name set → D6 partial (the sign-off is the owner's)");
  ok(m.D5b.status === "grey" && /1 products: 0 with a sequence/.test(m.D5b.detail), `no specs on record → D5b grey with counts (${m.D5b.detail.slice(0, 40)}…)`);
  FIXTURES.products[0].peptide_sequence = "GEPPPGKPADDAGLV"; FIXTURES.products[0].molecular_weight = "1419.53 g/mol"; FIXTURES.products[0].cas_number = "137525-51-0";
  d = await deriveOwnerSprint(ENV2); m = byId(d.rows);
  ok(m.D5b.status === "green", "every product with all three specs → D5b green");
  ok(m.D4.status === "partial" && m.D8.status === "partial" && m.D9.status === "partial", "env present → D4 / D8 / D9 partial (presence only)");
  ok(!JSON.stringify(d).includes("btc.example") && !JSON.stringify(d).includes("G-1"), "no env value leaks into the panel");
  const r = await call(ownerSprintHandler, "GET");
  ok(r.statusCode === 200 && r.payload.rows.length === 13, "GET → 200 with the thirteen rows");
  const r2 = await call(ownerSprintHandler, "POST");
  ok(r2.statusCode === 405, "POST → 405");
}

if (failures) { console.error(`\n${failures} admin-screen check(s) FAILED`); process.exit(1); }
console.log("\nAll admin-screen checks passed.");
