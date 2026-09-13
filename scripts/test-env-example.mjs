/*
  scripts/test-env-example.mjs   (opt cycle 3 — scorecard 4.13)
  `.env.example` must be COMPLETE and SECRET-FREE:
    - every environment variable the runtime (api/, lib/, src/) or the
      operator scripts (scripts/) read is documented there, as `NAME=` or a
      commented `# NAME=` line — platform-provided names are allowlisted;
    - no documented value has the shape of a real credential.
  Inversion generator: "what makes a deploy fail silently?" — an env var
  nobody wrote down.

  Run: node scripts/test-env-example.mjs   (wired into npm run test:unit)
*/
import { readdirSync, statSync, readFileSync } from "node:fs";
import path from "node:path";

let failures = 0;
const ok = (cond, msg) => {
  if (cond) console.log(`  ✓ ${msg}`);
  else { failures++; console.error(`  ✗ ${msg}`); }
};
const ROOT = process.cwd();
const walk = (d, out = []) => {
  for (const e of readdirSync(d)) {
    const p = path.join(d, e);
    if (statSync(p).isDirectory()) { if (e !== "node_modules") walk(p, out); }
    else if (/\.(m?js|jsx)$/.test(e)) out.push(p);
  }
  return out;
};

// Names the platform (Vite / Node / Vercel / CI / Playwright) sets itself.
const PLATFORM = new Set(["NODE_ENV", "DEV", "PROD", "MODE", "BASE_URL", "SSR", "CI", "VERCEL", "VERCEL_URL", "VERCEL_ENV", "PLAYWRIGHT_CHROMIUM_PATH", "HOME", "PATH"]);
// GitHub Actions sets GITHUB_* on every runner (opt cycle 9: the evidence
// scripts read GITHUB_SHA / RUN_ID / … for provenance).
const isPlatform = (n) => PLATFORM.has(n) || /^GITHUB_/.test(n);

const used = new Map(); // name → first file
for (const dir of ["api", "lib", "src", "scripts"]) {
  for (const f of walk(path.join(ROOT, dir))) {
    const src = readFileSync(f, "utf8");
    for (const m of src.matchAll(/(?:process\.env|import\.meta\??\.env|\benv)\??\.([A-Z][A-Z0-9_]+)/g)) {
      if (!PLATFORM.has(m[1]) && !used.has(m[1])) used.set(m[1], path.relative(ROOT, f));
    }
  }
}

const example = readFileSync(path.join(ROOT, ".env.example"), "utf8");
const documented = new Set();
for (const m of example.matchAll(/^\s*#?\s*([A-Z][A-Z0-9_]+)\s*=/gm)) documented.add(m[1]);

const missing = [...used.keys()].filter((n) => !documented.has(n) && !isPlatform(n)).sort();
ok(used.size >= 30, `runtime + scripts read ${used.size} distinct env names`);
ok(missing.length === 0, `every env name read by code is documented in .env.example (missing: ${JSON.stringify(missing.map((n) => `${n} ← ${used.get(n)}`))})`);

// Documented but read nowhere: a stale name misleads the operator.
const unused = [...documented].filter((n) => !used.has(n) && !isPlatform(n)).sort();
ok(unused.length === 0, `every documented env name is read somewhere (stale: ${JSON.stringify(unused)})`);

// Secret shapes: nothing in the example may look like a live credential.
const SECRET = [
  [/sk_live_[A-Za-z0-9]{16,}/, "Stripe live secret"],
  [/sk_test_[A-Za-z0-9]{16,}/, "Stripe test secret"],
  [/whsec_[A-Za-z0-9]{16,}/, "Stripe webhook secret"],
  [/\bre_[A-Za-z0-9_]{20,}/, "Resend key"],
  [/sk-ant-[A-Za-z0-9_-]{8,}/, "Anthropic key"],
  [/\bpa-[A-Za-z0-9_-]{20,}/, "Voyage key"],
  [/eyJ[A-Za-z0-9_-]{20,}\.[A-Za-z0-9_-]{10,}/, "JWT"],
  [/https:\/\/[a-z]{20}\.supabase\.co/, "real Supabase project ref"],
];
const leaks = SECRET.filter(([re]) => re.test(example)).map(([, label]) => label);
ok(leaks.length === 0, `no value in .env.example has a credential shape (${JSON.stringify(leaks)})`);

console.log(failures ? `\n${failures} assertion(s) failed` : "\nAll .env.example assertions passed");
process.exit(failures ? 1 : 0);
