// scripts/test-error-telemetry.mjs
// Unit tests for the first-party error telemetry (Phase 6).
//   1. The reporter's pure helpers (noise filtering, event normalization,
//      length caps) — imported directly; the module is Node-import-safe.
//   2. Source-sync guards: the API's caps must match what the reporter sends,
//      and the wiring (main.jsx install, ErrorBoundary report, admin tab)
//      must not silently disappear in a refactor.
import { readFileSync } from "node:fs";
import {
  shouldIgnoreMessage,
  buildErrorEvent,
} from "../src/lib/errorReporter.js";

let passed = 0;
let failed = 0;
function check(name, cond) {
  if (cond) {
    passed += 1;
  } else {
    failed += 1;
    console.error(`  ✗ ${name}`);
  }
}

// ── 1. Noise filter ───────────────────────────────────────────────────────
check("ignores empty message", shouldIgnoreMessage(""));
check("ignores null message", shouldIgnoreMessage(null));
check("ignores cross-origin 'Script error.'", shouldIgnoreMessage("Script error."));
check("ignores ResizeObserver loop warning",
  shouldIgnoreMessage("ResizeObserver loop completed with undelivered notifications."));
check("ignores stale-deploy chunk failures",
  shouldIgnoreMessage("Loading chunk vendor-three failed"));
check("ignores connectivity failures", shouldIgnoreMessage("Failed to fetch"));
check("ignores AbortError", shouldIgnoreMessage("AbortError: The user aborted a request."));
check("keeps a real TypeError", !shouldIgnoreMessage("Cannot read properties of undefined (reading 'id')"));
check("keeps a real ReferenceError", !shouldIgnoreMessage("foo is not defined"));

// ── 2. Event normalization ────────────────────────────────────────────────
const err = new Error("boom");
const evErr = buildErrorEvent(err, "window", "/shop");
check("Error → message", evErr?.message === "boom");
check("Error → stack captured", typeof evErr?.stack === "string" && evErr.stack.includes("boom"));
check("Error → source window", evErr?.source === "window");
check("Error → path kept", evErr?.path === "/shop");

const evStr = buildErrorEvent("plain string failure", "promise");
check("string reason accepted", evStr?.message === "plain string failure");
check("promise source kept", evStr?.source === "promise");

const evObj = buildErrorEvent({ message: "obj message", stack: "at x" }, "boundary", "/cart");
check("object reason → message", evObj?.message === "obj message");
check("boundary source kept", evObj?.source === "boundary");

check("unknown source normalized to window",
  buildErrorEvent("x failed badly", "weird")?.source === "window");
check("noise returns null", buildErrorEvent(new Error("Script error."), "window") === null);
check("empty rejection returns null", buildErrorEvent(undefined, "promise") === null);

const long = "x".repeat(2000);
const evLong = buildErrorEvent(new Error(long), "window");
check("message capped at 500", evLong?.message.length === 500);
const bigStackErr = new Error("real failure");
bigStackErr.stack = "y".repeat(9000);
check("stack capped at 4000", buildErrorEvent(bigStackErr, "window")?.stack.length === 4000);

// Circular rejection values must not throw.
const circ = {};
circ.self = circ;
check("circular rejection survives",
  buildErrorEvent(circ, "promise")?.message === "[unserializable rejection value]");

// ── 3. Source-sync guards (contract can't silently drift) ─────────────────
const apiSrc = readFileSync(new URL("../api/client-error.js", import.meta.url), "utf8");
const reporterSrc = readFileSync(new URL("../src/lib/errorReporter.js", import.meta.url), "utf8");
const mainSrc = readFileSync(new URL("../src/main.jsx", import.meta.url), "utf8");
const boundarySrc = readFileSync(new URL("../src/components/ErrorBoundary.jsx", import.meta.url), "utf8");
const adminSrc = readFileSync(new URL("../src/pages/AdminHome.jsx", import.meta.url), "utf8");
const migration = readFileSync(new URL("../supabase/migrations/0025_client_errors.sql", import.meta.url), "utf8");

check("API caps message at 500 (matches reporter)",
  apiSrc.includes("max: 500") && reporterSrc.includes("MAX_MESSAGE = 500"));
check("API caps stack at 4000 (matches reporter)",
  apiSrc.includes("max: 4000") && reporterSrc.includes("MAX_STACK = 4000"));
check("API is rate-limited", apiSrc.includes("checkRateLimit"));
check("API computes its own fingerprint (ignores client)", apiSrc.includes('createHash("sha256")'));
check("reporter installed in main.jsx", mainSrc.includes("installErrorReporter()"));
check("ErrorBoundary reports crashes", boundarySrc.includes('reportClientError(error, "boundary")'));
check("admin tab wired", adminSrc.includes('"/api/admin/client-errors"'));
check("table is admin-read-only with no client INSERT policy",
  migration.includes("client_errors_admin_read") && !/for insert/i.test(migration));

if (failed > 0) {
  console.error(`\nerror-telemetry: ${failed} FAILED, ${passed} passed`);
  process.exit(1);
}
console.log(`error-telemetry: all ${passed} assertions passed`);
