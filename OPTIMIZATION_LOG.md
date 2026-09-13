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

---

## Cycle 2 — 2026-09-13

**HEAD before:** `c0c7e73` (main, Merge PR #33). **Branch:** `claude/opt-cycle-2-20260913`.

### RECON

Ran in the order cycle 1 said it would: numeric diff first (H-007), corpus gate
second. Nothing landed on `main` since the cycle-1 merge. Build 78 routes /
sitemap 73 / CSP meta; `test:unit` 40 suites / 790 ✓; `npm audit` 0; corpus
gate green. The committed prompt (`noir-optimization-engine-fable51.md`, version
2026-09-12) still carries the cycle-1-corrected CONTEXT; no new drift.
Live site: still unreachable (egress 403) → live checks stay `?`. **New this
cycle:** `fonts.googleapis.com`/`gstatic` and `registry.npmjs.org` ARE
reachable, which unblocks Hy-002 and an accessibility engine.

**Acting on cycle 1's "what I'd do differently":** corpus scan ran first ✓;
the link-depth gate below is written BEFORE its fix ✓; no anchor-append JSX
edits ✓ (restructure explicitly); numeric diff ran before any full read ✓.

**Findings from RECON (all VERIFIED by a command this cycle):**
- **4.6 — the "every public page ≤2 clicks from any other" claim (Aug 28) is
  false in the prerendered graph.** All-pairs BFS over the 73 indexable pages:
  315 pairs exceed 2 clicks; `/about → /deals` is unreachable; `/about → /` is
  3. Cause: the prerendered footer nav has no Home, no Deals, and no category
  links; `/legal/returns` is an alias with no inbound link at all.
- **4.1 — attestation records carry IP but no user agent.** `api/attestation.js`
  captures `attestation_user_agent` into `profiles` (migration 0003) and
  `attestation_audit.user_agent` exists (0003/0022), but
  `logCheckoutAttestation` in `lib/payments/fulfillment.js` selects only
  version/statements/legal_name/ip and writes no `user_agent`.
- **4.2 — the secret scrubber has no pattern for Anthropic (`sk-ant-…`) or
  Resend (`re_…`) keys**, both of which are configured in this deployment.
- 4.7 — certificate images total 5.4 MB (~300 KB each): evidence documents,
  linked not inlined; report only, never recompress. SW precache 80 entries /
  1,085 KB — no budget test exists.
- 4.5 — `checkoutIdempotencyKey` is covered by `tests/audit/p1-checkout-hardening`.

### SCORE (before this cycle's work)

| # | Scorecard | Score | Evidence |
| --- | --- | --- | --- |
| 4.1 | Legal | 8 | corpus gate green; attestation lacks UA on the order record |
| 4.2 | Security | 7 | envelopes gated; scrubber misses two live key shapes |
| 4.3 | Data integrity | 7 | seed/asset gates green |
| 4.4 | Trust | 7 | unchanged |
| 4.5 | Commerce | 7 | idempotency covered |
| 4.6 | SEO | **5** | link-depth claim false (315 pairs); alias page orphaned |
| 4.7 | Performance | 7 | PDP budget green; Google Fonts hop; no precache budget |
| 4.8 | UI/UX | ? | — |
| 4.9 | Accessibility | ? | engine now installable |
| 4.10 | Mobile | 8 (stale) | to be re-run this cycle |
| 4.11 | Admin | 7 | — |
| 4.12 | Observability | 6 | — |
| 4.13 | Hygiene | 7 | — |

### PLAN (written before execution)

1. **[4.6] Link-depth gate, test first.** `scripts/test-link-depth.mjs`: over
   the built dist, every indexable page reachable from `/`, and every ordered
   pair of indexable pages within 2 clicks. Record the failure. Then fix: the
   prerendered footer nav gains Home, Deals and the visible categories
   (`getVisibleCategories()`, so a soft-launch-hidden category is never linked);
   `/legal/returns` becomes a noindex alias of `/legal/shipping` (generator +
   component), leaving the indexable set. Generator: buyer walk (static).
2. **[4.1] Attestation user agent on every order.** `logCheckoutAttestation`
   selects `attestation_user_agent` and writes `user_agent`. Runtime test with
   a stubbed database. Generator: data honesty sweep.
3. **[4.2] Secret scrubber** gains `sk-ant-…` and `re_…`; tests. Generator:
   inversion ("what would put a key in a log line?").
4. **[4.7] Self-host the three font families** (latin subsets, OFL, ~10 files)
   and drop the Google Fonts links + preconnects. Test: no google-font host in
   dist; every `@font-face` file exists; licence notice present. Screenshots at
   320/1280 before/after. **CSP origins for fonts are left in place** — the
   CSP block in `vercel.json` is ask-before; their removal is proposed, not done.
5. **[4.9] Accessibility sweep** with `@axe-core/playwright` (new
   devDependency — justification: WCAG 2.2 AA is scorecard 4.9, axe is the
   reference engine, dev-only, no runtime impact). `npm run a11y` over 8 routes
   at 390 and 1280; fix violations that are ≤5 lines each; report the rest.
   Findings-first, not yet a CI gate.
6. **[4.10] Re-run the 52-test mobile suite** on the final build for a real score.
7. **[4.7] SW precache budget test** (≤ 1.5 MB).
8. Docs: this log, PLAYBOOK (≥1 heuristic with evidence; generator table;
   Buyer walk rewritten as a static graph walk after 0 yield in cycle 1),
   `LAUNCH_READINESS.md`, escalations, PR draft. Ask before commit/push/PR.

**Cut / deferred:** category copy (Hy-003, owner); legacy `products.js`
(ask-before); font CSP origin removal (ask-before, proposed).

### EXECUTION — results

Gate on the finished tree: `npm run build` 78 routes / sitemap **72** (the
`/legal/returns` alias left the indexable set) / CSP meta on 78; `npm run lint`
0 errors; `npm run test:unit` **45 suites, 835 ✓** (was 40 / 790 → +5 suites,
+45 assertions); **mobile suite 52/52** on the final build; **axe sweep: 0
critical/serious** on 9 routes × 2 widths (was 20 serious). Screenshots at
320/1280 for `/`, PDP, `/test-results` before/after in the scratchpad
(`shots/before-*`, `after2-*`, `final-*`).

| # | Item | Shipped | Status | Test (assertions) |
| --- | --- | --- | --- | --- |
| 1 | Link depth (gate written first) | `test-link-depth.mjs` failed on the old tree exactly as RECON predicted (315 pairs, 2 orphans); prerendered footer nav gains Home, Deals and the 8 **visible** categories; `/legal/returns` → noindex alias (generator + `LegalPageLayout noindex` + `ShippingRefunds alias`); React footer gains Deals | **VERIFIED** — gate green: worst all-pairs distance 2, 0 orphans; 2nd method: leaf page links Home/Deals/8 categories, 75/78 pages link `/deals` | test-link-depth (5) |
| 2 | Attestation user agent on the order record | `logCheckoutAttestation` selects `attestation_user_agent`, writes `user_agent` (column exists since 0003/0022 — no migration) | **VERIFIED** — real function executed against a stubbed DB; 2nd method: the two-line diff | test-attestation-record (10) |
| 3 | Secret scrubber shapes | `sk-ant-…` and `re_…` (≥20 chars — "re_confirmed" must not redact) | **VERIFIED** — synthetic keys redacted, existing shapes intact, no false positives | test-secret-scrubber (14) |
| 4 | Self-hosted fonts | **Reuses the five woff2 files the label engine already tracks** (`public/fonts`, since `4a0a29a`) — my first draft downloaded near-duplicates; deleted (H-009). `src/fonts.css` declares Syne 600–800 and DM Sans 300–600 from the variable files + Plex Mono 400/500/600; Google link + preconnects removed; the two variable files preloaded | **VERIFIED** — Chromium loads 5 faces from our origin; width measurement proves the variable files honour every requested weight (Syne 600/700/800 → 648/701/1017 px; DM Sans 300–600 → 573/581/592/605 px); 0 Google Fonts requests in dist; payload 99 KB | test-fonts-selfhosted (10) |
| 5 | Accessibility sweep + fixes | `npm run a11y` (axe-core, new devDependency — justification: WCAG 2.2 AA is scorecard 4.9, axe is the reference engine, dev-only). Fixed: compliance line `steel/70 → /80` (3.86 → 4.69:1); secondary-text token `bone/45 → /55` (3.97 → 5.49:1, 25 occurrences); `/test-results` verify link underlined; `/shop` cards get an sr-only `<h2>`; footer watermark rendered from a CSS pseudo-element so it is not text content. **CI step added** to the E2E job | **VERIFIED** — re-sweep 0 critical/serious (from 20); mobile 52/52 | a11y sweep (gate: serious/critical) |
| 5b | **Legal — found by the a11y detour:** the footer watermark still read "PRECISION · PURITY · **PERFORMANCE**", the tagline the Aug-26 audit retired everywhere else; invisible to the corpus gate (JSX text, not a scanner term) | Text corrected to "Provenance"; corpus test gains a source-wide guard against the retired tagline | **VERIFIED** — `git grep` → 0 | test-copy-corpus (+1) |
| 6 | Mobile suite re-run | 52/52 on the final build. One real failure on the way: `bottom-nav › footer reachable above the bar` — a font-swap reflow *after* the test's scroll (fonts never loaded in this sandbox before this cycle). Fixed at the root (preload the two variable fonts) and in the measurement (wait for `document.fonts.ready`) | **VERIFIED** | — |
| 7 | SW precache budget | ≤ 1.5 MB, no precached asset > 300 KB, heavy vendors runtime-cached | **VERIFIED** (1,085 KB, 80 entries) | test-sw-budget (5) |

**SUSPECTED (not executed):** anything about the live site (egress still
blocked); Hy-001 (production build passed the T2 assertion) still untested.
**Deferred:** the 407 `region` (moderate) findings — Hy-004, planned for cycle
3 (one `<main>` in the app shell; ~6 page files; own screenshots).

### SCORECARD DELTA

| # | Scorecard | Before | After | Why |
| --- | --- | --- | --- | --- |
| 4.1 | Legal | 8 | **8** | retired "Performance" tagline found and removed; attestation record now carries UA. Not higher: category copy (Hy-003) and the legacy `products.js` still await owner decisions |
| 4.2 | Security | 7 | **8** | scrubber covers every configured key shape; envelopes + admin guard gated (cycle 1). Not higher: `verify:rls` on prod unconfirmed; repo public |
| 4.3 | Data integrity | 7 | 7 | unchanged |
| 4.4 | Trust | 7 | 7 | unchanged (lab data still owner-entered) |
| 4.5 | Commerce | 7 | 7 | unchanged |
| 4.6 | SEO | 5 | **8** | crawl depth now ≤2 for every pair and enforced; alias no longer duplicate content; domain still owner-gated |
| 4.7 | Performance | 7 | **8** | no third-party font hop; fonts preloaded; precache budget enforced. No Lighthouse run (`?` on LCP) |
| 4.8 | UI/UX | ? | ? | screenshots taken, no systematic audit |
| 4.9 | Accessibility | ? | **7** | 0 critical/serious across 18 page-views; 407 moderate landmark findings open (Hy-004); keyboard-only checkout and 200% zoom unchecked |
| 4.10 | Mobile | 8 (stale) | **8** | 52/52 re-run on the final build |
| 4.11 | Admin | 7 | 7 | unchanged |
| 4.12 | Observability | 6 | 6 | unchanged |
| 4.13 | Hygiene | 7 | 7 | +5 suites; a11y in CI; legacy audit step still present (ask-before) |

### GENERATOR YIELDS (cycle 2)

Buyer walk (static) 1 · Data honesty 1 · Inversion 1 · Cost/perf 2 ·
Accessibility sweep (new) 1 (+ the tagline find) · Regulator walk 0 (corpus
green; the tagline was found by the a11y sweep, not the walk — recorded under
the sweep) · Competitor delta 0 · Failure injection 0 · Ops dry run 0.

### ESCALATIONS (owner-only; ranked — #1 leads until cleared)

1. **`npm run verify:rls` on prod** — unconfirmed since `0030`.
2. Attorney: category posture → `soft_launch_hidden`; Hy-003 category descriptions.
3. Apply `0031`–`0034`; decide `0027`. 4. Repo private. 5. Domain + `VITE_SITE_URL`.
6. Enter labs + lookup codes (Control Room screen from cycle 1; needs `0032`).
7. Delete legacy `src/data/products.js` + `scripts/audit-products.mjs` + CI step.
8. `api/stripe-webhook.js` signature-error echo (ask-before).
9. **New:** remove `fonts.googleapis.com` / `fonts.gstatic.com` from the CSP
   (style-src / font-src) now that no font is fetched from them — the CSP
   block in `vercel.json` is ask-before; `scripts/csp.mjs` is the one edit.
10. **New:** Hy-004 landmark fix (engine, cycle 3) — no owner action, listed
    so the moderate a11y backlog is visible.

### What I'd do differently

Grep for an existing instance before fetching anything (H-009) — the fonts
were already in the repo. Wire a new test engine's API from its own error
docs before the first run (`newContext`), not from memory. When a suite that
was green goes red after an unrelated change, ask what *else* changed in the
environment — here it was that web fonts loaded for the first time, which no
test had ever seen. And stop using `pkill -f` with a pattern that appears in
the calling shell's own command line; the `[x]` bracket form is the fix.

### PR DRAFT (open only on approval)

**Title:** Optimization cycle 2 — crawl depth, self-hosted fonts, accessibility, attestation UA

**Summary.** Seven verified items on top of PR #33: (1) the "≤2 clicks from
any page" claim made mechanical and made true (315 pairs over, 2 orphans →
0); (2) attestation records now carry the user agent; (3) scrubber covers
Anthropic and Resend key shapes; (4) fonts self-hosted from the label engine's
existing files with preloads — no third-party font hop; (5) axe sweep in CI,
20 serious findings → 0, plus the retired "Performance" tagline found and
removed from the footer watermark; (6) mobile 52/52 with a root-cause fix for
a font-swap reflow; (7) SW precache budget. +5 suites, +45 assertions.

**Risks.** Secondary-text token brightened (`/45 → /55`, 25 sites) — visual,
screenshotted. `/legal/returns` is now noindex. New devDependency
`@axe-core/playwright` (dev-only). CI gains an a11y step that fails on
serious/critical only.

**Rollback.** Revert the branch; no migrations, no data, no payment/RLS/CSP
files touched.

