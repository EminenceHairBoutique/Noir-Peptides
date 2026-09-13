/*
  scripts/test-partner-apply.mjs   (opt cycle 11 — scorecard 4.14b)
  Executes the REAL POST /api/partners/apply handler with Supabase, auth and
  the rate limiter stubbed: the honeypot short-circuits without a write, a
  bad email is a 400, a valid application is upserted with the documented
  column mapping and answers 200 even when no email transport is configured
  (the notification is best-effort — an unset RESEND_API_KEY used to turn a
  SAVED application into a 500). Plus: the subject map names the type, the
  page posts to this endpoint with the same field names, and the route is
  prerendered + linked from the footer.

  Run: node scripts/test-partner-apply.mjs   (in npm run test:unit)
*/
import { build } from "esbuild";
import path from "node:path";
import fs from "node:fs";

let failures = 0;
const ok = (c, m) => { if (c) console.log(`  ✓ ${m}`); else { failures++; console.error(`  ✗ ${m}`); } };
const read = (rel) => fs.readFileSync(path.join(process.cwd(), rel), "utf8");

process.env.VITE_SUPABASE_URL ||= "https://placeholder.supabase.co";
process.env.SUPABASE_SERVICE_ROLE_KEY ||= "placeholder";
delete process.env.RESEND_API_KEY;

const outfile = path.join(process.cwd(), `.partner-apply-${Date.now()}.mjs`);
fs.writeFileSync(path.join(process.cwd(), "scripts/_partner-apply-entry.tmp.mjs"),
  'export { default as handler } from "../api/partners/apply.js";\nexport { FIXTURES, LOG } from "../lib/supabaseServer.js";\n');
try {
  await build({
    entryPoints: [path.join(process.cwd(), "scripts/_partner-apply-entry.tmp.mjs")],
    bundle: true, format: "esm", platform: "node", outfile, logLevel: "silent",
    plugins: [{ name: "stubs", setup(b) {
      b.onResolve({ filter: /supabaseServer\.js$/ }, () => ({ path: path.join(process.cwd(), "scripts/_pricing-stub-supabase.mjs") }));
      b.onResolve({ filter: /_utils\/auth\.js$/ }, () => ({ path: path.join(process.cwd(), "scripts/_admin-stub-auth.mjs") }));
      b.onResolve({ filter: /_utils\/rateLimit\.js$/ }, () => ({ path: path.join(process.cwd(), "scripts/_stub-rate-limit.mjs") }));
    } }],
  });
} finally {
  fs.rmSync(path.join(process.cwd(), "scripts/_partner-apply-entry.tmp.mjs"), { force: true });
}
const { handler, FIXTURES, LOG } = await import(`file://${outfile}`);
fs.rmSync(outfile, { force: true });

function makeRes() {
  const r = { statusCode: null, payload: null, headers: {} };
  r.setHeader = (k, v) => { r.headers[k] = v; };
  r.status = (c) => { r.statusCode = c; return r; };
  r.json = (p) => { r.payload = p; return r; };
  r.send = (p) => { r.payload = p; return r; };
  r.end = (p) => { if (p != null) { try { r.payload = JSON.parse(p); } catch { r.payload = p; } } return r; };
  return r;
}
async function post(payload) {
  const res = makeRes();
  const warn = console.warn; const err = console.error; console.warn = () => {}; console.error = () => {};
  try { await handler({ method: "POST", headers: { "content-type": "application/json" }, body: { payload } }, res); }
  finally { console.warn = warn; console.error = err; }
  return res;
}
const reset = () => { FIXTURES.partner_applications = []; FIXTURES.profiles = []; LOG.length = 0; };
const APP = {
  fullName: "Ada Example", email: "Ada@Lab.Example", businessName: "Example Institute", country: "United States",
  monthlyVolume: "25–100 vials / month", interestedIn: "BPC-157, GHK-Cu", websiteOrInstagram: "https://lab.example",
  message: "Per-batch COA and SDS with every shipment.", website: "",
};

