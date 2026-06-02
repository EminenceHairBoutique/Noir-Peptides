import { spawn } from "child_process";

// Cross-platform dev runner.
// Starts:
//  - API dev server (port 3000)  — optional; failure does NOT kill Vite
//  - Vite dev server (port 5173) — primary target, always must stay alive
//
// Windows note:
// Node v24+ + PowerShell can throw `spawn EINVAL` when spawning npm directly.
// Running via cmd.exe is the most reliable approach.

const isWin = process.platform === "win32";
const procs = [];

function start(label, command, args, { optional = false } = {}) {
  const p = spawn(command, args, {
    stdio: "inherit",
    env: { ...process.env, FORCE_COLOR: "1" },
    windowsHide: false,
  });

  p.on("error", (err) => {
    console.error(`\n[${label}] failed to start:`, err);
    if (!optional) shutdown();
  });

  p.on("exit", (code) => {
    if (code && code !== 0) {
      console.error(`\n[${label}] exited with code ${code}`);
      if (optional) {
        console.warn(`[${label}] is optional — Vite continues without it.`);
        console.warn(`[${label}] Tip: add STRIPE_SECRET_KEY and SUPABASE keys to .env.local for full API support.\n`);
        return; // don't cascade
      }
    }
    if (!optional) shutdown();
  });

  procs.push(p);
  return p;
}

function runNpmScript(label, scriptName, opts = {}) {
  if (isWin) {
    return start(label, "cmd.exe", ["/d", "/s", "/c", `npm run ${scriptName}`], opts);
  }
  return start(label, "npm", ["run", scriptName], opts);
}

let shuttingDown = false;
function shutdown() {
  if (shuttingDown) return;
  shuttingDown = true;

  for (const p of procs) {
    try {
      p.kill("SIGINT");
    } catch {
      try { p.kill(); } catch { /* ignore */ }
    }
  }

  setTimeout(() => process.exit(0), 400);
}

process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);

// API is optional (needs STRIPE_SECRET_KEY + SUPABASE vars in .env.local)
// Vite is required — if it exits, the whole runner exits.
runNpmScript("api", "dev:api", { optional: true });
runNpmScript("vite", "dev:vite");
