/*
  scripts/test-rate-limits.mjs   (opt c7 — scorecard 4.2)
  Every PUBLIC endpoint that accepts a POST must rate-limit before it
  writes or sends — "what lets a hostile client flood the database or the
  mailer?" is answered by the one helper (api/_utils/rateLimit.js) being
  wired into every such handler. The two payment webhooks are exempt: they
  are signature-verified and provider-driven (and ask-before files).
  Admin handlers sit behind requireAdmin and are not in scope here.

  Run: node scripts/test-rate-limits.mjs   (wired into npm run test:unit)
*/
import { readdirSync, readFileSync, statSync } from "node:fs";
import path from "node:path";

let failures = 0;
const ok = (cond, msg) => {
  if (cond) console.log(`  ✓ ${msg}`);
  else { failures++; console.error(`  ✗ ${msg}`); }
};
const ROOT = process.cwd();
const walk = (d, out = []) => { for (const e of readdirSync(d)) { const p = path.join(d, e); if (statSync(p).isDirectory()) { if (!/^(admin|_utils)$/.test(e)) walk(p, out); } else if (e.endsWith(".js")) out.push(p); } return out; };
const files = walk(path.join(ROOT, "api"));
const WEBHOOKS = new Set(["api/stripe-webhook.js", "api/btcpay/webhook.js"]);

const publicPost = [];
for (const f of files) {
  const rel = path.relative(ROOT, f);
  const src = readFileSync(f, "utf8");
  const acceptsPost = /method\s*!==\s*"POST"|method\s*===\s*"POST"/.test(src);
  if (!acceptsPost) continue;
  if (/\/_shared\.js$/.test(rel)) continue;                 // helper, not a handler
  if (/requireAdmin\(/.test(src)) continue;                  // admin-gated: out of scope
  // The AI endpoints go through aiHandler(), which rate-limits centrally.
  const limited = /checkRateLimit\(/.test(src) || /aiHandler\(/.test(src);
  publicPost.push([rel, limited, /signature|verifyWebhook|constructEvent|BTCPay-Sig|hmac/i.test(src)]);
}
ok(publicPost.length >= 10, `${publicPost.length} public POST handlers found`);
const missing = publicPost.filter(([rel, limited]) => !limited && !WEBHOOKS.has(rel)).map(([rel]) => rel);
ok(missing.length === 0, `every public POST handler calls checkRateLimit (missing: ${JSON.stringify(missing)})`);
const webhooks = publicPost.filter(([rel]) => WEBHOOKS.has(rel));
ok(webhooks.length === 2 && webhooks.every(([, , signed]) => signed), "both webhooks verify a signature instead (exempt by design)");
// The helper itself: DB-backed with an in-memory backstop; a missing table
// must not open the gate.
const helper = readFileSync(path.join(ROOT, "api/_utils/rateLimit.js"), "utf8");
ok(/in-memory/i.test(helper) && /supabaseServer/.test(helper), "rate limiter is DB-backed with an in-memory backstop");
const shared = readFileSync(path.join(ROOT, "api/ai/_shared.js"), "utf8");
ok(/checkRateLimit\(/.test(shared), "aiHandler() itself calls checkRateLimit (so the AI endpoints count as limited)");
for (const [rel, limited] of publicPost) console.log(`    ${limited ? "·" : "!"} ${rel}`);

console.log(failures ? `\n${failures} assertion(s) failed` : "\nAll rate-limit coverage assertions passed");
process.exit(failures ? 1 : 0);
