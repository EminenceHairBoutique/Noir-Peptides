/*
  scripts/test-doc-drift.mjs   (opt cycle 12 — scorecard 4.13)
  Owner-facing documents must not contradict the code. Two drift classes the
  cycle-12 recon found: (1) instructions naming env variables the code no
  longer reads (STRIPE_US_SHIPPING_RATE_ID: "without it checkout errors"),
  (2) the opposite of a hard rule (the Copilot instructions and a checklist
  described the catalog as login-gated — a future agent would re-gate it).
  Run: node scripts/test-doc-drift.mjs   (in npm run test:unit)
*/
import fs from "node:fs";

let failures = 0;
const ok = (c, m) => { if (c) console.log(`  ✓ ${m}`); else { failures++; console.error(`  ✗ ${m}`); } };
const DOCS = ["docs/RUNBOOK.md", "LAUNCH_CHECKLIST.md", "docs/LAUNCH_CHECKLIST.md", ".github/copilot-instructions.md", "LAUNCH_READINESS.md"];
const envExample = fs.readFileSync(".env.example", "utf8");
const documented = new Set([...envExample.matchAll(/^#?\s*([A-Z][A-Z0-9_]{2,})\s*=/gm)].map((m) => m[1]));
const PLATFORM = /^(VERCEL|GITHUB|CI|NODE_ENV|PLAYWRIGHT|CHROME_PATH|PATH|HOME)/;

console.log("Env names in owner docs exist in .env.example:");
{
  // A code constant (ATTESTATION_VERSION, PRERENDER_EMPTY_ALLOWLIST…) is not an
  // env variable: anything declared in src/, lib/, api/ or scripts/ is skipped.
  const code = [];
  (function walk(d) { for (const e of fs.readdirSync(d, { withFileTypes: true })) { const q = `${d}/${e.name}`; if (e.isDirectory()) walk(q); else if (/\.(m?js|jsx)$/.test(e.name)) code.push(fs.readFileSync(q, "utf8")); } })("src"); ["lib", "api", "scripts"].forEach((d) => (function walk(dd) { for (const e of fs.readdirSync(dd, { withFileTypes: true })) { const q = `${dd}/${e.name}`; if (e.isDirectory()) walk(q); else if (/\.(m?js|jsx)$/.test(e.name)) code.push(fs.readFileSync(q, "utf8")); } })(d));
  const allCode = code.join("\n");
  const declaredInCode = (name) => new RegExp(`(const|let|var|function|export const|export function)\\s+${name}\\b`).test(allCode);
  const stale = [];
  for (const doc of DOCS) {
    const text = fs.readFileSync(doc, "utf8");
    for (const m of text.matchAll(/`([A-Z][A-Z0-9]*_[A-Z0-9_]{2,})`/g)) {
      const name = m[1];
      if (PLATFORM.test(name) || documented.has(name) || declaredInCode(name)) continue;
      stale.push(`${name} ← ${doc}`);
    }
  }
  ok(stale.length === 0, `every env-shaped name in the owner docs is documented in .env.example (stale: ${JSON.stringify([...new Set(stale)])})`);
}

console.log("\nNo document contradicts the public-catalog rule:");
{
  const forbidden = /storefront is gated|catalog is gated|cannot read product rows|gates catalog\/COA reads|catalog\/COA reads on `is_attested\(\)`/i;
  const hits = DOCS.filter((d) => forbidden.test(fs.readFileSync(d, "utf8")));
  ok(hits.length === 0, `no owner doc says the catalog is login-gated (hits: ${JSON.stringify(hits)})`);
  ok(/catalog is public/i.test(fs.readFileSync(".github/copilot-instructions.md", "utf8")), "the Copilot instructions state the catalog is public");
}

console.log("\nSpec provenance wording:");
{
  const specs = fs.readFileSync("src/data/productSpecs.js", "utf8");
  ok(/TRANSCRIPTION/.test(specs) && !/transcription of a verified source/.test(specs), "productSpecs.js says transcribed, not verified");
  const readiness = fs.readFileSync("LAUNCH_READINESS.md", "utf8");
  ok(!/12\s+products with verified values/.test(readiness) && !/other 32 are/.test(readiness), "LAUNCH_READINESS counts 11 / 33, not 12 / 32");
}

if (failures) { console.error(`\n${failures} doc-drift check(s) FAILED`); process.exit(1); }
console.log("\nAll doc-drift checks passed.");
