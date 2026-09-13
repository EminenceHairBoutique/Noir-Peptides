/*
  scripts/test-admin-label-copy.mjs   (opt cycle 5 — scorecard 4.1)
  Text an admin types into a label config prints on the label once approved.
  Executes the REAL api/admin/labels.js create and patch paths against the
  in-memory stub and proves that use language is refused at the door with a
  400 naming the field and the reason — the same rules the build gate
  renders real labels against (lib/labelCopyRules.js) — and that clean copy
  and the RUO negations still pass.

  Run: node scripts/test-admin-label-copy.mjs   (wired into npm run test:unit)
*/
import { build } from "esbuild";
import path from "node:path";
import fs from "node:fs";
import { checkLabelText, checkLabelFields } from "../lib/labelCopyRules.js";

let failures = 0;
const ok = (cond, msg) => {
  if (cond) console.log(`  ✓ ${msg}`);
  else { failures++; console.error(`  ✗ ${msg}`); }
};
process.env.VITE_SUPABASE_URL ||= "https://placeholder.supabase.co";
process.env.VITE_SUPABASE_ANON_KEY ||= "placeholder";
process.env.SUPABASE_SERVICE_ROLE_KEY ||= "placeholder";

console.log("Rules (pure):");
ok(checkLabelText("Store 2–8 °C. Protect from light.").length === 0, "storage line is clean");
ok(checkLabelText("FOR RESEARCH USE ONLY — NOT FOR HUMAN OR VETERINARY USE").length === 0, "RUO warning is clean (negation)");
ok(checkLabelText("NOT FOR DIAGNOSTIC, THERAPEUTIC, OR HOUSEHOLD USE.").length === 0, "'therapeutic' inside a negation is accepted");
let p = checkLabelText("Reconstitute with 2 mL bacteriostatic water");
ok(p.some((x) => x.reason === "a liquid volume") && p.some((x) => x.reason === "a solvent") && p.some((x) => x.reason === "a reconstitution instruction"), `volume + solvent + instruction all named (${p.map((x) => x.reason).join("; ")})`);
p = checkLabelText("Inject subcutaneously once daily");
ok(p.some((x) => x.reason === "a route of administration") && p.some((x) => x.reason === "a schedule"), "route + schedule named");
p = checkLabelText("Typical dose 250 mcg");
ok(p.some((x) => x.reason === "a dose"), "dose named");
p = checkLabelText("Supports recovery and healing");
ok(p.some((x) => x.reason === "compliance"), `outcome claim caught by the scanner outside a negation (${JSON.stringify(p)})`);
ok(checkLabelFields({ display_name: "BPC-157", sku: "BPC157-5", storage_full: "Store cool and dry." }).length === 0, "clean field set passes");
p = checkLabelFields({ display_name: "BPC-157", fill_note: "Dilute in 1 mL saline", lot_number: "inject-2607" });
ok(p.length >= 1 && p.every((x) => x.field === "fill_note"), `only TEXT fields are judged (lot_number ignored): ${JSON.stringify(p.map((x) => x.field))}`);

const outfile = path.join(process.cwd(), `.admin-label-copy-test-${Date.now()}.mjs`);
await build({
  entryPoints: [path.join(process.cwd(), "scripts/_admin-entry.mjs")],
  bundle: true, format: "esm", platform: "node", outfile, logLevel: "silent",
  plugins: [{ name: "stubs", setup(b) {
    b.onResolve({ filter: /supabaseServer\.js$/ }, () => ({ path: path.join(process.cwd(), "scripts/_admin-stub-supabase.mjs") }));
    b.onResolve({ filter: /_utils\/auth\.js$/ }, () => ({ path: path.join(process.cwd(), "scripts/_admin-stub-auth.mjs") }));
  } }],
});
const { labelConfigsHandler, FIXTURES } = await import(`file://${outfile}`);
fs.unlinkSync(outfile);
function makeRes() { const r = { statusCode: null, payload: null, headers: {} }; r.setHeader = (k, v) => { r.headers[k] = v; }; r.end = (p) => { try { r.payload = JSON.parse(p); } catch { r.payload = p; } return r; }; return r; }
const call = async (method, body) => { const res = makeRes(); await labelConfigsHandler({ method, url: "/api/admin/labels", headers: {}, body }, res); return res; };
FIXTURES.products = [{ id: "bpc-157", slug: "bpc-157", name: "BPC-157" }];
FIXTURES.product_variants = []; FIXTURES.label_configs = []; FIXTURES.audit_logs = [];
const clean = { product_id: "bpc-157", display_name: "BPC-157", quantity_label: "5 mg", sku: "BPC157-5", material_type: "Lyophilized Research Material", storage_short: "Store 2–8 °C. Protect from light." };

console.log("\nCreate:");
let r = await call("POST", clean);
ok(r.statusCode === 200 && r.payload?.config?.id, `clean label config is created (${r.statusCode})`);
const id = r.payload?.config?.id;
r = await call("POST", { ...clean, sku: "BPC157-5B", fill_note: "Reconstitute with 2 mL bacteriostatic water before use" });
ok(r.statusCode === 400, `use language in fill_note → 400 (${r.statusCode})`);
ok(Array.isArray(r.payload?.details) && r.payload.details.some((d) => d.field === "fill_note" && d.reason === "a solvent"), `400 names the field and the reason: ${JSON.stringify(r.payload?.details?.slice(0, 2))}`);
ok(FIXTURES.label_configs.length === 1, "nothing was written for the rejected create");
r = await call("POST", { ...clean, sku: "BPC157-5C", display_name: "BPC-157 — promotes healing" });
ok(r.statusCode === 400 && r.payload?.details?.some((d) => d.field === "display_name" && d.reason === "compliance"), `outcome claim in display_name → 400 (${r.statusCode})`);

console.log("\nPatch:");
r = await call("PATCH", { id, storage_full: "Inject subcutaneously daily" });
ok(r.statusCode === 400 && r.payload?.details?.some((d) => d.field === "storage_full"), `use language in a patch → 400 (${r.statusCode})`);
ok(FIXTURES.label_configs[0].storage_full === undefined, "the rejected patch wrote nothing");
r = await call("PATCH", { id, storage_full: "Store in a cool, dry environment protected from direct light." });
ok(r.statusCode === 200, `clean patch → 200 (${r.statusCode})`);
r = await call("PATCH", { id, revision_notes: "NOT FOR HUMAN OR VETERINARY USE — wording aligned with the RUO warning" });
ok(r.statusCode === 200, `negated RUO wording in notes → 200 (${r.statusCode})`);

console.log("\nShared rules:");
const gate = fs.readFileSync(path.join(process.cwd(), "scripts/test-label-copy.mjs"), "utf8");
ok(/from "\.\.\/lib\/labelCopyRules\.js"/.test(gate) && /const FORBIDDEN = LABEL_USE_PATTERNS;/.test(gate), "the build gate imports the same rule set the handler enforces");

console.log(failures ? `\n${failures} assertion(s) failed` : "\nAll admin-label-copy assertions passed");
process.exit(failures ? 1 : 0);
