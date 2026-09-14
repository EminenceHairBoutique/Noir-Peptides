/*
  scripts/test-referral-code.mjs   (opt cycle 12 — scorecard 4.14)
  The referral program end to end: GET /api/account/referral-code issues the
  server-side code (idempotent), applyReferralOnOrder resolves exactly that
  code, the routed checkout posts referralCode as a hint, and the client no
  longer invents a code the server does not know.
  Run: node scripts/test-referral-code.mjs   (in npm run test:unit)
*/
import { build } from "esbuild";
import path from "node:path";
import fs from "node:fs";

let failures = 0;
const ok = (c, m) => { if (c) console.log(`  ✓ ${m}`); else { failures++; console.error(`  ✗ ${m}`); } };
const read = (rel) => fs.readFileSync(path.join(process.cwd(), rel), "utf8");
process.env.VITE_SUPABASE_URL ||= "https://placeholder.supabase.co";
process.env.SUPABASE_SERVICE_ROLE_KEY ||= "placeholder";

const outfile = path.join(process.cwd(), `.pricing-test-referral-${Date.now()}.mjs`);
const entry = path.join(process.cwd(), "scripts/_referral-entry.tmp.mjs");
fs.writeFileSync(entry, 'export { default as handler } from "../api/account/referral-code.js";\nexport { applyReferralOnOrder, ensureReferralCode, REFERRAL_BONUS_POINTS } from "../lib/rewards.js";\nexport { FIXTURES, LOG } from "../lib/supabaseServer.js";\n');
let mod;
try {
  await build({ entryPoints: [entry], bundle: true, format: "esm", platform: "node", outfile, logLevel: "silent",
    plugins: [{ name: "stubs", setup(b) {
      b.onResolve({ filter: /supabaseServer\.js$/ }, () => ({ path: path.join(process.cwd(), "scripts/_pricing-stub-supabase.mjs") }));
      b.onResolve({ filter: /_utils\/auth\.js$/ }, () => ({ path: path.join(process.cwd(), "scripts/_admin-stub-auth.mjs") }));
      b.onResolve({ filter: /_utils\/rateLimit\.js$/ }, () => ({ path: path.join(process.cwd(), "scripts/_stub-rate-limit.mjs") }));
    } }] });
  mod = await import(`file://${outfile}`);
} finally { fs.rmSync(entry, { force: true }); fs.rmSync(outfile, { force: true }); }
const { handler, applyReferralOnOrder, REFERRAL_BONUS_POINTS, FIXTURES, LOG } = mod;
const makeRes = () => { const r = { statusCode: null, payload: null, headers: {} }; r.setHeader = (k, v) => { r.headers[k] = v; }; r.end = (p) => { try { r.payload = JSON.parse(p); } catch { r.payload = p; } return r; }; return r; };
const call = async (method) => { const r = makeRes(); await handler({ method, headers: {} }, r); return r; };
const reset = () => { FIXTURES.referral_codes = []; FIXTURES.referral_rewards = []; FIXTURES.profiles = [{ id: "user-test", loyalty_points: 0 }, { id: "user-friend", loyalty_points: 10 }]; FIXTURES.loyalty_ledger = []; LOG.length = 0; };

console.log("GET /api/account/referral-code (real handler; requireUser stub → user-test):");
{
  reset();
  let r = await call("GET");
  ok(r.statusCode === 200 && /^NP-[A-Z0-9]{5}$/.test(r.payload?.code || ""), `issues a server code on demand (${r.payload?.code})`);
  const first = r.payload?.code;
  ok(FIXTURES.referral_codes.length === 1 && FIXTURES.referral_codes[0].code === first, "…persisted in referral_codes");
  ok(r.headers["Cache-Control"] === "private, no-store", "not cacheable");
  r = await call("GET");
  ok(r.payload?.code === first && FIXTURES.referral_codes.length === 1, "idempotent: the same code, no second row");
  r = await call("POST");
  ok(r.statusCode === 405, "POST → 405");

  const { FIXTURES: F } = mod; void F;
  const before = LOG.length; void before;
  await applyReferralOnOrder({ buyerId: "user-friend", referralCode: first.toLowerCase(), orderNumber: "NP-9" });
  const referrer = FIXTURES.profiles.find((p) => p.id === "user-test");
  const friend = FIXTURES.profiles.find((p) => p.id === "user-friend");
  ok(FIXTURES.referral_rewards.length === 1 && referrer.loyalty_points === REFERRAL_BONUS_POINTS && friend.loyalty_points === 10 + REFERRAL_BONUS_POINTS, `the issued code resolves on a paid order: both accounts get ${REFERRAL_BONUS_POINTS} points (case-insensitive)`);
  await applyReferralOnOrder({ buyerId: "user-friend", referralCode: first, orderNumber: "NP-10" });
  ok(FIXTURES.referral_rewards.length === 1, "…once per buyer (a redelivered webhook awards nothing twice)");
}

console.log("\nClient + checkout wiring:");
{
  const ctx = read("src/context/UserContext.jsx");
  ok(!/generateReferralCode/.test(ctx) && /accountGet\("\/api\/account\/referral-code"\)/.test(ctx), "UserContext no longer generates a code; it hydrates from the endpoint");
  const dash = read("src/components/account/AccountDashboard.jsx");
  ok(/being issued/.test(dash), "the account page says the code is being issued until it arrives");
  const two = read("src/pages/CheckoutTwoStep.jsx");
  const payStart = two.indexOf("body: JSON.stringify({", two.indexOf("fetch(rail.endpoint"));
  const body = two.slice(payStart, two.indexOf("\n        })", payStart));
  ok(/referralCode:/.test(body) && !/referralBonus|bonusPoints/.test(body), "onPay posts referralCode as a hint (never a bonus amount)");
  const step = read("src/components/checkout/StepPayment.jsx");
  ok(/id="referral"/.test(step) && /aria-describedby="referral-help"/.test(step), "StepPayment has the referral input with described help text");
  const stripe = read("api/create-checkout-session.js");
  const btc = read("api/btcpay/create-invoice.js");
  ok(/referralCode/.test(stripe) && /referralCode/.test(btc), "both rails already consume referralCode (read-only check; ask-before files untouched)");
  const api = read("api/account/referral-code.js");
  ok(/checkRateLimit\(/.test(api) && /requireUser\(req, res\)/.test(api) && /failSafely\(/.test(api), "endpoint is rate-limited, authenticated and envelope-safe");
}

if (failures) { console.error(`\n${failures} referral check(s) FAILED`); process.exit(1); }
console.log("\nAll referral checks passed.");
