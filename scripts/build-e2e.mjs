/*
  scripts/build-e2e.mjs   (opt cycle 5 — scorecards 4.9 / 4.5, Hy-006)
  The production build has no Supabase env in CI, so Vite folds the browser
  client to `null` and every gated route bounces to /login — the two-step
  checkout could never be exercised end to end. This build gives ONLY the
  Vite step a fake project URL under *.supabase.co (already allowed by the
  CSP) and a placeholder anon key, then runs the prerender / precache / CSP
  steps exactly as `npm run build` does — WITHOUT that env, so the
  build-time data-presence assertion behaves precisely as in production.
  At test time Playwright routes every call to the fake host
  (tests/e2e/fixtures/auth.js); nothing in production code changes.

  Usage: npm run build:e2e
*/
import { spawnSync } from "node:child_process";

export const E2E_SUPABASE_URL = "https://e2e.supabase.co";
export const E2E_SUPABASE_ANON_KEY = "e2e-anon-key-not-a-secret";

function run(cmd, args, env) {
  const r = spawnSync(cmd, args, { stdio: "inherit", env, shell: process.platform === "win32" });
  if (r.status !== 0) process.exit(r.status ?? 1);
}

const base = { ...process.env };
delete base.VITE_SUPABASE_URL;
delete base.VITE_SUPABASE_ANON_KEY;
delete base.SUPABASE_URL;
delete base.SUPABASE_ANON_KEY;

if (process.argv[1] && import.meta.url.endsWith(process.argv[1].split(/[\\/]/).pop())) {
  console.log(`[build:e2e] vite build with VITE_SUPABASE_URL=${E2E_SUPABASE_URL} (fake; routed by Playwright)`);
  run("node", ["scripts/generate-og-image.mjs"], base);
  run("npx", ["vite", "build"], { ...base, VITE_SUPABASE_URL: E2E_SUPABASE_URL, VITE_SUPABASE_ANON_KEY: E2E_SUPABASE_ANON_KEY });
  console.log("[build:e2e] prerender / precache / CSP without Supabase env (as in production CI)");
  run("node", ["scripts/generate-static-seo.mjs"], base);
  run("node", ["scripts/generate-sw-precache.mjs"], base);
  run("node", ["scripts/emit-csp.mjs"], base);
}
