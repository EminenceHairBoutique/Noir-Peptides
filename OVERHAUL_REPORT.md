# Noir Peptides — Research Portal Overhaul Report

_Branch: `claude/noir-peptides-launch-UwkB3`_

This documents the "Noir Research Portal" overhaul. It builds on the prior
Launch Remediation (Tasks 1–6: indexable catalog, COA system, payment
abstraction + BTCPay webhook, compliance, schema reconciliation — see
`LAUNCH_READINESS.md` + `docs/SCHEMA.md`).

> **Catalog visibility decision (yours):** you chose **keep the public catalog**
> (products + pricing public and indexed). So the new mandate's "hide products"
> lines were intentionally overridden per your instruction; everything else was
> built on top.

---

## Phases delivered

### ✅ Phase A — RUO term renames (compliance)
Retail/dosing-adjacent labels → research-safe wording, no functional change.
- PDP "Dosage" selector → **"Vial Size"** (id/aria updated); "About this research
  compound" → **"Research Material Overview"**.
- ProductCard "Select Dosage" → "Select Vial Size"; Deals + BackInStock copy.
- Files: `src/pages/ProductDetail.jsx`, `src/components/ProductCard.jsx`,
  `src/pages/Deals.jsx`, `src/components/BackInStockForm.jsx`.

### ✅ Phase B — Researcher Console (authed landing)
`/home` now renders a premium **Researcher Console** instead of a generic store.
- Attestation status/receipt module (version, signer, date; re-attest CTA when
  stale), quick actions (catalog, COA verify, test results, calculator, library,
  account), **recent orders**, research articles, AI tools shortcut,
  research-domain chips, support.
- **Bug fixed:** `/verify` was registered twice (email-verify page *and* the COA
  lot lookup) — the COA page was shadowed. COA lookup moved to **`/verify-lot`**;
  QR links + all references updated.
- Files: `src/pages/ResearcherConsole.jsx` (new), `src/lib/orders.js` (new),
  `src/App.jsx`, `src/components/CoaCard.jsx`, `src/pages/TestResults.jsx`.

### ✅ Phase C — Admin Control Room (real, server-enforced)
Replaces the AdminHome placeholder. Admin is enforced **client-side**
(`RequireAdmin`) **and server-side** (`requireAdmin` on every `/api/admin/*`).
- **Overview**: live aggregates (paid revenue, orders, products, COAs
  published/total, reviews pending, partner apps, back-in-stock, AI convos) via
  service-role reads; every count defensive (missing table → null, never 500).
- **COA Manager**: create / list / publish real per-batch COAs (product, lot,
  lab, HPLC, purity, MS, PDF). No fabricated data — admin enters real values.
- **Compliance Scanner**: paste copy → flagged human-use/dosing/therapeutic
  findings (instant, client-side).
- Files: `api/admin/overview.js`, `api/admin/coa.js` (new), `src/lib/adminApi.js`
  (new), `src/lib/complianceScan.js` (new), `src/pages/AdminHome.jsx` (rewritten).

### ✅ Phase E (core) — AI compliance scanner + tests
- `api/ai/compliance-scan.js`: admin endpoint. Deterministic RUO regex baseline
  always runs; `{deep:true}` adds a Claude pass under the RUO guardrail; degrades
  gracefully to regex-only with no `ANTHROPIC_API_KEY`. Scans copy — never
  generates it.
- Admin scanner "Deep scan (AI)" button wired in.
- `scripts/test-compliance-scan.mjs` + `npm run test:compliance` / `test:unit`.

---

## New env vars
None required by this overhaul. Optional: `ANTHROPIC_API_KEY` enables the AI
deep-scan pass (already used by existing `/api/ai/*`).

## New migrations
None in this overhaul (schema from Tasks 1–6: `0013`–`0016`). The COA manager
writes to the existing `coas` table (extended in `0014`).

## Tests run
- `npm run lint` → **0 errors** (3 pre-existing hook-dep warnings).
- `npm run build` → **61 prerendered routes**, 59-URL sitemap, robots. ✔
- `npm run test:unit` → **30/30 pass** (18 AI guardrail refusal + 12 compliance
  scanner).
- `npm run test:e2e` → **not run** (Playwright browser download blocked in
  sandbox; specs unchanged and parse).

---

## Remaining (foundation laid; safe to continue)

### Phase D — Catalog + PDP UX (not yet built)
- `/shop` advanced filters (category, vial size, purity, stock, COA availability,
  featured/new, price range) + compare mode (analytical fields only) + premium
  empty/loading/error states.
- PDP batch-traceability panel + related materials by domain. (COA display,
  renames, "what this is not", and shipping panel already exist from Tasks 1–6 +
  Phase A.)

### Phase E — full AI experiences (compliance scanner done; chat UIs remain)
Foundation exists (`api/ai/_shared.js` guardrail'd handler, `guardrail.js`,
refusal tests). Remaining: dedicated **Concierge**, **COA Interpreter**,
**Literature Summarizer**, **Smart Catalog Search** surfaces + an `ai_flags`
table for refusal/flag review state. The Researcher Console + Admin already link
to the AI area.

### Phase F — security hardening + support flow + e2e (not yet built)
- Security review pass (rate-limit fail-mode for checkout/attestation/AI, input
  validation sweep, error-leakage, CSP re-verify for new endpoints, `SECURITY.md`).
- Contact → structured support-ticket flow (categories, storage in
  `support_tickets`).
- Playwright tests: auth-wall redirects, no catalog leak logged-out (N/A under
  the public-catalog decision — replace with "no pricing on public landing"),
  attestation-before-checkout, admin route blocks non-admin, checkout doesn't
  trust client prices, COA lookup handles missing lots.

---

## Compliance / attorney notes
- All new copy is RUO-safe; no human-use/dosing/therapeutic language added.
- The Compliance Scanner is **advisory** — it does not replace attorney review.
- COA manager stores **only admin-entered real lab data**; nothing is fabricated.
- The `COMPLIANCE_COPY_AUDIT.md` "Performance" tagline flag remains **unmerged**,
  pending your sign-off (attorney-review-recommended for final public copy).
- Age gate threshold (21+) and attestation text should have final attorney sign-off.

## Note on the session
The working branch briefly came up on a stale base (a login-hotfix `main`) that
lacked Tasks 1–6; this was detected and the local branch was reset to
`origin` (`b1db5a9`) with **no work lost** before continuing.
