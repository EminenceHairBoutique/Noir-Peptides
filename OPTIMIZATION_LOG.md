# OPTIMIZATION LOG — Noir Peptides Optimization Engine

One entry per cycle. The plan is written BEFORE execution; results after.

---

## Cycle 1 — 2026-09-13

**HEAD before:** `b6a13e9` (main, Merge PR #32 "Launch hardening — Sept 11
audit"). **Branch:** `claude/opt-cycle-1-20260913`.

### RECON — corrections to the prompt's CONTEXT (all VERIFIED this cycle)

| CONTEXT claim | Actual | Evidence |
| --- | --- | --- |
| HEAD `430a533` | `b6a13e9` — PR #32 merged 2026-09-11 | `git log -30` |
| §5 items 1–8 to execute | **all eight already on main** (PR #32) | commits `b8a2045`…`ecb49c3` |
| `npm audit`: 15 advisories | **0** | `npm audit --json` → total 0 |
| `test:unit` = 29 suites, ~400 assertions | **34 suites, 701 ✓ lines** | `npm run test:unit` |
| sitemap 74 | **73** (`/calculator` is noindex by default since T6) | build log |
| 44 SKUs across **9** categories | 44 SKUs across **8** categories | `getCategories().length` |
| canonical is `noir-peptides.vercel.app` | emitted canonicals are `https://www.noirpeptides.com` (`PRODUCTION_DEFAULT` fallback while `VITE_SITE_URL` is unset); the *served* host is vercel.app | `resolveSiteUrl()` |
| Only `/login`, `/register`, `/calculator`, `/verify-lot` ship empty roots | `/calculator` now ships the 404 body (flag off); allowlist is the other three | `PRERENDER_EMPTY_ALLOWLIST` |

Build green (78 routes), suite green, audit 0. Live site: **unreachable** from
this sandbox (egress 403 on both hosts) — every "live" check below is `?`.
`PLAYBOOK.md` / `OPTIMIZATION_LOG.md` absent → created this cycle.

### SCORE (before this cycle's work) — evidence in §4 terms

| # | Scorecard | Score | Evidence pointer |
| --- | --- | --- | --- |
| 4.1 | Legal survivability | 6 | scanner never run on the corpus; consumable naming in 4 tree locations; "proposed mechanisms" in literature-summarizer instructions; flags/legal pages OK |
| 4.2 | Security | 6 | audit 0; CSP tight; all 12 `api/admin/*` call `requireAdmin`; **public `api/contact.js` sends raw `err.message`**; `verify:rls` on prod unconfirmed; repo public |
| 4.3 | Data integrity | 6 | 19/19 COA assets present, all `.jpg`; no seed↔catalog diff test; `db:verify` needs creds (`?`); 0/19 COAs lab-linked |
| 4.4 | Trust surface | 7 | T3 honesty rules shipped; lab verify link renders when key present — but no key can be entered without SQL |
| 4.5 | Commerce & checkout | 7 | server pricing/shipping proven (Aug); nudge shipped; no live rail (`?` on BTCPay smoke) |
| 4.6 | SEO | 7 | coverage + JSON-LD gates green; domain not attached (owner) |
| 4.7 | Performance | 6 | PDP does **not** preload vendor-three/pdf/jsQR (VERIFIED); Google Fonts third-party hop; no Lighthouse (`?`) |
| 4.8 | UI/UX | ? | no screenshots possible without a browser run this cycle; visual system unaudited |
| 4.9 | Accessibility | ? | unchecked this cycle |
| 4.10 | Mobile | 8 | 52/52 mobile suite green on Aug 28; not re-run this cycle |
| 4.11 | Admin & ops | 5 | COA manager creates rows but cannot edit lab linkage/lookup code; no labs screen; SDS + category toggles exist |
| 4.12 | Observability | 6 | client + server error ledger exist; uptime target undefined; backup dry run not done (owner) |
| 4.13 | Engineering hygiene | 7 | lint 0 errors; CI order correct; **CI "Product data audit" audits a legacy 13-product file (`src/data/products.js`) against a `wigs` image dir** |
| 4.14 | Growth | — | gated behind 4.1–4.5 ≥ 8 |

### PLAN (written before execution; ranked by impact × confidence / effort, legal first)

1. **[4.1] Consumable-naming scrub.** Remove "bacteriostatic water / syringes /
   alcohol prep pads" from `src/lib/catalog.js`, the 0033 migration header
   (comment only — SQL unchanged), `docs/SCHEMA.md`, and the 0019 header.
   Test: tree-wide grep gate. Generator: regulator walk.
2. **[4.1] AI instruction + article wording.** `literature-summarizer`: drop
   "proposed mechanisms" from the instructions and the prompt builder (the
   phrasing FDA quoted). Research article: "treat findings as" → "regard
   findings as". Test: `test-copy-corpus.mjs` — scanner over catalog,
   research (published + drafts), FAQs, page copy, all AI instructions, email
   templates; exact allowlist of accepted negations; any new finding fails; no
   AI instruction may contain "mechanism".
3. **[4.2] Sanitized envelopes.** `api/contact.js` (public) and
   `api/partners/directory-settings.js` → `failSafely`; `api/ai/compliance-scan.js`
   stops returning `err.message`. Test: `test-error-envelopes.mjs` — static
   scan of `api/**` for raw `.message` reaching a response (documented
   exception: `api/stripe-webhook.js`, ask-before file) + every `api/admin/*`
   calls `requireAdmin` + runtime proof on `contact.js`.
4. **[4.11/4.4] Lab linkage from the Control Room (H-003).** New
   `api/admin/labs.js` (GET/POST; template must be https and contain
   `{code}`); `api/admin/coa.js` accepts `lab_id`, `lab_lookup_code`,
   `purity_operator` with validation and pre-0032 column fallback; per-row
   editor in the COA manager + a small "Labs" form. Test: runtime handler
   tests against a stubbed `supabaseServer` + static UI wiring. Generators:
   ops dry run, competitor delta.
5. **[4.3] Data-integrity gates.** `test-seed-sync.mjs` (regenerating 0009
   from `tier1Catalog` is byte-identical to the committed seed);
   `test-coa-assets.mjs` (every 0019 `file_url` exists; `.jpg` → "Certificate
   image", never "PDF"). Generator: data honesty sweep.
6. **[4.7] PDP preload guard.** `test-pdp-preload.mjs`: no PDP preloads
   `vendor-three`/`vendor-pdf`/`jsQR`. Fonts hop recorded as Hy-002.
7. Docs: this log, PLAYBOOK, `LAUNCH_READINESS.md` section, escalations, PR
   draft (not opened).

**Cut / deferred (why):** self-hosting fonts (egress blocked); Lighthouse
(no browser budget this cycle); catalog copy dry-ification (desyncs static
from DB — owner + attorney, Hy-003); deleting `src/data/products.js` +
`scripts/audit-products.mjs` + the CI step (a file another file imports —
ask-before).

**Owner asks raised (not executed):** commit/push/PR; delete the legacy
products file + audit script + CI step; category copy posture.

### EXECUTION — results

Gate on the finished tree: `npm run build` 78 routes / sitemap 73 / CSP meta
on 78 pages; `npm run lint` 0 errors (3 pre-existing warnings);
`npm run test:unit` **40 suites, 790 ✓** (was 34 / 701 → **+6 suites, +89
assertions**). Working tree left clean by every test (the seed-sync test
restores `0009` after regenerating it).

| # | Item | Shipped | Status | Test (assertions) |
| --- | --- | --- | --- | --- |
| 1 | Consumable-naming scrub | `src/lib/catalog.js`, `0033` + `0019` headers (comments only; SQL unchanged), `docs/SCHEMA.md` | **VERIFIED** — `git grep` over every tracked file: 0 hits | corpus gate asserts it (in #2) |
| 2 | AI wording + article + corpus gate | `literature-summarizer` no longer asks for "proposed mechanisms" (instructions + prompt builder); article "treat findings" → "regard findings"; `scripts/test-copy-corpus.mjs` | **VERIFIED** — 157 corpus entries scanned; only the 10 documented negations + the detector instructions flag; no AI endpoint contains "mechanism" | test-copy-corpus (19) |
| 3 | Sanitized envelopes | `api/contact.js` (**public**), `api/partners/directory-settings.js`, `api/ai/compliance-scan.js`, and a 4th the gate found — `api/admin/partner-applications.js` — all via `failSafely`; `scripts/test-error-envelopes.mjs` | **VERIFIED** — static scan of `api/**` clean (1 documented exception); runtime: `/api/contact` with no transport → 5xx **envelope**, no provider text | test-error-envelopes (21) |
| 4 | Lab linkage from the Control Room | new `api/admin/labs.js` (GET/POST/PATCH; template must be https + `{code}`); `api/admin/coa.js` accepts `lab_id` / `lab_lookup_code` / `purity_operator` with validation, clear-on-null, pre-0032 GET fallback; Control Room: per-certificate lab editor, create-form fields, labs form — all hidden until 0032 is applied | **VERIFIED** — real handlers executed against a stubbed DB: whitelist holds (stray `role`/`is_admin` never reach a row), unicode ≥ normalised, clears work, pre-migration degrades to `labFieldsSupported:false` / `migrationPending:true` | test-admin-labs (38) |
| 5 | Data-integrity gates | `scripts/test-seed-sync.mjs`, `scripts/test-coa-assets.mjs` | **VERIFIED** — regenerated `0009` is byte-identical to the committed seed; 19/19 certificate files exist, all `.jpg` → "Certificate image", 0 orphans | test-seed-sync (4), test-coa-assets (5) |
| 6 | PDP preload guard | `scripts/test-pdp-preload.mjs` | **VERIFIED** — 44/44 product pages preload only react/router/icons/motion; none pulls vendor-three / vendor-pdf / jsQR | test-pdp-preload (2) |
| 7 | Docs | this log, `PLAYBOOK.md`, `LAUNCH_READINESS.md` section | — | — |

**Second-method verification of the top three claims (§7):**
- Consumable naming gone: grep-after-edit **and** `git grep` over the whole index (all file types) — both 0.
- `/api/contact` no longer leaks: static scan **and** executed handler (5xx carries `{error, code, requestId}`, no transport text).
- COA whitelist: executed handler with hostile keys **and** a read of every `out.<key> =` site in `pickCoaFields` (9 keys, all known).

**SUSPECTED (not executed):** that the Vercel production build passed the T2
data-presence assertion (Hy-001); that `verify:rls` is clean on prod; anything
about the live site's rendered output (egress blocked).

### SCORECARD DELTA

| # | Scorecard | Before | After | Why |
| --- | --- | --- | --- | --- |
| 4.1 | Legal survivability | 6 | **8** | corpus scanner now a build gate over catalog/research/FAQ/page copy/AI instructions/email; consumable naming and mechanism framing gone. Not higher: category copy (Hy-003) and the legacy `products.js` await owner decisions; live/DB copy fields unscanned |
| 4.2 | Security | 6 | **7** | four raw-error leaks closed (one public); envelope + admin-guard gates. Not higher: `verify:rls` on prod unconfirmed; repo public; `stripe-webhook` echo (ask-before) |
| 4.3 | Data integrity | 6 | **7** | seed↔catalog drift now tested; certificate assets tested. Not higher: `db:verify` needs creds; 0/19 lab-linked (now possible without SQL); `0027` |
| 4.4 | Trust surface | 7 | 7 | rendered output unchanged this cycle; the verify-at-lab link becomes *enterable* — it lights up when the owner enters the lab + codes |
| 4.5 | Commerce | 7 | 7 | untouched |
| 4.6 | SEO | 7 | 7 | untouched; domain still owner-gated |
| 4.7 | Performance | 6 | **7** | PDP first-paint budget now enforced; Google Fonts hop remains (Hy-002) |
| 4.8 | UI/UX | ? | ? | no browser run this cycle |
| 4.9 | Accessibility | ? | ? | unchecked |
| 4.10 | Mobile | 8 | 8 | not re-run |
| 4.11 | Admin & ops | 5 | **7** | lab linkage + labs screen (the oldest open escalation item now has a screen). Not higher: no COA file upload, no feature-flag screen |
| 4.12 | Observability | 6 | 6 | untouched |
| 4.13 | Engineering hygiene | 7 | 7 | +6 suites; CI "Product data audit" still audits the legacy file (ask-before) |

### GENERATOR YIELDS (cycle 1)

Regulator walk 2 · Data honesty sweep 2 · Competitor delta 1 · Failure
injection 1 · Cost/perf 1 · Ops dry run 1 · Inversion 0 (converged with
failure injection) · Buyer walk 0 (needs egress or supplied screenshots).

### ESCALATIONS RAISED (owner-only; ranked)

1. **`npm run verify:rls` on prod** — still unconfirmed since `0030`; leads every report until cleared (§2.1).
2. Attorney decision on Metabolic & Incretin, SS-31, tesamorelin, blends → `soft_launch_hidden` flip (Control Room → Catalog); and Hy-003 (category descriptions containing "signaling"/"pathway").
3. Apply `0031`–`0034` (+ decide `0027`) — `docs/MIGRATIONS_0032_0033.md`, `docs/MIGRATIONS_0034.md`.
4. Make the repo private.
5. Attach `www.noirpeptides.com`; set `VITE_SITE_URL`; redeploy.
6. **Enter the laboratory + lookup codes — now a screen** (Control Room → COAs → "Add a testing laboratory", then the per-certificate lab editor). Needs `0032` applied first.
7. Delete the legacy `src/data/products.js` + `scripts/audit-products.mjs` + the CI "Product data audit" step (13-product template leftover auditing a `wigs` image dir; contains mechanism-heavy copy in a public repo). Recommend: delete all three.
8. `api/stripe-webhook.js` echoes Stripe's signature error text on 400 (ask-before file). Recommend: generic "invalid signature".
9. Analytics posture (GA4-only or none); CSP is already conditional.
10. BTCPay stand-up + live smoke; backup/restore dry run; GLP-1 pricing decision.
11. Fonts self-host (Hy-002) — needs egress or owner-supplied woff2 files.

### What I'd do differently

Run the corpus scan as the *first* RECON step next time — it shaped the plan
more than any document did. Write the gate before the fix: I fixed three
error leaks by hand and the gate I wrote afterwards immediately found a
fourth; the order should have been reversed (H-005 applies to my own work).
Don't patch JSX by anchor-append — the create-form edit briefly left an empty
`hidden` wrapper that a test then had to police; restructure explicitly. And
budget RECON assuming the CONTEXT block is stale (H-007): the numeric diff
should run before anything is read in full.

### PR DRAFT (open only on approval)

**Title:** Optimization cycle 1 — copy gate, sanitized envelopes, lab linkage, data-integrity gates

**Summary.** Six verified items, one commit each, on top of PR #32: (1) injection-consumable
naming removed from code comments/docs; (2) literature-summarizer no longer asks for
"proposed mechanisms", one article word fixed, and the compliance scanner is now a build gate
over the whole public copy corpus with an explicit negation allowlist; (3) four raw error
passthroughs — including the public `/api/contact` — replaced with the sanitized envelope, plus a
gate that every `api/admin/*` calls `requireAdmin`; (4) laboratories and per-certificate lab
lookup codes can now be entered in the Control Room (validated https+`{code}` templates,
whitelisted fields, pre-0032 degradation); (5) seed↔catalog byte-identity and certificate-asset
gates; (6) PDP first-paint preload guard. +6 suites, +89 assertions; lint 0; build 78 routes.

**Risks.** Admin COA GET now selects three 0032 columns — falls back to the base list when they
are missing (tested). `literature-summarizer` behaviour changes only when `FEATURE_AI_PUBLIC` is on
(default off). Migration files changed in comments only. No pricing, variants, category
visibility, payment rails, RLS, or CSP block touched.

**Rollback.** Revert the branch; every change is additive or a comment. No migration semantics changed.

**HEAD after (code):** `d2ee963` — plus this docs commit on top.

