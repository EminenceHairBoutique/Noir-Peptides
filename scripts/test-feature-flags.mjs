/*
  scripts/test-feature-flags.mjs   (Sept-11 T6)
  Launch feature flags. Proves:
    - the parser: only 1/true/on/yes (any case) turn a flag on; default OFF;
    - flags UNSET → each PUBLIC AI endpoint answers 404 with the sanitized
      envelope {error, code, requestId}, regardless of method;
    - flags SET → the gate passes and previous behaviour resumes (a GET reaches
      the handler's own 405 "Method not allowed");
    - the admin AI tools (coa-analyzer, compliance-scan) are NOT gated;
    - nothing turns a flag on by default: not code, not .env.example, not docs;
    - the client routes /calculator and /assistant are gated in App.jsx.
  The endpoint modules import the Supabase server client, which needs a URL at
  construction (never connects), so a placeholder is set before the dynamic
  import — no network is touched.

  Run: node scripts/test-feature-flags.mjs   (wired into npm run test:unit)
*/
import { readFileSync } from "node:fs";
import { parseFlag, clientFeatures, serverFeatures } from "../lib/featureFlags.js";

let failures = 0;
const ok = (cond, msg) => {
  if (cond) console.log(`  ✓ ${msg}`);
  else {
    failures++;
    console.error(`  ✗ ${msg}`);
  }
};
const read = (rel) => readFileSync(new URL(rel, import.meta.url), "utf8");

console.log("parseFlag:");
for (const v of ["1", "true", "TRUE", " on ", "yes", "Yes"]) ok(parseFlag(v) === true, `"${v}" → on`);
for (const v of [undefined, null, "", "0", "false", "off", "no", "enabled", "2", " "]) ok(parseFlag(v) === false, `${JSON.stringify(v)} → off`);

console.log("\nresolvers default OFF:");
ok(clientFeatures({}).calculator === false && clientFeatures({}).aiPublic === false, "clientFeatures({}) → both off");
ok(serverFeatures({}).aiPublic === false, "serverFeatures({}) → off");
ok(clientFeatures({ VITE_FEATURE_CALCULATOR: "1" }).calculator === true, "VITE_FEATURE_CALCULATOR=1 → calculator on");
ok(clientFeatures({ VITE_FEATURE_AI_PUBLIC: "true" }).aiPublic === true, "VITE_FEATURE_AI_PUBLIC=true → aiPublic on");
ok(clientFeatures({ FEATURE_AI_PUBLIC: "1" }).aiPublic === false, "the SERVER variable does not switch the CLIENT flag (they are set separately)");
ok(serverFeatures({ VITE_FEATURE_AI_PUBLIC: "1" }).aiPublic === false, "the CLIENT variable does not switch the SERVER flag");
ok(Object.isFrozen(clientFeatures({})), "resolved flags are frozen");

// ── Runtime: the gate on each public endpoint ────────────────────────────
// Placeholder env so module construction (supabase createClient) succeeds.
process.env.VITE_SUPABASE_URL ||= "https://placeholder.supabase.co";
process.env.SUPABASE_SERVICE_ROLE_KEY ||= "placeholder";
delete process.env.FEATURE_AI_PUBLIC;

function makeRes() {
  const r = { statusCode: null, payload: null, headers: {}, headersSent: false };
  r.setHeader = (k, v) => { r.headers[k] = v; };
  r.status = (c) => { r.statusCode = c; return r; };
  r.json = (p) => { r.payload = p; r.headersSent = true; return r; };
  r.end = (p) => { if (p && r.payload === null) { try { r.payload = JSON.parse(p); } catch { r.payload = p; } } r.headersSent = true; return r; };
  return r;
}

const PUBLIC = ["concierge", "research-assistant", "literature-summarizer", "semantic-search"];
const ADMIN = ["coa-analyzer", "compliance-scan"];
const handlers = {};
for (const name of PUBLIC) handlers[name] = (await import(`../api/ai/${name}.js`)).default;

// Silence failSafely's server log line during the test; it is the envelope's
// job to log, but 8 stack traces in test output help nobody.
const realError = console.error;
console.error = () => {};

