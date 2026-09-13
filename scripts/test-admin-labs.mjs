/*
  scripts/test-admin-labs.mjs   (opt cycle 1 — scorecards 4.11 / 4.4, H-003)
  Lab linkage from the Control Room. Executes the REAL api/admin/labs.js and
  api/admin/coa.js handlers against an in-memory Supabase stub (auth stubbed
  to an admin) and proves:
    - a lab's public lookup template is accepted only when https + `{code}`;
    - a certificate can be linked (lab_id + lab_lookup_code + purity
      qualifier), values are validated/normalised, and can be CLEARED;
    - unknown keys never reach the database (whitelist);
    - a pre-0032 database degrades (GET falls back; labs report
      migrationPending) instead of breaking the tab;
    - the Control Room wires the row editor, the create-form fields and the
      labs form, and hides all three until the migration is applied.

  Run: node scripts/test-admin-labs.mjs   (wired into npm run test:unit)
*/
import { build } from "esbuild";
import path from "node:path";
import fs from "node:fs";

let failures = 0;
const ok = (cond, msg) => {
  if (cond) console.log(`  ✓ ${msg}`);
  else {
    failures++;
    console.error(`  ✗ ${msg}`);
  }
};

const outfile = path.join(process.cwd(), `.admin-labs-test-${Date.now()}.mjs`);
const stubDb = path.join(process.cwd(), "scripts/_admin-stub-supabase.mjs");
const stubAuth = path.join(process.cwd(), "scripts/_admin-stub-auth.mjs");
await build({
  entryPoints: [path.join(process.cwd(), "scripts/_admin-entry.mjs")],
  bundle: true, format: "esm", platform: "node", outfile, logLevel: "silent",
  plugins: [{
    name: "stubs",
    setup(b) {
      b.onResolve({ filter: /supabaseServer\.js$/ }, () => ({ path: stubDb }));
      b.onResolve({ filter: /_utils\/auth\.js$/ }, () => ({ path: stubAuth }));
    },
  }],
});
const { coaHandler, labsHandler, labTemplateError, pickLabFields, FIXTURES, FAULTS, LOG } = await import(`file://${outfile}`);

function makeRes() {
  const r = { statusCode: null, payload: null, headers: {}, headersSent: false };
  r.setHeader = (k, v) => { r.headers[k] = v; };
  r.status = (c) => { r.statusCode = c; return r; };
  r.json = (p) => { r.payload = p; r.headersSent = true; return r; };
  r.end = (p) => { if (p != null) { try { r.payload = JSON.parse(p); } catch { r.payload = p; } } r.headersSent = true; return r; };
  return r;
}
const call = async (handler, method, body) => {
  const res = makeRes();
  await handler({ method, headers: {}, body }, res);
  return res;
};
const quiet = async (fn) => { const e = console.error, w = console.warn; console.error = () => {}; console.warn = () => {}; try { return await fn(); } finally { console.error = e; console.warn = w; } };

console.log("labTemplateError:");
ok(labTemplateError("") === null, "empty template is allowed (lab without a public lookup)");
ok(labTemplateError("https://lab.example/r?id={code}") === null, "https + {code} → valid");
ok(/\{code\}/.test(labTemplateError("https://lab.example/r?id=123") || ""), "missing {code} → rejected");
ok(/https/.test(labTemplateError("http://lab.example/r?id={code}") || ""), "http → rejected (downgradeable trust link)");
ok(labTemplateError("javascript:alert({code})") !== null, "javascript: → rejected");
ok(labTemplateError("not a url {code}") !== null, "unparseable → rejected");

console.log("\npickLabFields:");
ok(pickLabFields({}, { forCreate: true }).__error === "name is required", "create requires a name");
ok(pickLabFields({ name: "L", role: "admin", id: 9 }, { forCreate: true }).fields.role === undefined, "unknown keys are dropped (whitelist)");
ok(pickLabFields({ name: "  Janoshik Analytical  " }, { forCreate: true }).fields.name === "Janoshik Analytical", "values are trimmed");
ok(pickLabFields({ verified_at: "2026-13-99" }).__error !== undefined, "bad verified_at rejected");
ok(pickLabFields({ name: "" }).__error === "name cannot be cleared", "update cannot clear the name");

console.log("\nPOST /api/admin/labs:");
{
  const bad = await call(labsHandler, "POST", { name: "Lab A", public_lookup_url_template: "http://a.test/{code}" });
  ok(bad.statusCode === 400 && /https/.test(bad.payload.error), "http template → 400 with the reason");
  const bad2 = await call(labsHandler, "POST", { name: "Lab A", public_lookup_url_template: "https://a.test/report" });
  ok(bad2.statusCode === 400 && /\{code\}/.test(bad2.payload.error), "template without {code} → 400");
  const good = await call(labsHandler, "POST", { name: "Lab A", accreditation_body: "ISO/IEC 17025", accreditation_number: "L-123", public_lookup_url_template: "https://a.test/r?id={code}", is_admin: true });
  ok(good.statusCode === 200 && good.payload.lab?.name === "Lab A", "valid lab created");
  ok(good.payload.lab.is_admin === undefined, "stray keys did not reach the row");
  ok(LOG.some((l) => l.table === "audit_logs" && l.row.action === "lab.create"), "lab creation is audit-logged");
  const list = await call(labsHandler, "GET");
  ok(list.statusCode === 200 && list.payload.labs.length === 1 && list.payload.migrationPending === false, "GET lists the lab, migrationPending=false");
}

