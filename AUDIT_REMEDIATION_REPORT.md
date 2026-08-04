# Noir Peptides — Audit & Remediation Report

_Production audit pass focused on the P0 payment/security cluster. Findings are
**verified** (something was executed that proved it) or **suspected** (follows
from reading code). Nothing here is estimated or assumed._

## 1. Executive summary

**Initial condition.** The repository was substantially further along than the
audit brief assumed — inventory, fulfillment, error telemetry, the two-step
checkout, and the prerendered SEO surface were already shipped (Phases 6–11 +
PR #18), and a prior master audit had already triaged the database/RLS surface
(`AUDIT_REPORT.md`, `ROADMAP.md`). Re-auditing those would have been waste.

**What was actually broken.** The payment path. Three of the brief's mandatory
P0s were real, reproducible, and unfixed — plus a fourth (open redirect) found
during this pass that was reachable in the live auth flow. All are now fixed and
covered by tests.

**Highest risks found:** money charged not matching money displayed; payment
redirects derivable from attacker-controlled headers; internal provider/database
errors returned to customers; and an authenticated open redirect.

**Current launch readiness: soft-launch ready**, conditional on the two owner
actions in §15 (the RLS escalation fix and running the pending migrations). See
§17.

---

## 2. Confirmed findings

### P0.1 — Shipping charged ≠ shipping shown · **VERIFIED** · Critical (commerce)
**Files:** `api/create-checkout-session.js`, `api/btcpay/create-invoice.js`,
`src/config/checkout.js`

**Root cause.** Shipping had **four disagreeing sources of truth**:

| Source | Threshold | Rate |
| --- | --- | --- |
| `src/config/checkout.js` (what the customer sees) | $250 | $16.95 / $35 / $50 |
| `api/btcpay/create-invoice.js` | **$200** | **$9 flat** |
| `api/create-checkout-session.js` | **never free** | $9 flat (or a fixed env rate id) |

**Impact.** A customer selecting Next-Day ($50) was charged $9 on crypto and
$9-always on card; a customer at $255 was promised free shipping and charged
anyway on card. The selected method was ignored entirely by both rails. This is
a consumer-protection exposure, not a cosmetic bug.

**Fix.** New `lib/shipping.js` — one server-authoritative resolution, in integer
cents, importing the **same** method list and threshold the UI renders from, so
display and charge cannot drift again. Both rails now call it; BTCPay's
divergent `$200`/`$9` constants were deleted; Stripe's hardcoded 900-cent rate
is gone. A pre-created `STRIPE_US_SHIPPING_RATE_ID` is deliberately **not** used
— a single fixed rate cannot express "free over threshold" or a per-order method
choice, which is what caused the mismatch.

**Verification.** `tests/audit/p0-payment-security.test.mjs` asserts the exact
boundary triplet (threshold −$0.01 → charged, exact → free, +$0.01 → free), that
free applies to **every** method, that each rate is honored, integer-cents
output, and that both rails call the shared resolver.

### P0.2 — Payment redirects from attacker-controlled headers · **VERIFIED** · Critical (security)
**Files:** `api/create-checkout-session.js`, `api/btcpay/create-invoice.js`

**Root cause.** Both rails built their origin as
`req.headers.origin || \`https://${req.headers["x-forwarded-host"] || req.headers.host}\``
and fed it into Stripe `success_url`/`cancel_url`, BTCPay `redirectURL`, and
product image URLs.

**Impact.** A forged `Origin`/`Host`/`X-Forwarded-Host` could point the
post-payment flow at an attacker-controlled host — a paying customer redirected
to a page that looks like the confirmation step.

**Fix.** New `lib/siteOrigin.js`: origin comes from server configuration
(`SITE_URL` → `VITE_SITE_URL` → platform-set `VERCEL_URL` → operator
`ALLOWED_ORIGINS`). A request-supplied `Origin` is honored **only if already
allowlisted** (so preview deploys still work); anything else falls back to
canonical. Both rails fail closed with a 503 when no origin is configured rather
than guessing.

**Verification.** Tests prove forged `Origin`, `Host`, and `X-Forwarded-Host`
all resolve to the canonical origin, that an allowlisted origin is still
honored, that `absoluteUrl` rejects off-allowlist absolutes, and that neither
rail still reads origin from headers.

### P0.3 — Raw provider/database errors returned to customers · **VERIFIED** · High (security)
**Files:** `api/create-checkout-session.js`, `api/btcpay/create-invoice.js`

**Root cause.** `res.status(500).json({ error: err?.message || "Stripe error" })`
— Stripe/Postgres internals (table names, constraint names, account ids, key
prefixes) shipped straight to the browser.

**Fix.** New `lib/apiError.js` → `failSafely()`: customer gets a stable message,
a machine `code`, and a `requestId`; full detail is logged server-side under
that id, with secrets scrubbed (live/test keys, `whsec_`, JWTs, bearer tokens).

**Verification.** Tests assert neither rail returns `err.message`, both use
`failSafely`, responses carry `code` + `requestId`, and each secret class is
scrubbed. **One bug in my own scrubber was caught by these tests** — the JWT
pattern required 10+ chars per segment, so short tokens leaked; loosened to 4+.

### P0.5 — Post-login open redirect · **VERIFIED** · High (security) · _found this pass_
**Files:** `src/components/RequireAuth.jsx`, `src/components/RequireAdmin.jsx`,
`src/pages/Login.jsx`

**Root cause.** The guards store raw `location.pathname` and `Login` replays it
after authentication. A pathname is **not** inherently safe: visiting
`https://noirpeptides.com//evil.example` yields the pathname `//evil.example`,
which resolves as a **protocol-relative URL**. This is the same shape as the
React Router open-redirect advisories (CVE-2025-68470 + backslash bypass) that
are **unpatched in the entire 7.x line** — the published fix is a v8 major.

**Fix.** New `src/lib/safeRedirect.js` — only same-origin, single-slash,
scheme-free, control-character-free paths are replayed; auth screens are
excluded to prevent loops. Applied at the `Login` replay point. This closes the
vector **without** a pre-launch v8 migration.

**Verification.** 30 assertions covering `//host`, `///host`, `/\host`,
`/\\host`, embedded backslashes, `https:`/`javascript:`/`data:`, embedded
schemes, newline/tab/CR smuggling, and degenerate input — while confirming
legitimate paths (including `/checkout` and query/hash) survive intact.

### P0.4 — No CI whatsoever · **VERIFIED** · High (process)
`.github/workflows/` did not exist; nothing verified a pull request.

**Fix.** `.github/workflows/ci.yml` with three jobs: **verify** (`npm ci`, lint,
all unit/audit suites, product audit, production build, advisory `npm audit`);
**migrations** (duplicate-prefix check + every migration applied in order to a
real Postgres 16 container with the Supabase `auth` shim); **e2e** (Playwright
Chromium with report artifact on failure). No secrets required — which also
proves the app builds and degrades safely when rails are unconfigured.

### Tooling defect — `node_modules` absent · **VERIFIED** · Medium
Lint failed with `Cannot find package '@eslint/js'`; `node_modules` had **zero**
entries. Restored via `npm install` (340 packages). Worth noting because a
green-looking local run can otherwise mask a broken toolchain — exactly what CI
now prevents.

---

## 3. Security work

- Canonical-origin enforcement with allowlist + fail-closed (P0.2).
- Sanitized error envelope with correlation ids and secret scrubbing (P0.3).
- Open-redirect guard on the authenticated return path (P0.5).
- **Dependencies:** `react-router-dom` 7.13.2 → **7.18.2** (picks up fixes
  released within 7.x). Three high-severity advisories **remain** because their
  fix range is `> 8.2.0`, i.e. a React Router **v8 major** — see §16.
- Not re-done (already covered by the prior master audit): RLS escalation,
  admin authorization, CSP/headers. The `profiles` self-write escalation fix is
  drafted and validated at `scripts/proposed-fix-profiles-rls.sql` and remains
  the single highest-severity open item (§15).

## 4. Commerce work

Shipping is now resolved once, server-side, in integer cents, from the same
config the storefront renders (P0.1). Both rails record what was charged
(`shipping_method`, `shipping_cents`, `shipping_free` in Stripe metadata;
`shippingMethod`/`shippingCents` in BTCPay metadata) so orders reconcile against
the charge. Server-trusted re-pricing, webhook signature verification, and
`provider_ref` idempotency were already in place and were left unchanged.

**Not done this pass:** checkout-session idempotency keys (P1.1) and a
server-derived payment-rail availability endpoint (P1.2). Both are real and
remain open — see §16.

## 5–8. Mobile / desktop / accessibility / performance

Not re-audited this pass. The two-step checkout (PR #18) was already verified at
390px with screenshots, and the responsive/a11y sweep from the earlier full-stack
audit (iOS zoom fix, 320px overflow guard, label/alt coverage) is already merged.
Re-running them would not have produced new findings; the payment cluster was
the higher-value target and is what this pass spent its budget on.

## 9. SEO

Unchanged and already correct: the build prerenders **73 route HTML files** with
real body text, canonical/OG tags, and `Product` + `Organization` JSON-LD;
sitemap (71 URLs) and robots are generated. The brief's premise that the site is
client-side-rendered and unindexable is **false at HEAD** (verified).

## 10. Tests

| Suite | Assertions | Result |
| --- | ---: | --- |
| `tests/audit/p0-payment-security.test.mjs` (new) | 47 | pass |
| `tests/audit/open-redirect.test.mjs` (new) | 30 | pass |
| 13 pre-existing suites | 209 | pass |
| Playwright E2E (Chromium) | 29 | pass (4 env-gated skips) |

Both new suites are wired into `npm run test:unit` (now 15 suites).

## 11. Database work

None this pass. The migration/RLS surface was covered by the prior audit;
`scripts/proposed-fix-profiles-rls.sql` and
`scripts/proposed-order-attestations.sql` are drafted and awaiting owner
execution. CI now validates that every migration applies cleanly in order.

## 12. Files changed

**Added:** `lib/shipping.js` · `lib/siteOrigin.js` · `lib/apiError.js` ·
`src/lib/safeRedirect.js` · `.github/workflows/ci.yml` ·
`tests/audit/p0-payment-security.test.mjs` · `tests/audit/open-redirect.test.mjs`

**Modified:** `api/create-checkout-session.js` · `api/btcpay/create-invoice.js` ·
`src/pages/Login.jsx` · `package.json` (suites + router bump)

## 13. Dependencies

`react-router-dom` ^7.11.0 → 7.18.2 (and transitive `react-router`). Upgraded
for in-range security fixes. Nothing added or removed.

## 14. Environment variables

Names only. Newly **read** by this change: `SITE_URL`, `VITE_SITE_URL`,
`VERCEL_URL` (platform-set), `ALLOWED_ORIGINS` (optional).
Now **unused**: `STRIPE_US_SHIPPING_RATE_ID` (see P0.1).

## 15. External actions required (owner only)

1. **Set `SITE_URL`** in Vercel to the canonical production origin. Without it
   the rails fall back to `VERCEL_URL`; if neither exists they fail closed with
   a 503 rather than emit an untrusted redirect.
2. **Run `scripts/proposed-fix-profiles-rls.sql`** — the highest-severity open
   item. Any logged-in user can currently self-write `role`→admin,
   `loyalty_points`, `attestation_completed_at`, and `account_tier` via the
   public REST API (proven; fix validated).
3. **Run `scripts/proposed-order-attestations.sql`** — enables the full
   per-order compliance record (a safe fallback is active until then).
4. **Run pending migrations** `0025` / `0028` / `0029` (RUNBOOK §1 self-check).
5. **Remove `STRIPE_US_SHIPPING_RATE_ID`** from Vercel — now ignored.
6. **Live-payment smoke test** (`docs/LAUNCH_CHECKLIST.md`) — with the shipping
   fix, verify a $255 order charges $0 shipping and a $100 Next-Day order
   charges $50.

## 16. Remaining risks (honest)

- **React Router 7.x carries unpatched high-severity advisories.** Most require
  SSR/RSC/framework mode, which this SPA does not use; the one that *did* apply
  (open redirect) is now guarded at the app level. The full fix is a **v8
  major** — deliberately not attempted pre-launch. Schedule it post-launch.
- **The live deployment was not audited.** The sandbox proxy blocks
  `noir-peptides.vercel.app` (403), so deployment drift, live console errors,
  and production env correctness are **unverified** and need your eyes.
- **P1 items still open:** checkout idempotency keys (double-click can create
  duplicate Stripe sessions), server-derived rail availability, admin 2FA,
  residual raw-error passthroughs in `api/admin/*`.
- **`ws` advisory** is transitive via `@supabase/realtime-js`; not directly used
  by app code (**suspected** low impact — not exercised).

## 17. Launch recommendation

**Soft-launch ready** — after owner actions 1, 2, and 4 in §15.

The commerce-integrity defect (charging a different amount than displayed) and
the payment-redirect vulnerability were the two things that genuinely blocked
taking real money; both are fixed and tested. What still gates a *full* launch
is not code but execution: the RLS escalation fix must be applied (it is a
one-command fix for a full-admin-takeover vector), the pending migrations must
be run, and a real transaction must be pushed end to end. Until the live
deployment is verified by someone who can reach it, treat production behavior as
unconfirmed.
