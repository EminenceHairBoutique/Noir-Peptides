// src/lib/errorReporter.js
// First-party production error telemetry. Wires window "error" +
// "unhandledrejection" (and ErrorBoundary via reportClientError) to
// POST /api/client-error, which is the only writer to the admin-reviewed
// client_errors table.
//
// Design constraints:
//   - Fire-and-forget: reporting can never throw, recurse, or block the page
//     (sendBeacon first, keepalive fetch fallback, everything try/wrapped).
//   - Bounded: per-session dedupe + a hard cap on reports per page load, so
//     a render loop can't hammer the endpoint (the server rate-limits and
//     collapses duplicates too — this is just politeness).
//   - Quiet in dev, and silent on browser noise that isn't ours to fix
//     (cross-origin "Script error.", ResizeObserver loop warnings, aborts).
//
// Module is Node-import-safe (no window/document at module scope) so the
// pure helpers below are unit-testable in plain Node.

const ENDPOINT = "/api/client-error";
const MAX_REPORTS_PER_SESSION = 10;
const MAX_MESSAGE = 500;
const MAX_STACK = 4000;

// Noise that reveals nothing actionable about OUR code.
const IGNORE_PATTERNS = [
  /^Script error\.?$/i,                       // opaque cross-origin errors
  /ResizeObserver loop/i,                     // benign browser warning
  /^AbortError\b/i,                           // caller-initiated aborts
  /Loading chunk [\w-]+ failed/i,             // stale deploy — reload fixes it
  /Failed to fetch dynamically imported module/i,
  /NetworkError|Load failed|Failed to fetch/i, // user connectivity, not a bug
];

/** True when a message is browser noise we deliberately don't report. */
export function shouldIgnoreMessage(message) {
  const m = String(message || "").trim();
  if (!m) return true;
  return IGNORE_PATTERNS.some((re) => re.test(m));
}

/**
 * Normalize anything throwable into the bounded event the API accepts.
 * Returns null when the event should be dropped (noise / empty).
 */
export function buildErrorEvent(errorLike, source, path) {
  let message = "";
  let stack = "";
  if (errorLike instanceof Error) {
    message = errorLike.message || String(errorLike);
    stack = errorLike.stack || "";
  } else if (errorLike && typeof errorLike === "object") {
    message = errorLike.message ? String(errorLike.message) : safeStringify(errorLike);
    stack = errorLike.stack ? String(errorLike.stack) : "";
  } else {
    message = String(errorLike ?? "");
  }
  message = message.trim().slice(0, MAX_MESSAGE);
  if (shouldIgnoreMessage(message)) return null;
  return {
    message,
    stack: stack ? String(stack).slice(0, MAX_STACK) : undefined,
    source: source === "promise" || source === "boundary" ? source : "window",
    path: path ? String(path).slice(0, 512) : undefined,
  };
}

function safeStringify(obj) {
  try {
    return JSON.stringify(obj).slice(0, MAX_MESSAGE);
  } catch {
    return "[unserializable rejection value]";
  }
}

// ── Browser wiring (everything below touches window; never runs in Node) ──

const sessionSeen = new Set();
let sessionReports = 0;
let installed = false;

function send(event) {
  const body = JSON.stringify(event);
  try {
    if (navigator.sendBeacon) {
      // sendBeacon posts as text/plain, which readJsonBody parses fine.
      if (navigator.sendBeacon(ENDPOINT, new Blob([body], { type: "application/json" }))) return;
    }
  } catch {
    /* fall through to fetch */
  }
  try {
    fetch(ENDPOINT, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body,
      keepalive: true,
    }).catch(() => {});
  } catch {
    /* reporting is best-effort */
  }
}

/**
 * Report an error to the telemetry sink. Safe to call from anywhere
 * (including ErrorBoundary.componentDidCatch with source "boundary").
 */
export function reportClientError(errorLike, source = "window") {
  try {
    if (typeof window === "undefined") return;
    if (import.meta.env?.DEV) return; // dev consoles already show everything
    if (sessionReports >= MAX_REPORTS_PER_SESSION) return;
    const event = buildErrorEvent(errorLike, source, window.location?.pathname);
    if (!event) return;
    const key = `${event.source}:${event.message}`;
    if (sessionSeen.has(key)) return;
    sessionSeen.add(key);
    sessionReports += 1;
    send(event);
  } catch {
    /* never let the reporter become the bug */
  }
}

/** Install global handlers. Idempotent; call once from main.jsx. */
export function installErrorReporter() {
  if (typeof window === "undefined" || installed) return;
  installed = true;
  window.addEventListener("error", (e) => {
    // Resource-load errors (img/script tags) have no .error and aren't ours.
    if (!e?.error && !e?.message) return;
    reportClientError(e.error || e.message, "window");
  });
  window.addEventListener("unhandledrejection", (e) => {
    reportClientError(e?.reason, "promise");
  });
}