console.log("\nFEATURE_AI_PUBLIC unset → every public endpoint is 404 with the envelope:");
for (const name of PUBLIC) {
  for (const method of ["GET", "POST"]) {
    const res = makeRes();
    await handlers[name]({ method, headers: {}, body: {} }, res);
    ok(res.statusCode === 404, `${name} ${method} → 404`);
    ok(
      res.payload && res.payload.code === "not_found" && typeof res.payload.requestId === "string" && typeof res.payload.error === "string",
      `${name} ${method} → sanitized envelope {error, code:"not_found", requestId}`
    );
    ok(!JSON.stringify(res.payload).includes("feature disabled"), `${name} ${method} → internal reason never reaches the wire`);
  }
}

console.log("\nFEATURE_AI_PUBLIC=1 → the gate passes (previous behaviour resumes):");
process.env.FEATURE_AI_PUBLIC = "1";
for (const name of PUBLIC) {
  const res = makeRes();
  await handlers[name]({ method: "GET", headers: {}, body: {} }, res);
  // Past the gate, every one of these handlers rejects GET itself with 405.
  ok(res.statusCode === 405, `${name} GET → 405 from the handler itself (not 404: the gate passed)`);
}
delete process.env.FEATURE_AI_PUBLIC;
console.error = realError;

// ── Static: admin tools untouched; nothing defaults on; routes gated ──────
console.log("\nStatic guards:");
for (const name of PUBLIC) ok(/gateFeature\(res, "aiPublic"\)/.test(read(`../api/ai/${name}.js`)), `${name} calls the gate`);
for (const name of ADMIN) ok(!/gateFeature|features\.js/.test(read(`../api/ai/${name}.js`)), `${name} (admin tool) is NOT gated`);
{
  const lib = read("../lib/featureFlags.js");
  ok(!/parseFlag\([^)]*\)\s*\|\|\s*true|\?\?\s*true|=\s*true/.test(lib), "lib/featureFlags.js has no `true` default");
  const client = read("../src/config/features.js");
  ok(/clientFeatures\(import\.meta\.env/.test(client) && !/true/.test(client.replace(/\/\/[^\n]*/g, "")), "client config only reads env; no literal true");
  const server = read("../api/_utils/features.js");
  ok(/serverFeatures\(process\.env\)/.test(server) && !/=\s*true/.test(server), "server mirror only reads env; no literal true");
  const env = read("../.env.example");
  for (const k of ["VITE_FEATURE_CALCULATOR", "VITE_FEATURE_AI_PUBLIC", "FEATURE_AI_PUBLIC"]) {
    ok(env.includes(k), `.env.example documents ${k}`);
    ok(!new RegExp(`^\\s*${k}\\s*=\\s*(1|true|on|yes)`, "im").test(env), `.env.example does not enable ${k}`);
  }
  const app = read("../src/App.jsx");
  ok(/FEATURES\.calculator \? <Calculator \/> : <NotFound \/>/.test(app), "App.jsx routes /calculator to NotFound when off");
  ok(/FEATURES\.aiPublic \? <RequireAuth><Assistant \/><\/RequireAuth> : <NotFound \/>/.test(app), "App.jsx routes /assistant to NotFound when off");
  const console_ = read("../src/pages/ResearcherConsole.jsx");
  ok(/FEATURES\.calculator/.test(console_) && /FEATURES\.aiPublic/.test(console_), "Researcher Console hides links to both gated surfaces");
  const gen = read("../scripts/generate-static-seo.mjs");
  ok(/BUILD_FEATURES\.calculator\s*\?/.test(gen) && /\.\.\.\(BUILD_FEATURES\.calculator \? \["\/calculator"\] : \[\]\)/.test(gen), "prerenderer swaps /calculator to the 404 body and drops it from the allowlist when off");
  const checklist = read("../LAUNCH_CHECKLIST.md");
  ok(/Owner decisions/.test(checklist) && /VITE_FEATURE_CALCULATOR/.test(checklist) && /FEATURE_AI_PUBLIC/.test(checklist), "LAUNCH_CHECKLIST documents both flags under Owner decisions");
}

if (failures) {
  console.error(`\n${failures} feature-flag check(s) FAILED`);
  process.exit(1);
}
console.log("\nAll feature-flag checks passed.");
