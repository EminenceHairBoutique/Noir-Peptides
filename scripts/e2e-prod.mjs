/*
  scripts/e2e-prod.mjs   (npm run test:e2e:prod)
  Runs the Playwright E2E suite against a real deployment, failing FAST with a
  clear message if E2E_API_URL is not set — so the server-gate specs actually
  execute instead of silently skipping (they self-skip when E2E_API_URL is
  absent, which is right for the default run but wrong for a prod gate).

  Point E2E_API_URL at the deployed API origin (with Supabase + Stripe live),
  and E2E_BASE_URL at the deployed site if it differs from the default preview.
*/
import { spawn } from "node:child_process";

if (!process.env.E2E_API_URL) {
  console.error(
    "\n⛔ test:e2e:prod requires E2E_API_URL.\n\n" +
      "   Set it to the deployed API origin so the server-gate specs run\n" +
      "   (attestation/checkout gates), instead of skipping:\n\n" +
      "     E2E_API_URL=https://www.noirpeptides.com \\\n" +
      "     E2E_BASE_URL=https://www.noirpeptides.com \\\n" +
      "     npm run test:e2e:prod\n\n" +
      "   For the local default run (specs self-skip the server gates), use:\n" +
      "     npm run test:e2e\n"
  );
  process.exit(1);
}

const child = spawn("npx", ["playwright", "test"], { stdio: "inherit", env: process.env });
child.on("exit", (code) => process.exit(code ?? 1));
child.on("error", (e) => {
  console.error(`test:e2e:prod: ${e.message}`);
  process.exit(1);
});