console.log("POST /api/partners/apply (real handler, stubs for DB / auth / rate limit; no email transport):");
{
  reset();
  let r = await post({ ...APP, website: "http://bot.example" });
  ok(r.statusCode === 200 && r.payload?.ok === true && LOG.length === 0, "honeypot filled → 200 ok, nothing written");

  reset();
  r = await post({ ...APP, email: "not-an-email" });
  ok(r.statusCode === 400 && /invalid/i.test(r.payload?.error || ""), "bad email → 400 Invalid request");
  ok(LOG.length === 0, "…and nothing written");

  reset();
  r = await post({ ...APP, fullName: "A" });
  ok(r.statusCode === 400, "a one-character name → 400");

  reset();
  r = await post(APP);
  ok(r.statusCode === 200 && r.payload?.ok === true, "valid application → 200 ok even with RESEND_API_KEY unset (email is best-effort)");
  const up = LOG.find((l) => l.op === "upsert" && l.table === "partner_applications");
  ok(Boolean(up), "one row upserted into partner_applications");
  const row = up?.row || {};
  ok(row.email === "ada@lab.example", "email is lower-cased");
  ok(row.full_name === APP.fullName && row.business_name === APP.businessName && row.country === APP.country, "full_name / business_name / country mapped");
  ok(row.monthly_volume === APP.monthlyVolume && row.interested_in === APP.interestedIn && row.website_or_instagram === APP.websiteOrInstagram && row.message === APP.message, "monthly_volume / interested_in / website_or_instagram / message mapped");
  ok(row.status === "pending" && row.user_id === null, "status pending; anonymous applicant has no user_id");
  ok(!LOG.some((l) => l.table === "profiles"), "no profile update for an anonymous applicant");
  const res = makeRes();
  await handler({ method: "GET", headers: {} }, res);
  ok(res.statusCode === 405, "GET → 405");
}

console.log("\nWiring:");
{
  const email = read("lib/email.js");
  ok(/partner_application:\s*"Wholesale \/ Institutional Supply Application"/.test(email), "lib/email.js subject map names partner_application");
  const page = read("src/pages/Partners.jsx");
  ok(/fetch\("\/api\/partners\/apply"/.test(page) && /JSON\.stringify\(\{ payload: form \}\)/.test(page), "the page posts { payload } to /api/partners/apply");
  for (const f of ["fullName", "email", "businessName", "country", "monthlyVolume", "interestedIn", "websiteOrInstagram", "message", "website"]) {
    ok(new RegExp(`\\b${f}:`).test(page), `page state carries ${f}`);
  }
  const api = read("api/partners/apply.js");
  for (const f of ["fullName", "businessName", "country", "monthlyVolume", "interestedIn", "websiteOrInstagram", "message"]) {
    ok(new RegExp(`payload\\.${f}\\b`).test(api), `endpoint reads payload.${f}`);
  }
  ok(/aria-hidden="true"/.test(page) && /tabIndex=\{-1\}/.test(page), "honeypot is hidden from assistive tech and the tab order");
  ok(/<Route path="\/partners"/.test(read("src/App.jsx")), "App.jsx routes /partners (public)");
  ok(/to="\/partners"/.test(read("src/components/Footer.jsx")), "the footer links /partners");
  const gen = read("scripts/generate-static-seo.mjs");
  ok(/pathname: "\/partners"/.test(gen) && /href: "\/partners"/.test(gen) && /\[\/\^\\\/partners\$\/, "Partners"\]/.test(gen), "the prerenderer emits /partners, links it from the static footer, and preloads its chunk");
  const copy = read("src/data/pageCopy.js");
  ok(/export const PARTNERS_COPY/.test(copy), "copy lives in pageCopy.js (corpus-scanned)");
}

if (failures) { console.error(`\n${failures} partner-apply check(s) FAILED`); process.exit(1); }
console.log("\nAll partner-apply checks passed.");
