// tests/audit/open-redirect.test.mjs
// Proves the post-login open-redirect vector is closed.
//
// REACHABILITY (why this is a real finding, not theory): RequireAuth /
// RequireAdmin store `location.pathname` and Login replays it after
// authentication. Visiting `https://noirpeptides.com//evil.example` produces
// the pathname `//evil.example` — protocol-relative — so the stored value walks
// an authenticated user off-site. This is the shape of the React Router
// open-redirect advisories that remain unpatched in the 7.x line (the published
// fix is a v8 major, deliberately not taken pre-launch), so the app guards it.
import { readFileSync } from "node:fs";
import { safeRedirectPath } from "../../src/lib/safeRedirect.js";

let passed = 0, failed = 0;
const check = (n, c) => { if (c) passed++; else { failed++; console.error(`  ✗ ${n}`); } };

// ── Legitimate internal destinations survive ──────────────────────────────
check("plain path preserved", safeRedirectPath("/account") === "/account");
check("nested path preserved", safeRedirectPath("/account/orders") === "/account/orders");
check("query string preserved", safeRedirectPath("/shop?sort=price-asc") === "/shop?sort=price-asc");
check("hash preserved", safeRedirectPath("/faqs#shipping") === "/faqs#shipping");
check("checkout preserved (the common case)", safeRedirectPath("/checkout") === "/checkout");

// ── The actual attack: protocol-relative ──────────────────────────────────
check("//evil.example blocked", safeRedirectPath("//evil.example") === "/home");
check("//evil.example/path blocked", safeRedirectPath("//evil.example/pay") === "/home");
check("///evil blocked", safeRedirectPath("///evil.example") === "/home");

// ── Backslash bypasses (CVE-2025-68470 follow-up) ─────────────────────────
check("/\\evil blocked", safeRedirectPath("/\\evil.example") === "/home");
check("/\\\\evil blocked", safeRedirectPath("/\\\\evil.example") === "/home");
check("backslash anywhere blocked", safeRedirectPath("/account\\@evil.example") === "/home");

// ── Absolute / scheme smuggling ───────────────────────────────────────────
check("https:// blocked", safeRedirectPath("https://evil.example") === "/home");
check("http:// blocked", safeRedirectPath("http://evil.example") === "/home");
check("javascript: blocked", safeRedirectPath("javascript:alert(1)") === "/home");
check("data: blocked", safeRedirectPath("data:text/html,<script>") === "/home");
check("embedded scheme after slash blocked", safeRedirectPath("/https://evil.example") === "/home");

// ── Control-character smuggling ───────────────────────────────────────────
check("newline blocked", safeRedirectPath("/account\nhttps://evil") === "/home");
check("tab blocked", safeRedirectPath("/account\thttps://evil") === "/home");
check("CR blocked", safeRedirectPath("/\r/evil.example") === "/home");

// ── Degenerate input ──────────────────────────────────────────────────────
check("undefined → fallback", safeRedirectPath(undefined) === "/home");
check("null → fallback", safeRedirectPath(null) === "/home");
check("empty → fallback", safeRedirectPath("") === "/home");
check("non-string → fallback", safeRedirectPath({ toString: () => "/evil" }) === "/home");
check("relative (no leading slash) → fallback", safeRedirectPath("account") === "/home");
check("custom fallback honored", safeRedirectPath("//evil", "/shop") === "/shop");

// ── No auth-screen loops ──────────────────────────────────────────────────
check("/login → fallback (no loop)", safeRedirectPath("/login") === "/home");
check("/register → fallback", safeRedirectPath("/register") === "/home");
check("/login?next=x → fallback", safeRedirectPath("/login?next=/shop") === "/home");

// ── Wiring ────────────────────────────────────────────────────────────────
const login = readFileSync(new URL("../../src/pages/Login.jsx", import.meta.url), "utf8");
check("Login uses the guard", login.includes("safeRedirectPath(intended)"));
check("Login no longer replays the raw value",
  !/navigate\(intended\s*&&/.test(login));

if (failed) { console.error(`\nopen-redirect: ${failed} FAILED, ${passed} passed`); process.exit(1); }
console.log(`open-redirect: all ${passed} assertions passed`);
