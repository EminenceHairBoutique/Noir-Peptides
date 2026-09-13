/*
  scripts/test-reviews-screen.mjs   (opt c6 — scorecard 4.1)
  Reviews are the only public copy a buyer writes. Executes the REAL
  api/reviews.js handler against the in-memory stub (auth stubbed to a
  signed-in user) and proves that text carrying use language, outcome
  claims or a scanner finding outside a negation is refused with the
  guidance message and nothing is written; that clean quality / packaging /
  COA / shipping reviews are accepted; and that a review is only ever
  written as the handler's own status (the client cannot choose it).

  Run: node scripts/test-reviews-screen.mjs   (wired into npm run test:unit)
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

const outfile = path.join(process.cwd(), `.reviews-screen-test-${Date.now()}.mjs`);
await build({
  entryPoints: [path.join(process.cwd(), "scripts/_admin-entry.mjs")],
  bundle: true, format: "esm", platform: "node", outfile, logLevel: "silent",
  plugins: [{ name: "stubs", setup(b) {
    b.onResolve({ filter: /supabaseServer\.js$/ }, () => ({ path: path.join(process.cwd(), "scripts/_admin-stub-supabase.mjs") }));
    b.onResolve({ filter: /_utils\/auth\.js$/ }, () => ({ path: path.join(process.cwd(), "scripts/_admin-stub-auth.mjs") }));
    b.onResolve({ filter: /_utils\/rateLimit\.js$/ }, () => ({ path: path.join(process.cwd(), "scripts/_stub-rate-limit.mjs") }));
  } }],
});
const { reviewsHandler, FIXTURES, LOG } = await import(`file://${outfile}`);
fs.unlinkSync(outfile);
function makeRes() { const r = { statusCode: null, payload: null, headers: {} }; r.setHeader = (k, v) => { r.headers[k] = v; }; r.end = (p) => { try { r.payload = JSON.parse(p); } catch { r.payload = p; } return r; }; return r; }
const post = async (body) => { const res = makeRes(); await reviewsHandler({ method: "POST", url: "/api/reviews", headers: {}, body }, res); return res; };
FIXTURES.products = [{ id: "bpc-157" }]; FIXTURES.orders = []; FIXTURES.product_reviews = [];
const base = { productId: "bpc-157", rating: 5, aspect: "coa" };
const writes = () => LOG.filter((l) => l.table === "product_reviews").length;

console.log("Accepted:");
let r = await post({ ...base, title: "COA matched the lot", body: "Certificate matched the lot number on the vial; HPLC purity was stated. Packaging was intact and shipping was quick." });
ok(r.statusCode === 200, `a quality / COA / shipping review is accepted (${r.statusCode}) ${r.statusCode !== 200 ? JSON.stringify(r.payload) : ""}`);
ok(writes() === 1, "one write for the accepted review");
ok(FIXTURES.product_reviews[0]?.status === "published" || LOG.at(-1)?.row?.status === "published" || LOG.at(-1)?.payload?.status === "published", "status is set by the handler");
r = await post({ ...base, title: "Not for human use — as labelled", body: "Label carries the research-use warning clearly. Not for human or veterinary use, exactly as expected." });
ok(r.statusCode === 200, `negated RUO wording is accepted (${r.statusCode})`);

console.log("\nRefused (nothing written):");
const before = writes();
const cases = [
  ["outcome claim", "Helped my tendon recover fast, great product"],
  ["dose", "I used 250 mcg and it was fine"],
  ["reconstitution instruction", "Reconstitute with 2 mL bacteriostatic water for best results"],
  ["route", "Easy to inject, no issues"],
  ["schedule", "Ran it daily for a month"],
  ["disease claim", "Cured my joint pain in a week"],
  ["benefit claim (scanner)", "Noticeable therapeutic benefit within days"],
];
for (const [label, body] of cases) {
  r = await post({ ...base, body });
  ok(r.statusCode === 400 && /quality, packaging, COA, and shipping only/.test(r.payload?.error || ""), `${label} → 400 with guidance (${r.statusCode}): "${body}"`);
}
ok(writes() === before, "no refused review was written");

console.log("\nClient cannot choose status:");
r = await post({ ...base, body: "Packaging intact, COA present.", status: "hidden", verified_purchase: true });
ok(r.statusCode === 200, `extra fields are ignored, request accepted (${r.statusCode})`);
const last = LOG.filter((l) => l.table === "product_reviews").at(-1);
const row = last?.row || last?.payload || {};
ok(row.status === "published" && row.verified_purchase === false, `status and verified_purchase come from the server, not the body (${JSON.stringify({ status: row.status, verified: row.verified_purchase })})`);

console.log(failures ? `\n${failures} assertion(s) failed` : "\nAll review-screen assertions passed");
process.exit(failures ? 1 : 0);
