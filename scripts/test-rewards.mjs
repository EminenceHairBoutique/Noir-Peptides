/*
  scripts/test-rewards.mjs   (opt cycle 12 — scorecard 4.5 / 4.2)
  Executes the REAL lib/rewards.js deduction against the in-memory Supabase
  stub: a normal redemption, the double-spend race (two checkouts validated
  against the same balance — exactly one may take the points), a balance that
  cannot cover the points (recorded as a shortfall, never clamped), and a
  lost compare-and-swap that retries once. Balances never go below zero.
  Run: node scripts/test-rewards.mjs   (in npm run test:unit)
*/
import { build } from "esbuild";
import path from "node:path";
import fs from "node:fs";

let failures = 0;
const ok = (c, m) => { if (c) console.log(`  ✓ ${m}`); else { failures++; console.error(`  ✗ ${m}`); } };

const outfile = path.join(process.cwd(), `.pricing-test-rewards-${Date.now()}.mjs`);
const entry = path.join(process.cwd(), "scripts/_rewards-entry.tmp.mjs");
fs.writeFileSync(entry, 'export { deductLoyaltyPoints, validateLoyaltyRedemption } from "../lib/rewards.js";\nexport { FIXTURES, LOG } from "../lib/supabaseServer.js";\n');
let mod;
try {
  await build({ entryPoints: [entry], bundle: true, format: "esm", platform: "node", outfile, logLevel: "silent",
    plugins: [{ name: "stub", setup(b) { b.onResolve({ filter: /supabaseServer\.js$/ }, () => ({ path: path.join(process.cwd(), "scripts/_pricing-stub-supabase.mjs") })); } }] });
  mod = await import(`file://${outfile}`);
} finally { fs.rmSync(entry, { force: true }); fs.rmSync(outfile, { force: true }); }
const { deductLoyaltyPoints, FIXTURES, LOG } = mod;
const USER = "user-1";
const reset = (points) => { FIXTURES.profiles = [{ id: USER, loyalty_points: points }]; FIXTURES.loyalty_ledger = []; LOG.length = 0; };
const balance = () => FIXTURES.profiles[0].loyalty_points;
const ledger = () => FIXTURES.loyalty_ledger.map((r) => `${r.reason}:${r.delta}`);
const quiet = async (fn) => { const e = console.error; console.error = () => {}; try { return await fn(); } finally { console.error = e; } };

console.log("Loyalty deduction (real lib/rewards.js, Supabase stubbed):");
{
  reset(250);
  let r = await deductLoyaltyPoints({ userId: USER, points: 100, orderNumber: "NP-1" });
  ok(r.ok === true && r.applied === 100 && balance() === 150, "250 − 100 → 150, applied 100");
  ok(ledger().join() === "redemption:-100" && FIXTURES.loyalty_ledger[0].order_number === "NP-1", "one redemption ledger row (−100) with the order number");

  reset(100);
  const [a, b] = await quiet(() => Promise.all([
    deductLoyaltyPoints({ userId: USER, points: 100, orderNumber: "NP-A" }),
    deductLoyaltyPoints({ userId: USER, points: 100, orderNumber: "NP-B" }),
  ]));
  const wins = [a, b].filter((x) => x.ok && x.applied === 100).length;
  const shorts = [a, b].filter((x) => !x.ok && x.shortfall).length;
  ok(wins === 1 && shorts === 1, `two checkouts against one 100-point balance: exactly one deducts, the other is a shortfall (wins ${wins}, shortfalls ${shorts})`);
  ok(balance() === 0, "balance ends at 0, never negative");
  ok(ledger().filter((x) => x === "redemption:-100").length === 1 && ledger().filter((x) => x === "redeem_shortfall:0").length === 1, "ledger: one redemption, one shortfall row (delta 0)");

  reset(50);
  r = await quiet(() => deductLoyaltyPoints({ userId: USER, points: 100, orderNumber: "NP-2" }));
  ok(r.ok === false && r.shortfall === true && balance() === 50, "a balance below the points is untouched (50 stays 50) and reported as a shortfall — no silent clamp to 0");
  ok(ledger().join() === "redeem_shortfall:0", "…with a shortfall ledger row");

  reset(300);
  r = await deductLoyaltyPoints({ userId: USER, points: 0, orderNumber: "NP-3" });
  ok(r.ok === true && r.applied === 0 && balance() === 300 && LOG.length === 0, "0 points is a no-op (no read, no write)");

  // Lost race: the balance moves between the read and the compare-and-swap; the retry re-reads.
  reset(200);
  const origFrom = mod.FIXTURES; void origFrom;
  let intercepted = false;
  const profiles = FIXTURES.profiles;
  const proxy = new Proxy(profiles, { get(t, k) { if (k === "filter" && !intercepted) { intercepted = true; profiles[0].loyalty_points = 120; } return t[k]; } });
  FIXTURES.profiles = proxy;
  r = await deductLoyaltyPoints({ userId: USER, points: 100, orderNumber: "NP-4" });
  FIXTURES.profiles = profiles;
  ok(r.ok === true && r.applied === 100 && profiles[0].loyalty_points === 20, `a lost compare-and-swap retries from a fresh read (200 → moved to 120 → 20 after deducting 100; got ${profiles[0].loyalty_points})`);
}

console.log("\nMigration 0040:");
{
  const sql = fs.readFileSync("supabase/migrations/0040_loyalty_nonnegative.sql", "utf8");
  ok(/check \(loyalty_points >= 0\) not valid/.test(sql) && /if not exists/.test(sql), "check constraint, NOT VALID, guarded (idempotent)");
  ok(!/drop table|truncate|delete from/i.test(sql), "no destructive statement");
  ok(fs.existsSync("docs/MIGRATIONS_0040.md") && /0040/.test(fs.readFileSync("docs/SCHEMA.md", "utf8")), "doc + SCHEMA row exist");
}

if (failures) { console.error(`\n${failures} rewards check(s) FAILED`); process.exit(1); }
console.log("\nAll rewards checks passed.");