console.log("\nPATCH /api/admin/coa — lab linkage:");
FIXTURES.coas.push({ id: 1, product_id: "bpc-157", lot_number: "L1", lab_name: "Lab A", purity_percent: 99.1, lab_id: null, lab_lookup_code: null, purity_operator: null });
{
  const labId = FIXTURES.labs[0].id;
  const r = await call(coaHandler, "PATCH", { id: 1, lab_id: labId, lab_lookup_code: "  T-99-0001 ", purity_operator: "≥", role: "admin" });
  ok(r.statusCode === 200, "link accepted");
  ok(r.payload.coa.lab_id === labId, "lab_id stored as a number");
  ok(r.payload.coa.lab_lookup_code === "T-99-0001", "lookup code trimmed");
  ok(r.payload.coa.purity_operator === ">=", "unicode ≥ normalised to >=");
  ok(r.payload.coa.role === undefined && FIXTURES.coas[0].role === undefined, "unknown key never reached the row");
  const bad = await call(coaHandler, "PATCH", { id: 1, purity_operator: "~" });
  ok(bad.statusCode === 400 && /purity_operator/.test(bad.payload.error), "bad operator → 400");
  const bad2 = await call(coaHandler, "PATCH", { id: 1, lab_id: "abc" });
  ok(bad2.statusCode === 400 && /lab_id/.test(bad2.payload.error), "non-integer lab_id → 400");
  const bad3 = await call(coaHandler, "PATCH", { id: 1, lab_lookup_code: "<script>" });
  ok(bad3.statusCode === 400, "lookup code with angle brackets → 400");
  const bad4 = await call(coaHandler, "PATCH", { id: 1, lab_lookup_code: "x".repeat(65) });
  ok(bad4.statusCode === 400, "lookup code over 64 chars → 400");
  const clear = await call(coaHandler, "PATCH", { id: 1, lab_id: null, lab_lookup_code: "", purity_operator: null });
  ok(clear.statusCode === 200 && clear.payload.coa.lab_id === null && clear.payload.coa.lab_lookup_code === null && clear.payload.coa.purity_operator === null, "explicit null / empty CLEARS all three");
  const untouched = await call(coaHandler, "PATCH", { id: 1, is_published: false });
  ok(untouched.payload.coa.lab_id === null && "lab_id" in FIXTURES.coas[0], "a PATCH that omits the lab fields leaves them untouched");
}

console.log("\nPre-migration degradation:");
{
  FAULTS.missingColumnsOnce = true;
  const r = await quiet(() => call(coaHandler, "GET"));
  ok(r.statusCode === 200 && Array.isArray(r.payload.coas), "COA GET still answers when 0032 columns are missing");
  ok(r.payload.labFieldsSupported === false, "…and reports labFieldsSupported=false so the UI hides the controls");
  const r2 = await call(coaHandler, "GET");
  ok(r2.payload.labFieldsSupported === true, "with the columns present, labFieldsSupported=true");
  FAULTS.missingTable = true;
  const l = await call(labsHandler, "GET");
  ok(l.statusCode === 200 && l.payload.migrationPending === true && l.payload.labs.length === 0, "labs GET on a pre-0032 database → migrationPending, not a 500");
  FAULTS.missingTable = false;
}

console.log("\nControl Room wiring (static):");
{
  const ui = fs.readFileSync(new URL("../src/pages/AdminHome.jsx", import.meta.url), "utf8");
  ok(/function LabLinkRow/.test(ui) && /data-testid="lab-link-row"/.test(ui), "per-certificate lab link editor exists");
  ok(/function LabsForm/.test(ui) && /"\/api\/admin\/labs", "POST"/.test(ui), "labs form posts to /api/admin/labs");
  ok(/data-testid="coa-create-lab-fields"/.test(ui), "create form carries lab / lookup code / purity qualifier");
  ok((ui.match(/labsSupported && \(/g) || []).length >= 3, "all three lab surfaces are gated on labsSupported");
  ok(/lab_id: labId === "" \? null : Number\(labId\)/.test(ui), "row editor sends null to clear, a number to link");
  ok(!/className="hidden"/.test(ui), "no leftover hidden wrapper in the create form");
}

fs.rmSync(outfile, { force: true });
if (failures) {
  console.error(`\n${failures} admin-labs check(s) FAILED`);
  process.exit(1);
}
console.log("\nAll admin-labs checks passed.");
