/*
  scripts/test-error-envelopes.mjs   (opt cycle 1 — scorecard 4.2)
  Two invariants across api/**:
    1. No raw provider/database error text reaches a response. A `.message`
       from a caught error may be LOGGED (console.*) or passed to failSafely
       (which logs it under a request id and returns the stable envelope), but
       must never appear in a `.send(`, `.json(`, or `json(res, …)` call.
       Documented exception: api/stripe-webhook.js echoes Stripe's own
       signature-verification message on 400 — that file is ask-before and is
       listed in the escalation list, not silently exempted.
    2. Every api/admin/*.js handler calls requireAdmin.
  Plus a runtime proof on the public contact endpoint: a failing email
  transport yields the envelope, not the transport's message.

  Run: node scripts/test-error-envelopes.mjs   (wired into npm run test:unit)
*/
import { readdirSync, readFileSync, statSync } from "node:fs";
import path from "node:path";

let failures = 0;
const ok = (cond, msg) => {
  if (cond) console.log(`  ✓ ${msg}`);
  else {
    failures++;
    console.error(`  ✗ ${msg}`);
  }
};

const API = path.join(process.cwd(), "api");
function files(dir, out = []) {
  for (const e of readdirSync(dir)) {
    const p = path.join(dir, e);
    if (statSync(p).isDirectory()) files(p, out);
    else if (p.endsWith(".js")) out.push(p);
  }
  return out;
}
const all = files(API);

const KNOWN_EXCEPTIONS = {
  "api/stripe-webhook.js": "echoes Stripe's signature-verification message on 400 (ask-before file; escalated)",
};

console.log("1. No raw error text reaches a response:");
const leakRe = /(\.send\(|\.json\(|json\(\s*res\s*,)[^;]*\b(err|error|e)\??\.message/;
let leaks = [];
for (const f of all) {
  const rel = path.relative(process.cwd(), f);
  const src = readFileSync(f, "utf8").replace(/\/\/[^\n]*/g, "").replace(/\/\*[\s\S]*?\*\//g, "");
  // Also catch the object-literal form `{ error: err.message }` anywhere in a response object.
  const objForm = /\{[^}]*\berror:\s*(?:"[^"]*"\s*\+\s*)?(err|error|e)\??\.message[^}]*\}/;
  if (leakRe.test(src) || objForm.test(src)) {
    if (KNOWN_EXCEPTIONS[rel]) console.log(`  ⓘ ${rel}: known exception — ${KNOWN_EXCEPTIONS[rel]}`);
    else leaks.push(rel);
  }
}
ok(leaks.length === 0, `no api/** file sends err.message to the client (leaks: ${JSON.stringify(leaks)})`);
ok(Object.keys(KNOWN_EXCEPTIONS).every((k) => all.some((f) => path.relative(process.cwd(), f) === k)), "every documented exception still exists (no stale exemptions)");
for (const rel of ["api/contact.js", "api/partners/directory-settings.js", "api/ai/compliance-scan.js"]) {
  const src = readFileSync(path.join(process.cwd(), rel), "utf8");
  ok(!/\.(send|json)\([^;]*\.message/.test(src.replace(/\/\/[^\n]*/g, "")), `${rel}: the cycle-1 fix holds`);
}

console.log("\n2. Every api/admin/*.js calls requireAdmin:");
for (const f of all.filter((p) => p.includes(`${path.sep}admin${path.sep}`))) {
  const rel = path.relative(process.cwd(), f);
  const src = readFileSync(f, "utf8");
  ok(/requireAdmin\(req, res\)/.test(src), `${rel} guards with requireAdmin(req, res)`);
}

console.log("\n3. Runtime: public /api/contact returns the envelope when the transport fails:");
{
  process.env.VITE_SUPABASE_URL ||= "https://placeholder.supabase.co";
  process.env.SUPABASE_SERVICE_ROLE_KEY ||= "placeholder";
  delete process.env.RESEND_API_KEY;
  const handler = (await import("../api/contact.js")).default;
  const res = { statusCode: null, payload: null, headersSent: false, headers: {} };
  res.setHeader = (k, v) => { res.headers[k] = v; };
  res.status = (c) => { res.statusCode = c; return res; };
  res.json = (p) => { res.payload = p; res.headersSent = true; return res; };
  res.send = (p) => { res.payload = p; res.headersSent = true; return res; };
  res.end = (p) => { if (p != null) { try { res.payload = JSON.parse(p); } catch { res.payload = p; } } res.headersSent = true; return res; };
  const realErr = console.error;
  console.error = () => {};
  try {
    await handler(
      { method: "POST", headers: { "content-type": "application/json" }, body: { type: "general", name: "Test", email: "t@example.test", message: "hello", website: "" } },
      res
    );
  } finally {
    console.error = realErr;
  }
  const body = res.payload;
  const isEnvelope = body && typeof body === "object" && typeof body.error === "string" && typeof body.code === "string" && typeof body.requestId === "string";
  const rawLeak = typeof body === "string" || (body && /RESEND|api key|resend|fetch failed|ECONN|Error:/i.test(JSON.stringify(body)));
  ok(res.statusCode !== null, `handler responded (status ${res.statusCode})`);
  if (res.statusCode >= 500) {
    ok(isEnvelope, "5xx carries the sanitized envelope {error, code, requestId}");
    ok(!rawLeak, "no transport/provider text in the response");
  } else {
    console.log(`  ⓘ contact returned ${res.statusCode} without RESEND configured (queued/validated path) — envelope rule not exercised at runtime here`);
  }
}

if (failures) {
  console.error(`\n${failures} error-envelope check(s) FAILED`);
  process.exit(1);
}
console.log("\nAll error-envelope checks passed.");
