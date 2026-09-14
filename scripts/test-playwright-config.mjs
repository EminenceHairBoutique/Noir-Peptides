/*
  scripts/test-playwright-config.mjs   (opt cycle 12 — scorecard 4.12)
  The production post-deploy smoke (post-deploy.yml) had failed on every
  deployment in 2 s: with a remote E2E_BASE_URL Playwright still tried to
  start `vite preview` and refused ("… is already used") under CI, so the
  gate had never executed. Both configs now omit webServer for a remote base
  URL and keep it for localhost. This proves both branches of both configs.

  Run: node scripts/test-playwright-config.mjs   (in npm run test:unit)
*/
import { pathToFileURL } from "node:url";
import path from "node:path";

let failures = 0;
const ok = (c, m) => { if (c) console.log(`  ✓ ${m}`); else { failures++; console.error(`  ✗ ${m}`); } };

async function load(file, env, tag) {
  const saved = { E2E_BASE_URL: process.env.E2E_BASE_URL, CI: process.env.CI };
  for (const [k, v] of Object.entries(env)) { if (v == null) delete process.env[k]; else process.env[k] = v; }
  try {
    const url = pathToFileURL(path.join(process.cwd(), file)).href + `?${tag}`;
    return (await import(url)).default;
  } finally {
    for (const [k, v] of Object.entries(saved)) { if (v == null) delete process.env[k]; else process.env[k] = v; }
  }
}

for (const file of ["playwright.config.js", "playwright.mobile.config.js"]) {
  console.log(`${file}:`);
  const remote = await load(file, { E2E_BASE_URL: "https://noir-peptides-abc123-team.vercel.app", CI: "1" }, "remote");
  ok(remote.webServer === undefined, "remote E2E_BASE_URL under CI → no webServer (the smoke can run against a deployment)");
  ok(remote.use?.baseURL === "https://noir-peptides-abc123-team.vercel.app", "…and baseURL is the deployment");
  const local = await load(file, { E2E_BASE_URL: null, CI: null }, "local");
  ok(local.webServer && /preview/.test(local.webServer.command) && /localhost:4173/.test(local.webServer.url), "default → vite preview webServer on localhost:4173");
  const serveDist = await load(file, { E2E_BASE_URL: "http://localhost:4180", CI: null }, "servedist");
  ok(serveDist.webServer && serveDist.webServer.url === "http://localhost:4180", "a localhost override keeps the webServer (reuseExistingServer handles a running serve-dist)");
}

console.log("\npost-deploy.yml:");
{
  const { readFileSync } = await import("node:fs");
  const y = readFileSync("./.github/workflows/post-deploy.yml", "utf8");
  ok(/workflow_dispatch:/.test(y) && /inputs:\s*\n\s*url:/.test(y), "manual dispatch with a url input exists");
  ok(/inputs\.url \|\| github\.event\.deployment_status\.environment_url/.test(y), "E2E_BASE_URL falls back from the input to the deployment URL");
  ok(/github\.event_name == 'workflow_dispatch' \|\|/.test(y), "the job runs on dispatch as well as on a successful production deployment");
}

if (failures) { console.error(`\n${failures} playwright-config check(s) FAILED`); process.exit(1); }
console.log("\nAll playwright-config checks passed.");
