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


---

## Cycle 3 — 2026-09-13

**HEAD before:** `6c51b24` (main, Merge PR #34). **Branch:** `claude/opt-cycle-3-20260913`.

### RECON

Order as in cycles 1–2: numeric diff first (H-007), corpus gate second. Nothing
landed on `main` since the cycle-2 merge (PR #34 merged 05:26 UTC by the
owner). Build 78 routes / sitemap 72 / meta CSP; `test:unit` 45 suites / 835 ✓;
lint 0 errors (3 warnings + one ESLint-10 deprecation in `public/sw.js`);
`npm audit` 0. Live site still unreachable from the sandbox (egress 403 on
`noirpeptides.com` and `*.vercel.app`) → live checks stay `?`.

**Acting on cycle 2's "what I'd do differently":** grepped before adding
anything (no new assets this cycle); the a11y engine was driven from its own
API this time (`newContext` per width, no retries); the throttled-perf script
was run from the repo root after its first run failed on module resolution
from the scratch directory (same class of lesson — run tools from where their
dependencies resolve); no `pkill -f` used.

**Findings (VERIFIED by a command this cycle unless marked):**
- **4.1 — no gate scans what the buyer actually sees.** The corpus gate covers
  data files, AI instructions and the email template; the retired tagline in
  cycle 2 lived in JSX and was invisible to it. Running the scanner over the
  visible text + meta descriptions of all 78 prerendered pages: 71 findings on
  20 pages, every one a negation/legal-disclaimer context on inspection
  (`/coa-policy` "does not establish that the product is sterile / injectable",
  `/legal/terms` prohibited-use list, FAQ negations). No positive claim found —
  but nothing enforces that on the next copy change.
- **4.9 — Hy-004 confirmed:** 407 `region` nodes (moderate) across 14 of 18
  page-views. `/shop` alone is 185 (no `<main>` at all); `/faqs` 7; the other
  pages 2–3 — the cookie banner's two paragraphs (outside every landmark) and
  the `LegalPageLayout` root. Five pages carry their own `<main>`; the shell
  has none. No skip link exists (WCAG 2.4.1).
- **4.11 — the order detail cannot show the attestation that authorized the
  order.** `api/admin/orders.js` selects fulfilment columns only;
  `attestation_audit` rows are stamped with `order_id` + `context: "checkout"`
  since migration 0015 (and carry IP + UA since cycle 2), but the Control Room
  never reads them. The ops dry run "find the attestation record without SQL"
  fails at that step. Refund/cancel: status select exists; no rail-side refund
  (no live rail) — honest as-is.
- **4.7 — throttled mobile LCP (Slow-4G-class, 4× CPU, uncompressed local
  serve):** `/` 5.0 s, `/shop` 4.4 s, `/product/bpc-157` 2.9 s, `/test-results`
  4.4 s; FCP 2.5–2.9 s; CLS 0 on all four. The waterfall shows the cause: the
  route chunk (`PublicLanding-*.js`, `Shop-*.js`, …) plus its shared chunks
  (`SEO-*.js`, `pageCopy-*.js`) are requested only after the main bundle
  executes (t≈3.5 s) — a serialized hop the prerendered HTML could announce
  with `modulepreload`. Local numbers over-penalize: `serve-dist.mjs` sends no
  compression (CSS 82 KB on the wire vs 14.7 KB gzipped); Vercel compresses.
  The hop, not the bytes, is the finding.
- **4.13 — `.env.example` is incomplete:** 13 names read by runtime or script
  code are undocumented (`ALLOWED_ORIGINS`, `PAYMENTS_STRIPE_LIVE_ACK`,
  `FEATURE_AI_PUBLIC` is only in a comment, `RLS_PROBE_EMAIL/PASSWORD`,
  `E2E_API_URL`, server-side `SUPABASE_URL`/`SUPABASE_ANON_KEY`, plus platform
  names). No gate.
- Failure injection (SW update path): `public/sw.js` does `skipWaiting` +
  `clients.claim` and serves navigations network-first → a deploy while a
  worker is active cannot pin an old shell. 0 yield; second cycle at 0.
- Competitor delta: the three items on the Sept bar (clickable lab key, batch
  depth, blends line) are owner-data or owner-posture; 0 yield; second cycle
  at 0 → both generators rewritten in the PLAYBOOK this cycle.
- Data honesty: no numeric claim is rendered in the static bodies of `/`,
  `/test-results`, `/about`, `/coa-policy` (counters are DB-driven at runtime).
- JSON-LD types in tree: Organization, WebSite, WebPage, CollectionPage,
  Product, Offer, AggregateOffer, Brand, BreadcrumbList, Article, FAQPage.
  No Review / AggregateRating / Drug / MedicalEntity.

### SCORE (before this cycle's work)

| # | Scorecard | Score | Evidence |
| --- | --- | --- | --- |
| 4.1 | Legal | 8 | corpus gate green; rendered output unscanned |
| 4.2 | Security | 8 | unchanged; `verify:rls` on prod unconfirmed; repo public |
| 4.3 | Data integrity | 7 | unchanged |
| 4.4 | Trust | 7 | unchanged |
| 4.5 | Commerce | 7 | unchanged |
| 4.6 | SEO | 8 | link-depth gate green |
| 4.7 | Performance | 7 | LCP 2.9–5.0 s throttled (local, uncompressed); route-chunk hop |
| 4.8 | UI/UX | ? | — |
| 4.9 | Accessibility | 7 | 0 serious; 407 moderate landmark nodes; no skip link |
| 4.10 | Mobile | 8 | 52/52 at cycle-2 end |
| 4.11 | Admin | 6 | attestation record not reachable from the order screen |
| 4.12 | Observability | 6 | unchanged |
| 4.13 | Hygiene | 7 | env example incomplete; ESLint-10 deprecation |

### PLAN (written before execution; ranked impact × confidence / effort, legal first)

1. **[4.1] Rendered-output compliance gate.** `scripts/test-dist-copy.mjs`:
   scan every `dist/**/index.html` — visible text, meta/OG descriptions, JSON-LD
   text, `alt`/`aria-label`/`title` attributes — with an exact allowlist of
   accepted findings per page (H-006: negations only, negation window checked).
   Any new finding fails; any vanished accepted finding is reported. Generator:
   regulator walk.
2. **[4.9] Hy-004 + skip link.** One `<main id="main">` in the app shell for
   non-bare routes; the five page-level `<main>`s become `<div>`; cookie banner
   gets a named region; "Skip to content" link first in the tab order. The a11y
   sweep gains a landmark budget (`region`, `landmark-one-main`, `page-has-
   heading-one` must be 0) and a keyboard check (first Tab lands on the skip
   link; activating it moves focus into `#main`). Prerender coverage unchanged
   (static bodies keep their `<main>`). Screenshots 320/1280. Generator:
   accessibility sweep.
3. **[4.11] Attestation record on the order detail.** `api/admin/orders.js`
   detail GET also returns the checkout-context `attestation_audit` row for
   the order (version, legal name, statements, IP, UA, timestamp) or `null`;
   `OrderDetail` renders it or says "No attestation record on file" — never a
   placeholder. `scripts/test-admin-orders.mjs` executes the real handler
   against the admin stub. Generator: ops dry run.
4. **[4.7] Route-chunk modulepreload + measurable perf script.** Vite
   `build.manifest` on; the prerender generator injects `modulepreload` for the
   route's page chunk and its static imports (never `vendor-three`/`vendor-pdf`
   /`jsQR` — the PDP guard stays); `serve-dist.mjs` gzips text so local
   numbers resemble Vercel; `scripts/perf-profile.mjs` (`npm run perf`) prints
   TTFB/FCP/LCP/CLS/bytes per route on throttled mobile, before/after recorded
   here. Test: every mapped route's HTML preloads a chunk that exists in dist.
   Generator: cost/perf profile.
5. **[4.13] `.env.example` completeness gate** + the missing entries (secret-
   free, commented), with a secret-shape check on every value. Generator:
   inversion ("what makes a deploy fail silently? an env var nobody wrote
   down").
6. **[4.13] ESLint 10 forward-compat:** `public/sw.js` loses its `eslint-env`
   comment; the flat config gains a service-worker block. Tiny.

Not this cycle: keyboard-only checkout (needs an authenticated E2E session —
no auth fixture exists; noted as a cycle-4 candidate with the fixture as the
first step); 200 % zoom (WCAG 1.4.10 reflow is 320 CSS px, which the mobile
guard already enforces on 5 routes — recorded, not duplicated).

### EXECUTION — results

| # | Item | Status | Evidence |
| --- | --- | --- | --- |
| 1 | Rendered-output compliance gate | **VERIFIED** | `scripts/test-dist-copy.mjs` (6 assertions): 78 pages; 11 pages carry 87 accepted findings, all negations within a list-scale window (widened to 480 chars for the two list-form disclaimers on `/coa-policy` and `/legal/shipping`); 56 product/category/article pages have zero findings; the retired tagline is absent. Three findings on `/` come from the FAQPage JSON-LD that no corpus entry covers (H-010). Second method: the scanner's own findings printed with context and read by hand for `/`, `/coa-policy`, `/legal/shipping` |
| 2 | One main landmark + skip link | **VERIFIED** | axe sweep on the final build: `region` 407 → **0**, every landmark rule 0, 0 critical/serious across 18 page-views; keyboard check green on 3 routes (first Tab → "Skip to content"; Enter → focus inside `#main`); `document.querySelectorAll("main").length === 1` at 320 and 1280; prerender coverage green (static bodies keep their `<main>`). Correction: the landing and auth layouts had to be demoted too — the first sweep after the change reported `landmark-no-duplicate-main` on `/` and `/login`. Screenshots: `skip-link-focused-{320,1280}.png`, `after-skip-*.png`, `test-results-*.png` (scratch) |
| 3 | Attestation record on the order detail | **VERIFIED** | `scripts/test-admin-orders.mjs` (24 assertions) executes the real handler against the stub: checkout-context row returned with version / legal name / 2 statements / IP / UA / timestamp; registration row never chosen; no record → `attestation: null`; missing table → null; list unchanged; `user_id` not echoed; Control Room wiring + explicit empty sentence asserted. Second method: handler read end-to-end after the change |
| 4 | Route-chunk modulepreload + perf script | **VERIFIED, with a scope cut** | `scripts/test-route-preload.mjs` (37 assertions) on the final dist: 75 pages preload their page chunk (Shop ×9, ProductDetail ×44, …), every href resolves, no 3D/PDF/QR vendor anywhere, manifest not deployed, `/` excluded. **Measurement (throttled mobile, gzip server, back-to-back runs, LCP ms):** `/shop` base 2520 / 2540 → 2376 / 2368 (variant test: 2548 / 2564 / 2536 → 2136–2224, **−350 to −400**); `/test-results` 2508 / 2520 → 2276 / 2328 (**−200**); PDP and `/faqs`: LCP = FCP (the prerendered text is the largest paint) → **no effect**, the earlier 1296 → 1028 reading was FCP bimodality, not a gain; **`/` regressed** with its chunk preloaded: 2020 → 2900–2930 in 5 of 6 runs (third LCP candidate — the hero paragraph re-rendered by React — lands ~900 ms later; placement after the stylesheet and `fetchpriority="low"` did not change it; the service worker was ruled out by blocking it). Cut: `/` is not mapped; final profile `/` 2128, `/shop` 2312, PDP 1020, `/test-results` 2272, `/faqs` 1208 — all five under 2.5 s. Mechanism SUSPECTED: the route fade-in (`Page` in `src/App.jsx`) competing with initial script execution when the chunk is already resident → Hy-007 |
| 5 | `.env.example` completeness gate | **VERIFIED** | `scripts/test-env-example.mjs` (4 assertions): 34 names read across api/lib/src/scripts; 7 undocumented names added (`ALLOWED_ORIGINS`, `PAYMENTS_STRIPE_LIVE_ACK`, `SUPABASE_URL`, `SUPABASE_ANON_KEY`, `RLS_PROBE_EMAIL`, `RLS_PROBE_PASSWORD`, `E2E_API_URL`), 1 dead name removed (`STRIPE_US_SHIPPING_RATE_ID`; `LAUNCH_CHECKLIST.md` corrected — shipping is server-side from `src/config/checkout.js`); no credential shape in any value. Second method: the first run of the gate failed on exactly those names before the file was edited |
| 6 | ESLint 10 forward-compat | **VERIFIED** | `npm run lint`: the `ESLintEnvWarning` for `public/sw.js` is gone (0 occurrences), 0 errors, the 3 pre-existing `react-hooks` warnings unchanged |

**Final gate on the finished tree:** build 78 routes / sitemap 72 / meta CSP ·
lint 0 errors · **49 suites, 902 assertions** (+4 / +67) · axe 0 critical /
0 serious / 0 landmark / 0 keyboard on 9 routes × 2 widths · perf worst LCP
2312 ms (throttled mobile, gzip) · **E2E 29 passed / 4 skipped** (the four
`E2E_API_URL` server-gate specs) · **mobile 52/52** — both on the final build
with `PLAYWRIGHT_CHROMIUM_PATH` set to the pre-installed Chromium (the
sandbox's Playwright wants headless-shell 1208, which is not installed; the
first run failed 27 + 52 on that alone — harness, not code).

**Cut / not attempted:** keyboard-only checkout (no auth fixture → Hy-006);
200 % zoom (covered by the 320 px reflow guard; recorded); the PDP static
import closure (20 chunks incl. label-studio/admin code → Hy-005, cycle 4).

### SCORECARD DELTA

| # | Scorecard | Before | After | Why |
| --- | --- | --- | --- | --- |
| 4.1 | Legal | 8 | **9** | rendered output gated per page (text, meta, JSON-LD, attributes); catalog + article pages must be finding-free. Not 10: Hy-003 category copy and the legacy `products.js` still await owner decisions |
| 4.2 | Security | 8 | 8 | unchanged (`verify:rls` on prod unconfirmed; repo public) |
| 4.3 | Data integrity | 7 | 7 | unchanged |
| 4.4 | Trust | 7 | 7 | unchanged (lab data owner-entered) |
| 4.5 | Commerce | 7 | 7 | unchanged |
| 4.6 | SEO | 8 | 8 | unchanged (domain owner-gated) |
| 4.7 | Performance | 7 | **8** | route-chunk hop removed on every route but `/` (measured); LCP under 2.5 s on all five profiled routes in the throttled harness; the profile is now a command. Not higher: `/` regression understood only as a hypothesis; no field data |
| 4.8 | UI/UX | ? | ? | screenshots only |
| 4.9 | Accessibility | 7 | **8** | one main landmark, skip link, landmark budget + keyboard check in CI. Not higher: keyboard-only checkout unasserted (Hy-006) |
| 4.10 | Mobile | 8 | 8 | re-run on the final build (line below) |
| 4.11 | Admin | 6 | **7** | attestation record on the order screen. Not higher: no rail-side refund (no live rail), tracking is a pasted link |
| 4.12 | Observability | 6 | 6 | unchanged |
| 4.13 | Hygiene | 7 | **8** | env example gated; ESLint 10 ready; +4 suites |

### GENERATOR YIELDS (cycle 3)

Regulator walk 1 · Accessibility sweep 1 · Ops dry run 1 · Cost/perf 1 ·
Inversion 1 · Data honesty 0 (checked: no numeric claim in any static body) ·
Failure injection 0 (SW update path sound) → rewritten · Competitor delta 0 →
rewritten · Buyer walk not run.

### ESCALATIONS (owner-only; ranked — #1 leads until cleared)

1. **`npm run verify:rls` on prod** — unconfirmed since `0030`.
2. Attorney: category posture → `soft_launch_hidden`; Hy-003 category descriptions.
3. Apply `0031`–`0034`; decide `0027`. 4. Repo private. 5. Domain + `VITE_SITE_URL`.
6. Enter labs + lookup codes (Control Room; needs `0032`).
7. Delete legacy `src/data/products.js` + `scripts/audit-products.mjs` + CI step.
8. `api/stripe-webhook.js` signature-error echo (ask-before).
9. Remove `fonts.googleapis.com` / `fonts.gstatic.com` from the CSP (ask-before block).
10. **New (no owner action, listed for visibility):** the `/` route fade-in vs
    LCP question (Hy-007) and the PDP import closure (Hy-005) are engine work
    for cycle 4.

### What I'd do differently

Measure with the production transport from the first minute — the RECON perf
numbers were about the uncompressed test server, and an hour went into a
"5-second LCP" that was 2.2 s with gzip (H-011). Run experiment scripts from
the repo root the first time, not the scratch directory (two module-resolution
failures this cycle, same cause as cycle 2's `pkill` lesson: the harness, not
the code). Before claiming a perf gain, run the pair back to back at least
twice and look at the LCP *candidate sequence*, not the last number — the PDP
"gain" was FCP bimodality and the `/` regression only showed up as a third
candidate. And when a change lands in a shared shell, sweep the routes the
shell does NOT wrap too (the duplicate-main finding on `/` and `/login`).

### PR DRAFT (open only on approval)

**Title:** Optimization cycle 3 — rendered-copy gate, one main landmark + skip link, attestation on the order screen, route-chunk preload

**Summary.** Six verified items on top of PR #34: (1) the compliance scanner
now runs over what the buyer sees — every prerendered page's text, meta,
JSON-LD and alt/aria text — with an exact per-page allowlist; (2) one `<main>`
per document, a "Skip to content" link, and the CI a11y sweep now fails on any
landmark finding or a broken skip link (407 → 0); (3) the Control Room's order
detail shows the research-use attestation that authorized the order, or says
none is on file; (4) every prerendered page except `/` announces its route
chunk with `modulepreload` (measured −200 to −400 ms LCP on `/shop` and
`/test-results`; `/` excluded after a measured regression), plus `npm run perf`
and gzip on the test server; (5) `.env.example` complete and gated; (6) ESLint
10 forward-compat. +4 suites, +67 assertions.

**Risks.** Seven page/layout `<main>` elements became `<div>` (screenshotted
at 320/1280; static prerendered bodies unchanged). `serve-dist.mjs` now gzips
(affects only local/CI serving). `build.manifest` is on; the manifest is
deleted after the prerender step. No migrations, no data, no payment / RLS /
CSP files touched.

**Rollback.** Revert the branch.

---

## Cycle 4 — 2026-09-13

**HEAD before:** `5b5553a` (main, Merge PR #35). **Branch:** `claude/opt-cycle-4-20260913`.

### RECON

Numeric diff first (H-007): nothing landed on `main` since the cycle-3 merge
(PR #35 merged 06:39 UTC by the owner). Build 78 routes / sitemap 72 / 75
pages with route preloads; `test:unit` 49 suites / 902 ✓; lint 0 errors (the
same 3 `react-hooks` warnings); `npm audit` 0; latest migration `0034`. Live
site still unreachable from the sandbox → live checks stay `?`.

**Acting on cycle 3's "what I'd do differently":** every measurement this
cycle goes through the gzip test server; experiment scripts run from the
repo root; perf pairs run back to back at least twice with the LCP candidate
sequence recorded; the a11y sweep covers `/` and `/login` (routes outside
the shell's chrome) as before.

**Findings (VERIFIED by a command unless marked):**
- **4.1 — the physical label is outside every gate.** `renderLabelSvg.js`
  renders fixed copy onto every printed label ("FOR RESEARCH USE ONLY — NOT
  FOR HUMAN OR VETERINARY USE", storage line, and a post-reconstitution
  storage note from `storage.js`). No test scans the rendered label text;
  labeling is the artifact FDA letters quote first. Grep of the label engine
  for dosing / injection / solvent / volume language: nothing beyond the
  storage note, which names no solvent, volume or schedule. SUSPECTED (for
  the attorney, not the engine): whether "After reconstitution: storage
  conditions must be determined by the validated research protocol" should
  stay on a label at all.
- **4.7 — Hy-005 confirmed:** `MediaGallery` statically imports
  `LabelPreview` (13.1 KB gz) which pulls the QR library's browser build
  (`browser-*.js`, 10.0 KB gz); both ship on every product page's first load
  although the label slides render only when an APPROVED label exists for the
  variant (none do until the owner approves one). 23 KB of the PDP's 43 KB
  static closure is label-studio code.
- **4.7 — Hy-007 mechanism, on reading:** `Page` in `src/App.jsx` fades every
  route from `opacity: 0`, including the FIRST route — whose content is
  already painted from the prerendered HTML. React replaces the static body
  with an invisible tree and fades it back in: a 300 ms flash on every first
  load, and the LCP candidate that follows the fade is the one that landed
  late when the chunk was resident. `MotionConfig reducedMotion="user"` is
  set, so reduced-motion users already skip it.
- **4.9 — the cart drawer takes no focus.** Opening it (Add to cart) leaves
  focus on the trigger behind the overlay; Escape closes it but nothing
  restores focus; no keyboard walk of the public commerce path exists in
  E2E. Global `:focus-visible` outline is defined (`index.css:386`).
- **4.1 / 4.6 — stale state (rewritten failure-injection generator, first
  run):** flipping `soft_launch_hidden` in the Control Room changes the DB
  and the runtime, but the prerendered category and product pages stay on
  the CDN — indexable — until someone redeploys. The attorney-driven flip is
  the case that matters, and nothing in the admin screen or the checklist
  says "then redeploy". No deploy hook exists in the tree.
- **4.5 — competitor mechanics (rewritten generator, first run):** the cart
  re-prices by bundle tier (`unitPriceForQuantity`, items carry `tiers`) but
  never tells the buyer how far they are from the next tier; the PDP does.
- **4.11 — order-status emails** exist for every status with a per-status
  phrase; fine as-is.
- Remaining axe findings at cycle-3 end: none at any impact level.

### SCORE (before this cycle's work)

| # | Scorecard | Score | Evidence |
| --- | --- | --- | --- |
| 4.1 | Legal | 9 | rendered pages gated; label text ungated |
| 4.2 | Security | 8 | unchanged |
| 4.3 | Data integrity | 7 | unchanged |
| 4.4 | Trust | 7 | unchanged |
| 4.5 | Commerce | 7 | no next-tier feedback in cart |
| 4.6 | SEO | 8 | hidden-category flip leaves stale indexable pages until redeploy |
| 4.7 | Performance | 8 | Hy-005 (23 KB label code on PDP), Hy-007 (first-route fade) |
| 4.8 | UI/UX | ? | first-load flash from the fade (SUSPECTED until measured) |
| 4.9 | Accessibility | 8 | drawer focus management missing; no keyboard walk |
| 4.10 | Mobile | 8 | unchanged |
| 4.11 | Admin | 7 | visibility flip has no redeploy path |
| 4.12 | Observability | 6 | unchanged |
| 4.13 | Hygiene | 8 | unchanged |

### PLAN (written before execution; ranked impact × confidence / effort, legal first)

1. **[4.1] Label copy gate.** `scripts/test-label-copy.mjs`: render the front
   and full-wrap labels through the real `renderLabelSvg` for a sample
   config, extract the text, scan it with the compliance scanner against an
   exact allowlist (negations only), and additionally forbid solvent /
   volume / schedule / route-of-administration patterns on any label. Also
   scans the engine's fixed strings (`storage.js`, templates, presets).
   Escalate the reconstitution storage note to the attorney. Generator:
   regulator walk (H-010).
2. **[4.7 / 4.8] First-route fade.** `Page` skips `initial: {opacity: 0}` on
   the first route mounted (the prerendered content is already on screen);
   later route changes keep the fade. Measure `/`, `/shop`, PDP back to back
   ×2 (LCP candidate sequence); then re-map `/` in `ROUTE_PAGE_SOURCES` and
   measure again — keep the mapping only if `/` no longer regresses (Hy-007).
   Generator: cost/perf.
3. **[4.7] Lazy label slides.** `MediaGallery` lazy-loads `LabelPreview`
   (Suspense inside the fixed-size slide, no layout shift); the PDP preload
   guard also forbids `LabelPreview-*` and the QR browser chunk; PDP
   transfer KB measured before/after (Hy-005). Generator: cost/perf.
4. **[4.9] Cart drawer focus + keyboard commerce walk.** On open, focus moves
   into the drawer (close button); on close, focus returns to the trigger;
   `tests/e2e/keyboard-commerce.spec.js` walks /shop → product → Add to cart
   → drawer → Escape with the keyboard only and asserts a visible focus
   indicator at every stop. Generator: accessibility sweep.
5. **[4.1 / 4.6 / 4.11] Visibility flip → rebuild.** `api/admin/catalog.js`
   PATCH on `soft_launch_hidden` POSTs the Vercel deploy hook when
   `VERCEL_DEPLOY_HOOK_URL` is set and reports `rebuild: triggered |
   not_configured | failed`; the Control Room says which, and the checklist
   + `.env.example` document the hook. Test with a stubbed `fetch`.
   Generator: failure injection (stale state).
6. **[4.5] Next-tier nudge in the cart.** Pure helper `nextTierFor(basePrice,
   tiers, qty)` + unit test; the drawer line shows "Add N more for $X each"
   when a higher tier exists. Display only — server pricing is untouched.
   Generator: competitor delta (mechanics).

Not this cycle: an authenticated E2E fixture (Hy-006) — the E2E build has no
Supabase env, so a mock would need a build-time URL and a route-mocked auth
API; noted as the first step of a future cycle.

### EXECUTION — results

| # | Item | Status | Evidence |
| --- | --- | --- | --- |
| 1 | Label copy gate | **VERIFIED** | `scripts/test-label-copy.mjs` (7 assertions): 4 templates × 2 presets × 4 configs = 32 labels rendered through the real engine; findings = exactly one accepted negation per full-wrap label ("NOT FOR DIAGNOSTIC, THERAPEUTIC, …"); no volume / solvent / route / dose / schedule / reconstitution-instruction pattern on any label; 78 engine strings clean. Second method: every rendered label's text read in the `--dump` output. Escalated to counsel: the post-reconstitution storage note |
| 2 | First-route fade | **VERIFIED — for a different reason than planned** | Hy-007 refuted (H-012): with the fade gone the `/` LCP candidate sequence is unchanged (main [1008,1884,2176] / branch [1024,1864,2204]; slow mode ≈3.0 s in 1 of 3 runs on BOTH builds; `/` with its chunk preloaded still bimodal 2 of 3) → `/` stays unmapped, Hy-008 opened. What the change does fix, measured by a computed-opacity trace at 60 fps on both builds: on main the routed page sits at opacity 0 from React mount and fades over **420–460 ms** (17 frames on `/`, 7 on `/shop`), hiding content the prerender painted at ~0.95 s; on the branch it is at opacity 1 from the first frame. Route changes after the first keep the fade |
| 3 | Lazy label slides | **VERIFIED** | `LabelPreview` lazy in both importers (`MediaGallery`, `VialPreview`); PDP preload list drops `LabelPreview-*` and the QR `browser-*` chunk (guard extended in `test-pdp-preload.mjs`); A/B against main, 3 runs: PDP transfer **306 → 285 KB** median, FCP/LCP unchanged (the prerendered text is the largest paint). Side effect worth knowing: splitting `tiers.js` out let Rollup lift `catalog` + `tier1Catalog` out of the main bundle (index 20.1 → 17.1 KB gz; the two new chunks total 3.7 KB and are preloaded where used) |
| 4 | Drawer focus + keyboard walk | **VERIFIED** | `CartDrawer` is `role="dialog"`, takes focus on the close control, restores focus to the opener on close. `tests/e2e/keyboard-commerce.spec.js` green in the run before the final gate (E2E 30 passed / 4 skipped): skip link → product card → product page → Add to Cart → dialog (focus inside, close control) → Tab stays inside → Escape → focus back on Add to Cart, with a visible focus indicator at every stop. Screenshots `c4-drawer-{320,1280}.png`; probe log: focus after open "Close cart", after Escape "Add to Cart — $44" at both widths |
| 5 | Visibility flip → rebuild | **VERIFIED** | `scripts/test-rebuild-hook.mjs` (20 assertions), real PATCH handler: flip → one POST to the hook, `rebuild: "triggered"`, audit row `catalog.rebuild`; same value → nothing; no env → `not_configured`; hook 5xx / throw → `failed`, flip still succeeds; non-Vercel URL refused; product edit → nothing; Control Room renders the three sentences; `.env.example` + `docs/MIGRATIONS_0034.md` + checklist updated. Hardening found while testing: the flip is decided BEFORE the write (the stub aliased `existing`; a real client would not, but the code no longer depends on it) |
| 6 | Next-tier nudge | **VERIFIED** | `src/lib/tiers.js` (pure; `catalog.js` re-exports), `scripts/test-next-tier.mjs` (17 assertions) — cheapest-next tier only, never a dearer one, never one already reached; drawer renders "Add 1 more for $42 each" for BPC-157 at qty 1 (screenshot). `test-cart-pricing.mjs` mirror check re-pointed at the new module |
| 7 | (found by the item-4 screenshot) drawer copy | **VERIFIED** | "Encrypted checkout via Stripe" promised a processor the server-derived rails may not offer (BTCPay-first, card test-only) → "Encrypted checkout · payment options shown at checkout"; the keyboard spec asserts the dialog names no processor. Also a stray leading "·" on cart line metadata when an item has no size |

Landmark sweep on the branch: 0 critical / 0 serious / 0 landmark / 0
keyboard failures (drawer changes touched no landmark).

**Final gate on the finished tree:** build 78 routes / sitemap 72 / 75 pages
with route preloads · lint 0 errors · **52 suites, 950 assertions** (+3 / +48)
· **E2E 30 passed / 4 skipped** (the four `E2E_API_URL` gate specs) ·
**mobile 52/52** · axe 0 critical / 0 serious / 0 landmark / 0 keyboard on 9
routes × 2 widths.

**Cut / not attempted:** authenticated E2E fixture (Hy-006); re-mapping `/`
(measured, not justified); the `labelsApi`/`adminApi` sliver (~1 KB).

### SCORECARD DELTA

| # | Scorecard | Before | After | Why |
| --- | --- | --- | --- | --- |
| 4.1 | Legal | 9 | 9 | labels now gated (32 rendered + 78 strings); still 9 because the reconstitution note and Hy-003 await counsel |
| 4.2 | Security | 8 | 8 | unchanged |
| 4.3 | Data integrity | 7 | 7 | unchanged |
| 4.4 | Trust | 7 | **8** | the drawer no longer promises a processor the rails may not offer |
| 4.5 | Commerce | 7 | **8** | next-tier feedback in the cart; free-ship nudge already there. Not higher: live rail, guest posture — owner |
| 4.6 | SEO | 8 | 8 | rebuild hook closes the stale-page window once the owner sets the env |
| 4.7 | Performance | 8 | 8 | −21 KB per PDP, main bundle −3 KB, no opacity-0 window; Hy-008 (bimodal `/` LCP) open, so not 9 |
| 4.8 | UI/UX | ? | **7** | first load no longer flashes; two drawer nits fixed; no systematic per-route audit yet |
| 4.9 | Accessibility | 8 | 8 | dialog focus + keyboard walk to the auth wall; keyboard-only CHECKOUT still unasserted (Hy-006) |
| 4.10 | Mobile | 8 | 8 | 52/52 |
| 4.11 | Admin | 7 | **8** | a visibility flip now finishes itself (or says why not) |
| 4.12 | Observability | 6 | 6 | unchanged |
| 4.13 | Hygiene | 8 | 8 | +4 suites |

### GENERATOR YIELDS (cycle 4)

Regulator walk 1 · Cost/perf 2 (+ the A/B tool) · Accessibility sweep 1 ·
Failure injection (stale state) 1 — first hit since the rewrite · Competitor
delta (mechanics) 1 — first hit since the rewrite · Ops dry run 0 (status
emails checked) · Data honesty 1 (found via the item-4 screenshot: the
processor promise) · Buyer walk / Inversion not run.

### ESCALATIONS (owner-only; ranked — #1 leads until cleared)

1. **`npm run verify:rls` on prod** — unconfirmed since `0030`.
2. Attorney: category posture → `soft_launch_hidden`; Hy-003 category descriptions;
   **new (low):** the label's "After reconstitution: storage conditions must be
   determined by the validated research protocol." — no solvent/volume/schedule,
   gate accepts it; whether a label should say "reconstitution" at all is counsel's call.
3. Apply `0031`–`0034`; decide `0027`. 4. Repo private. 5. Domain + `VITE_SITE_URL`.
6. Enter labs + lookup codes. 7. Delete legacy `src/data/products.js` + audit script + CI step.
8. `api/stripe-webhook.js` signature-error echo (ask-before).
9. Remove `fonts.googleapis.com` / `fonts.gstatic.com` from the CSP (ask-before block).
10. **New:** set `VERCEL_DEPLOY_HOOK_URL` (Vercel → Project → Settings → Git →
    Deploy Hooks) so a visibility flip rebuilds the static pages by itself.

### What I'd do differently

Test the mechanism before the number: Hy-007 would have been refuted in ten
minutes by removing the fade and reading the candidate sequence, instead of
after building a variant harness around the preload. Grep every importer
before lazy-loading anything (a second static importer kept the chunk in the
closure on the first try). Take the screenshots early — the drawer shot
found two copy defects the code reads never would have. And read every exit
code in a chained run: the unit suite had failed on a mirror check while I
was looking at the E2E line under it.

### PR DRAFT (open only on approval)

**Title:** Optimization cycle 4 — label copy gate, cart dialog focus, rebuild-on-hide, lazy label renderer, next-tier nudge

**Summary.** Seven verified items on top of PR #35: (1) the printed label is
gated — real renders scanned, use-language patterns banned; (2) the first
route no longer fades in from invisible over already-painted content
(420–460 ms opacity-0 window measured and removed); (3) the flat-label
renderer + QR library are lazy: −21 KB on every product page; (4) the cart
drawer is a dialog that takes and returns focus, with a keyboard-only
commerce walk in E2E; (5) hiding a category triggers the Vercel deploy hook
when configured and says so when not; (6) cart lines say "Add N more for $X
each" when a cheaper tier is within reach; (7) the drawer no longer promises
a specific processor. +4 unit suites, +1 E2E spec, `npm run perf:compare`.

**Risks.** `catalog`/`tier1Catalog` now ship as shared chunks instead of
inside the main bundle (preloaded where used; main −3 KB). The rebuild hook
is inert until `VERCEL_DEPLOY_HOOK_URL` is set. No migrations, no data, no
payment / RLS / CSP files touched; server pricing untouched.

**Rollback.** Revert the branch.

---

## Cycle 5 — 2026-09-13

**HEAD before:** `5a51054` (main, Merge PR #36). **Branch:** `claude/opt-cycle-5-20260913`.

### RECON

Numeric diff first: nothing landed on `main` since the cycle-4 merge (PR #36
merged 07:50 UTC by the owner). Build 78 routes / sitemap 72; `test:unit` 52
suites / 950 ✓; lint 0 errors; `npm audit` 0. Live site still unreachable.

**Acting on cycle 4's "what I'd do differently":** the Hy-008 test below was
run mechanism-first (long tasks + font events next to the candidate
sequence); every importer of a module is grepped before touching it; the
first screenshots of this cycle were taken during RECON (the prerendered
pages with JavaScript off); every exit code of every chained run is read.

**Findings (VERIFIED by a command unless marked):**
- **4.7 / 4.8 — the prerendered shell is unstyled.** With JavaScript off,
  `/`, `/shop` and a product page render as browser-default 16 px DM Sans
  text on the dark ground — legible, but an unstyled column of links (JS-off
  screenshots at 390). That is what every visitor sees for the first ~1 s on
  throttled mobile. Its hero paragraph paints at ~1.0 s as LCP candidate 1
  (size 24 570); React's styled hero paragraph is larger (29 900) and becomes
  the final LCP at ~2.2 s. If the static hero carried the page's real type
  scale, the first paint would already be the largest — LCP ≈ FCP on `/`
  and `/shop` — and hydration would not visibly re-lay the page.
- **Hy-008 (bimodal `/` LCP), 6 runs with long-task + font tracing:** all six
  fast (2144–2272 ms); the slow mode did not occur. Long tasks sit at ≈1525
  (125 ms), ≈1655 (95 ms), ≈2050 (60 ms); fonts `loadingdone` at ≈1260 and
  ≈2390; candidate 3 follows the third long task (React's commit of the
  landing page). Inconclusive on the slow mode; moot for LCP if the finding
  above lands.
- **4.1 — admin-entered label text is not compliance-scanned.** `api/admin/
  labels.js` `pickWritable` whitelists `display_name`, `material_type`,
  `composition`, `fill_note`, `storage_short`, `storage_full`, `manufacturer`,
  `distributed_by`, `revision_notes` … and validates only presence. Anything
  typed there prints on the label after approval; the cycle-4 label gate
  scans fixed sample configs, not what an admin types.
- **4.9 / 4.5 — Hy-006 fixture feasibility, on reading:** the E2E build has
  no Supabase env, so Vite folds the client to `const s=null` — no test-side
  rewrite can revive it. A fixture needs `vite build` with a fake URL under
  `*.supabase.co` (already in the CSP `connect-src`) while the prerender
  steps run WITHOUT env (so the data-presence assertion behaves exactly as
  today); at runtime supabase-js reads its session from localStorage and the
  profile via PostgREST — both mockable with Playwright routes. Checkout's
  server calls (`/api/checkout-compliance`, `/api/payment-rails`) are also
  routable. No production code needs a test seam.
- **4.11 / 4.5 — the order confirmation email carries only the order number
  and the total.** No line items, no ship-to snapshot, no shipping-method
  line — the buyer's only receipt, and the weakest possible chargeback
  evidence. `lib/payments/fulfillment.js` has `items` and the shipping
  address in hand when it sends it.
- Buyer walk: the gated pages (`/cart`, `/checkout`) have never been
  screenshotted by the engine — the fixture would make that possible.

### SCORE (before this cycle's work)

| # | Scorecard | Score | Evidence |
| --- | --- | --- | --- |
| 4.1 | Legal | 9 | admin label text unscanned server-side |
| 4.2 | Security | 8 | unchanged |
| 4.3 | Data integrity | 7 | unchanged |
| 4.4 | Trust | 8 | unchanged |
| 4.5 | Commerce | 8 | two-step flow never exercised in E2E |
| 4.6 | SEO | 8 | unchanged |
| 4.7 | Performance | 8 | LCP = React re-render on `/` and `/shop`; static shell unstyled |
| 4.8 | UI/UX | 7 | first-second view is browser defaults |
| 4.9 | Accessibility | 8 | keyboard-only checkout unasserted |
| 4.10 | Mobile | 8 | unchanged |
| 4.11 | Admin | 8 | confirmation email thin |
| 4.12 | Observability | 6 | unchanged |
| 4.13 | Hygiene | 8 | unchanged |

### PLAN (written before execution; ranked impact × confidence / effort, legal first)

1. **[4.1] Server-side compliance scan of admin label text.** A shared
   `lib/labelCopyRules.js` (scanner + the use-language patterns the cycle-4
   gate uses) applied in `api/admin/labels.js` on create and patch: any
   finding → 400 naming the field and the term; the label gate imports the
   same rules. Test executes the real handler against the stub.
   Generator: regulator walk.
2. **[4.7 / 4.8] Styled prerender shell.** CSS scoped to the static
   `#root > main:not(#main)` gives the shell the site's type scale (display
   face for the h1, body face and measure for paragraphs, an inline nav
   list), so the first paint is the largest paint. Measured with
   `perf:compare` against main on `/`, `/shop`, PDP (candidate sequences);
   JS-off screenshots before/after. Generator: cost/perf.
3. **[4.9 / 4.5] Authenticated E2E fixture + keyboard-only checkout.**
   `npm run build:e2e` (vite build with a fake `*.supabase.co` URL, then the
   prerender steps without env); `tests/e2e/fixtures/auth.js` seeds a
   session and routes the auth, profile, rails and compliance calls;
   `tests/e2e/checkout-keyboard.spec.js` walks /cart → /checkout step 1 →
   step 2 with the keyboard, asserting focus visibility and the attestation
   gate; first screenshots of the gated pages at 390/1280. CI's E2E job
   builds with `build:e2e`. Generator: accessibility sweep + buyer walk.
4. **[4.11 / 4.5] Receipt-grade confirmation email.** Pure
   `orderConfirmationHtml({...})` builder (line items, quantities, unit
   prices, subtotal/shipping/total, ship-to, shipping method, order number,
   the RUO line) used by `sendOrderConfirmationEmail`; fulfilment passes what
   it has. Tested directly; the corpus gate keeps scanning the template.
   Generator: inversion ("what makes a chargeback stick?").

Not this cycle: Hy-008's slow mode (unobserved in 6 runs; moot for LCP if
item 2 lands — recorded); the Stripe-webhook echo (ask-before).

### EXECUTION — results

| # | Item | Status | Evidence |
| --- | --- | --- | --- |
| 1 | Admin label text scanned server-side | **VERIFIED** | `lib/labelCopyRules.js` shared by the handler and the build gate (the gate now imports its patterns — asserted). `scripts/test-admin-label-copy.mjs` (21 assertions) executes the real create + patch: "Reconstitute with 2 mL bacteriostatic water" → 400 naming `fill_note` with volume + solvent + instruction; "promotes healing" in `display_name` → 400 (scanner, outside a negation); "Inject subcutaneously daily" in a patch → 400 and nothing written; clean copy and the negated RUO wording → 200; only text fields are judged. Second method: the handler's two insertion points read after the change |
| 2 | Styled prerender shell | **CUT — measured regression** | Written, built, A/B'd against main with `perf:compare` (4 runs): `/` LCP 2204 → **3064 ms (+860, 4 of 4 runs)** — the static h1 (28 475 px²) out-sized the age-gate paragraph so React's hero paragraph (29 900) became the only later candidate, and it landed at ≈3.05 s; `/shop` +36, PDP and `/test-results` unchanged. A route-injected preload of the mono 400 face moved the hero to ≈2.07 s in 3 of 4 runs on that shell; the same preload BUILT IN did not (0 of 4). Both reverted; `git diff` on `src/index.css` and `index.html` is empty. JS-off screenshots of the shell before the change kept (`c5-static-*-390.png`). Findings folded into Hy-008; H-013 added |
| 3 | Authenticated E2E fixture + keyboard-only checkout | **VERIFIED** | `npm run build:e2e` (fake `https://e2e.supabase.co`, prerender steps without env — log lines assert both phases); `tests/e2e/fixtures/auth.js` (session in `sb-e2e-auth-token`, routes for auth / profiles / rails / compliance, catch-all 503 → static fallbacks); `tests/e2e/checkout-keyboard.spec.js` 2/2 green: /cart renders for the attested researcher, "Proceed to Checkout" reached by Tab with an indicator, step 1's controls (> 12) all show an indicator, form completed (typing, Space on the method radio and the three certifications), Continue → step 2 renders the routed rails and the pay control; a profile without a current attestation is sent to `/register/attestation`. First screenshots of the gated pages: `c5-cart.png`, `c5-checkout-step1.png`, `c5-checkout-step2.png` (1280). Bug found and fixed in the fixture itself: Playwright matches the LAST registered route first, so the catch-all had shadowed the profile mock (503 → attestation bounce) |
| 4 | Receipt-grade confirmation email | **VERIFIED** | `orderConfirmationHtml` pure builder + `lib/orderLines.js`; `scripts/test-order-email.mjs` (19 assertions): both line shapes (BTCPay `unit_dollars`, Stripe `price.unit_amount` + metadata SKU), quantities, unit prices, total, ship-to snapshot, method, RUO line, escaping (`&` and `<b>` in user text), honest omission (no table without items, a dash for an unknown unit price), non-USD label; fulfilment passes items / address / method / name (asserted by regex). The corpus gate scans the template source and flagged the word "cycle" in my own comment — reworded |

Also fixed while verifying: none in product code beyond the above.

**Final gate on the finished tree:** build 78 routes / sitemap 72 · lint 0
errors · **54 suites, 988 assertions** (+2 / +38) · **mobile 52/52** ·
`build:e2e` → **E2E 32 passed / 4 skipped** (the four `E2E_API_URL` gate
specs) · axe 0 critical / 0 serious / 0 landmark / 0 keyboard on the E2E
build (as CI will run it).

**Cut / not attempted:** the styled shell (above); Hy-008's cause (next test
recorded in the PLAYBOOK); the Stripe-webhook echo (ask-before).

### SCORECARD DELTA

| # | Scorecard | Before | After | Why |
| --- | --- | --- | --- | --- |
| 4.1 | Legal | 9 | 9 | admin-entered label text can no longer print past the rules; still 9 while counsel items (Hy-003, the reconstitution note) are open |
| 4.2 | Security | 8 | 8 | unchanged |
| 4.3 | Data integrity | 7 | 7 | unchanged |
| 4.4 | Trust | 8 | 8 | unchanged |
| 4.5 | Commerce | 8 | **9** | the two-step flow is exercised end to end for the first time (rails from the server, compliance record before payment, attestation gate); receipt-grade confirmation. Not 10: no live rail |
| 4.6 | SEO | 8 | 8 | unchanged |
| 4.7 | Performance | 8 | 8 | no shipped change; Hy-008 refined with a measured dead end |
| 4.8 | UI/UX | 7 | 7 | the first-second view stays browser-default (the styled shell was cut on LCP) |
| 4.9 | Accessibility | 8 | **9** | keyboard-only checkout asserted through step 2 with indicators at every stop. Not 10: 200 % zoom and screen-reader announcements of the step indicator unasserted |
| 4.10 | Mobile | 8 | 8 | 52/52 |
| 4.11 | Admin | 8 | **9** | the receipt; the label door |
| 4.12 | Observability | 6 | 6 | unchanged |
| 4.13 | Hygiene | 8 | 8 | +2 suites, +1 spec, +1 build script |

### GENERATOR YIELDS (cycle 5)

Regulator walk 1 · Accessibility sweep 1 · Inversion 1 · Failure injection
(stale state) 1 (the stale-attestation bounce, asserted) · Buyer walk 0
shipped (first gated-page screenshots; two findings recorded) · Cost/perf 0
(one item cut with data) · Competitor delta / Ops dry run / Data honesty not
run.

### ESCALATIONS (owner-only; ranked — #1 leads until cleared)

1. **`npm run verify:rls` on prod** — unconfirmed since `0030`.
2. Attorney: category posture → `soft_launch_hidden`; Hy-003; the label's
   post-reconstitution storage note.
3. Apply `0031`–`0034`; decide `0027`. 4. Repo private. 5. Domain + `VITE_SITE_URL`.
6. Enter labs + lookup codes. 7. Delete legacy `src/data/products.js` + audit script + CI step.
8. `api/stripe-webhook.js` signature-error echo (ask-before).
9. Remove the Google Fonts origins from the CSP (ask-before block).
10. Set `VERCEL_DEPLOY_HOOK_URL` (cycle 4).

### What I'd do differently

Run the paint experiment as an injected variant before writing CSS (H-013);
the cut cost a build, an A/B, a rebuild and the revert. Read Playwright's
route-precedence rule before stacking a catch-all on specific routes — the
one fixture bug this cycle was that. Keep comments out of the compliance
scanner's path: a doc comment in `lib/email.js` carried the word "cycle" and
tripped the corpus gate, which was doing its job. And take the gated-page
screenshots at 390 as well as 1280 next time — the fixture makes it cheap.

### PR DRAFT (open only on approval)

**Title:** Optimization cycle 5 — label copy enforced at the door, authenticated E2E + keyboard checkout, receipt-grade confirmation

**Summary.** Three verified items on top of PR #36 and one measured cut:
(1) text an admin types into a label config is refused at create/patch when
it carries use language or an un-negated scanner finding — the same rules
the build gate renders real labels against; (2) `npm run build:e2e` + an
authenticated Playwright fixture (no database, no production seam) let E2E
walk /cart → checkout step 1 → step 2 with the keyboard, assert a focus
indicator at every stop and prove the attestation gate; CI's E2E job uses
it; (3) the order confirmation email carries line items, quantities, unit
prices, total, ship-to, shipping method and the research-use line, escaped
and tested. Cut: a styled prerender shell that made the home page's largest
paint land 860 ms later in 4 of 4 runs against main. +2 unit suites, +1 E2E
spec.

**Risks.** CI's E2E job now builds with `build:e2e` (Vite gets a fake
`*.supabase.co` URL; prerender / precache / CSP run without env exactly as
the production build). The confirmation email's callers pass more fields
(all optional; the builder omits what is absent). No migrations, no data,
no payment / RLS / CSP files touched.

**Rollback.** Revert the branch.

---

## Cycle 6 — 2026-09-13

**HEAD before:** `55cc78a` (main, Merge PR #37). **Branch:** `claude/opt-cycle-6-20260913`.

### RECON

Numeric diff first: nothing landed on `main` since the cycle-5 merge (PR #37
merged 08:30 UTC by the owner). Build 78 routes / sitemap 72; `test:unit` 54
suites / 988 ✓; `npm audit` 0. Live site still unreachable.

**Acting on cycle 5's "what I'd do differently":** the paint experiments
below ran as route-injected variants BEFORE any file was touched (H-013);
Playwright route precedence is now stated in the fixture; comments stay out
of scanner-scanned sources.

**Findings (VERIFIED by a command unless marked):**
- **4.1 — reviews are the only public copy a buyer writes, and they are
  screened by a four-regex list, not the site's rules.** `api/reviews.js`
  rejects a handful of phrasings ("I took…", "healed", "dose") and publishes
  immediately (`status: "published"`, moderation is after the fact); the
  compliance scanner and the use-language rules that gate labels are not
  applied. "Noticeable therapeutic benefit within days" or "reconstitute
  with 2 mL bacteriostatic water" would publish. Reads are limited by RLS to
  attested users — a regulator can attest.
- **Hy-008 — H-013 experiment, injected variants on `/`, 4 runs each:**
  as-built FCP ≈1010 / LCP 2148–2196; the three mono faces at
  `font-display: optional` → FCP 852–884 (**−130**) / LCP 2008–2076
  (**−140**), all four runs; a preload of the mono 400 file on top →
  LCP 2920–2976 in 3 of 4 (the slow mode). The mono files (30 KB) compete
  with the render-blocking stylesheet for the 1.6 Mbps link before first
  paint; `optional` takes them out of that race. Mechanism of the slow mode
  still SUSPECTED (the late hero repaint), but the lever that avoids it is
  measured.
- **4.5 — checkout step 1 loses everything on reload.** Only the compliance
  id is kept in `sessionStorage`; contact, ship-to, research use and method
  are in React state. The scorecard says "state survives back-navigation
  and reload" — back-navigation does (in-memory), reload does not. With the
  cycle-5 fixture this is now assertable.
- **4.12 — server errors have no ledger.** `failSafely` writes the scrubbed
  detail to the function log only; the Control Room shows client errors
  (`client_errors` + tab) but nothing from the API side. The scorecard asks
  for "server error ledger populated and visible in admin".

### SCORE (before this cycle's work)

| # | Scorecard | Score | Evidence |
| --- | --- | --- | --- |
| 4.1 | Legal | 9 | review text screened by a short list, not the site's rules |
| 4.5 | Commerce | 9 | reload loses step-1 state |
| 4.7 | Performance | 8 | mono faces in the pre-paint bandwidth race |
| 4.12 | Observability | 6 | no server error ledger |
| others | — | as cycle 5 | unchanged |

### PLAN (written before execution of items 2–4; item 1's screening rule and the font experiment ran during RECON)

1. **[4.1] Reviews held to the site's rules.** `api/reviews.js` also applies
   `checkLabelText` (scanner outside a negation + every use-language
   pattern) before writing; `scripts/test-reviews-screen.mjs` executes the
   real handler (accepted quality / COA / negated-RUO reviews; refused
   outcome, dose, solvent, route, schedule, disease and benefit claims;
   client cannot set status). Generator: regulator walk.
2. **[4.7] Mono faces → `font-display: optional`.** Measured as a variant
   (above); built and A/B'd against main on `/`, `/shop`, PDP with
   `perf:compare` (4 runs). Trade-off stated in `src/fonts.css` and the
   readiness file. Generator: cost/perf.
3. **[4.5] Checkout draft survives reload.** Step-1 contact / ship-to /
   research / method persist in `sessionStorage` (never the certifications,
   never `localStorage`); cleared when payment starts. Asserted in
   `checkout-keyboard.spec.js` with the auth fixture. Generator: buyer walk.
4. **[4.12] Server error ledger.** Migration `0035_server_errors.sql` (file
   only); `failSafely` best-effort inserts `{request_id, code, context,
   status, message}` (scrubbed, no PII, never throws); `api/admin/server-
   errors.js` GET/PATCH; Control Room tab beside client errors. Tested
   against the stub. Generator: ops dry run.

### EXECUTION — results

| # | Item | Status | Evidence |
| --- | --- | --- | --- |
| 1 | Reviews held to the site's rules | **VERIFIED** | `api/reviews.js` applies `checkLabelText` (shared rules) and a new outcome / body-part list on top of its own; `scripts/test-reviews-screen.mjs` (16 assertions) executes the real handler: quality / COA / shipping and negated-RUO reviews accepted; outcome, dose, solvent + reconstitution, route, schedule, disease and benefit claims → 400 with the guidance sentence and nothing written; `status` and `verified_purchase` come from the server whatever the body says. Found while testing: "Helped my tendon recover fast" passed the old list AND the scanner (no verb form of "recover") — the body-part list closes it. The stub gained `upsert` |
| 2 | Mono faces → `font-display: optional` | **CUT — measured inversion** | Injected inline variant: FCP −130 / LCP −140 ms, 4 of 4 runs. Built into the stylesheet and A/B'd against main (4 runs): `/` LCP 2220 → **3052 (+832)**, `/shop` +0, PDP −12. Reverted (`git diff src/fonts.css` empty). H-013 amended: inject through the real delivery path. Hy-008 refined |
| 3 | Checkout draft survives a reload | **VERIFIED** | `src/lib/checkoutDraft.js` (session storage only; contact / ship-to / billing / research / method; certifications never restored; cleared when payment starts); `checkout-keyboard.spec.js` gains "the step-1 draft survives a reload; the certifications do not" — values persist after `page.reload()`, the checked certification is unchecked again, nothing checkout-related in `localStorage`. Green in the final gate (E2E line below). Lesson while moving the helpers out of the page file (react-refresh rule): slice by function end, not first brace |
| 4 | Server error ledger | **VERIFIED** | Migration `0035_server_errors.sql` (additive, RLS on, admin read only, no client writers); `failSafely` → `recordServerError` (detached promise, scrubbed detail capped at 1000 chars, no stack, no body, never throws); `api/admin/server-errors.js` GET (pre-0035 → `migrationPending`, never a broken tab) / PATCH; Control Room Errors tab mounts the server panel under the client one. `scripts/test-server-errors.mjs` (16 assertions): envelope unchanged, one insert with request id / code / context / status, `sk_live_…` redacted, PATCH resolves, 405 elsewhere, migration assertions |

**Final gate on the finished tree:** build 78 routes / sitemap 72 · lint 0
errors · **56 suites, 1019 assertions** (+2 / +31) · **mobile 52/52** ·
`build:e2e` → **E2E 33 passed / 4 skipped** · axe 0 critical / 0 serious /
0 landmark / 0 keyboard on the E2E build.

**Cut / not attempted:** the mono `optional` change (above); Hy-008 (next test
recorded); the reviews backlog re-scan (needs the database — owner can run
the same `checkLabelText` over `product_reviews` once 0035 lands; not built).

### SCORECARD DELTA

| # | Scorecard | Before | After | Why |
| --- | --- | --- | --- | --- |
| 4.1 | Legal | 9 | 9 | the last public copy surface a buyer writes is now held to the site's rules; counsel items still open |
| 4.5 | Commerce | 9 | 9 | reload no longer loses the draft (the scorecard's reload check now passes); no live rail |
| 4.7 | Performance | 8 | 8 | no shipped change; two measured dead ends in two cycles |
| 4.12 | Observability | 6 | **7** | server errors visible in admin once 0035 is applied; uptime target and backup dry run remain owner items |
| others | — | — | unchanged |

### GENERATOR YIELDS (cycle 6)

Regulator walk 1 · Buyer walk 1 · Ops dry run 1 · Cost/perf 0 (second cycle
at 0 → rewrite or retire next cycle) · Failure injection / Competitor delta /
Data honesty / Inversion / Accessibility sweep not run.

### ESCALATIONS (owner-only; ranked — #1 leads until cleared)

1. **`npm run verify:rls` on prod** — unconfirmed since `0030`.
2. Attorney: category posture → `soft_launch_hidden`; Hy-003; the label's
   post-reconstitution storage note.
3. Apply `0031`–**`0035`**; decide `0027`. 4. Repo private. 5. Domain + `VITE_SITE_URL`.
6. Enter labs + lookup codes. 7. Delete legacy `src/data/products.js` + audit script + CI step.
8. `api/stripe-webhook.js` signature-error echo (ask-before).
9. Remove the Google Fonts origins from the CSP (ask-before block).
10. Set `VERCEL_DEPLOY_HOOK_URL`.
11. **New:** once 0035 is live, re-scan existing `product_reviews` with the
    same rules (a one-off SQL export + `node -e` over `checkLabelText`) and
    hide any that fail — the endpoint only screens new submissions.

### What I'd do differently

Inject a paint variant through the same delivery path as the change
(external stylesheet vs inline) — the inline variant answered a different
question, and the cost was a build, an A/B and a revert. Retire or rewrite
the cost/perf generator next cycle rather than take a third run at Hy-008
with the same method. When moving code out of a file with a script, cut at
the function's closing brace, not the first `}` after its name.

### PR DRAFT (open only on approval)

**Title:** Optimization cycle 6 — reviews held to the site's rules, checkout draft survives reload, server error ledger

**Summary.** Four verified items on top of PR #37 and one measured cut:
(1) buyer reviews — the only public copy a buyer writes — are screened with
the same use-language rules and scanner that gate printed labels, plus an
outcome / body-part list; (2) the checkout step-1 draft survives a reload
(session storage only; certifications re-affirmed every time), asserted in
E2E; (3) every safely-failed API request is recorded in a new
`server_errors` ledger (migration 0035, file only) and listed in the
Control Room's Errors tab beside client errors; (4) the database stub grew
`upsert` and a rate-limit stub so public handlers can be executed in tests.
Cut: `font-display: optional` for the mono faces (inline variant won, built
version lost +832 ms LCP on `/`, 4 of 4). +2 unit suites, +1 E2E test.

**Risks.** `failSafely` now also fires a detached insert; it never throws
and never delays the response (tested). Migration 0035 is not applied by
this PR. No payment / RLS / CSP files touched.

**Rollback.** Revert the branch.

---

## Cycle 7 — 2026-09-13

**HEAD before:** `16655cd` (cycle-6 head; PR #38 was open and green when
the owner said "Continue", so this cycle branched from it; #38 merged at
09:32 UTC — before this cycle's PR was opened — so the PR targets `main`
and its diff is exactly the cycle-7 commits). **Branch:**
`claude/opt-cycle-7-20260913`.

### RECON

Nothing landed on `main` since the cycle-6 base (main = `55cc78a`). Build 78
routes / sitemap 72; `npm audit` 0. The baseline unit run failed on the
harness (`/usr/bin/time` absent, exit 127) — re-run in the gate.

**Acting on cycle 6's "what I'd do differently":** no paint-timing item this
cycle at all (cost/perf generator at 0 yield for two cycles → rewritten in
the PLAYBOOK as a deterministic bytes-and-requests check; timing becomes a
measurement-only lane); code moved with a script is cut at the function's
closing brace.

**Findings (VERIFIED by a command unless marked):**
- **4.1 — two more admin-entered texts render publicly unscanned:** a
  discount's `description` (300 chars, `api/admin/discounts.js`) is read by
  `/deals` through RLS for public discounts; a lab's `name`
  (`api/admin/labs.js`) renders on every COA card. Same class as the label
  fields (cycle 5) and reviews (cycle 6).
- **4.2 — every public POST endpoint rate-limits** except the two
  signature-verified webhooks; the AI endpoints limit centrally through
  `aiHandler()`; the admin compliance scanner is admin-gated. Nothing to fix
  — but nothing enforced it either; the new gate found the exemptions the
  hard way (first run flagged the helper file and the admin scanner).
- **4.9 — the gated pages have never been swept by axe.** The cycle-5
  fixture makes `/cart` and both checkout steps reachable; the sweep only
  covers the nine public routes.
- **4.4 — the label→verify QR round trip is asserted by string presence
  only** (`test-labels` checks the code appears in the SVG). No test
  decodes a rendered label's QR and feeds it to the scanner's parser.
- **4.11 — the runbook stops at cycle 3:** no mention of the deploy hook,
  the E2E build, migration 0035 or the server-error panel.

### SCORE (before this cycle's work)

| # | Scorecard | Score | Evidence |
| --- | --- | --- | --- |
| 4.1 | Legal | 9 | discount description + lab name unscanned |
| 4.2 | Security | 8 | rate limits complete but unenforced by a test |
| 4.4 | Trust | 8 | QR round trip not decoded |
| 4.9 | Accessibility | 9 | gated pages unswept |
| 4.11 | Admin | 9 | runbook stale for cycles 4–6 |
| others | — | as cycle 6 | unchanged |

### PLAN (written before execution; item 2's gate was written during RECON)

1. **[4.1] Discount descriptions and lab names held to the rules** —
   `checkLabelText` in both admin handlers (400 naming the field); tests
   execute the real handlers. Generator: regulator walk.
2. **[4.2] Rate-limit coverage gate** — `scripts/test-rate-limits.mjs`:
   every public POST handler calls `checkRateLimit` or goes through
   `aiHandler()`; webhooks exempt by signature; admin handlers out of scope.
   Generator: failure injection (stale/hostile state).
3. **[4.9] axe over the gated pages** — the sweep gains an authenticated
   pass (fixture) over `/cart`, checkout step 1 and step 2; skipped with a
   note when the dist is not the E2E build; findings fixed. Generator:
   accessibility sweep.
4. **[4.4] QR round trip** — `scripts/test-qr-roundtrip.mjs`: render the
   full-wrap label, rasterize it in Chromium, decode the QR with jsQR, parse
   with the scanner's parser, expect the verification code; run in the E2E
   job. Generator: data honesty (a trust claim traced end to end).
5. **[4.11] Runbook currency** — RUNBOOK sections for the deploy hook, the
   E2E build, migration 0035 and the Errors tab. Generator: ops dry run.
6. **PLAYBOOK:** cost/perf generator rewritten (bytes & requests, deterministic).

### EXECUTION — results

| # | Item | Status | Evidence |
| --- | --- | --- | --- |
| 1 | Discount descriptions + lab names held to the rules | **VERIFIED** | `checkLabelText` at create and patch in `api/admin/discounts.js` and `api/admin/labs.js`; `scripts/test-admin-copy-doors.mjs` (12 assertions) executes both real handlers: outcome claim / solvent in a description → 400 naming `description`, nothing written; "Dosing & Injection Labs" and a "Therapeutic …" rename → 400 naming `name`; clean copy → 200. The test caught my own defect first: the labs check read `picked.name` where the picker returns `picked.fields.name` (first run: 200, 200) |
| 2 | Rate-limit coverage gate | **VERIFIED** | `scripts/test-rate-limits.mjs` (5 assertions): 12 public POST handlers; every one calls `checkRateLimit` or goes through `aiHandler()` (which does); both webhooks verify a signature; the limiter is DB-backed with an in-memory backstop. First run flagged the AI helper module and the admin-only compliance scanner — both exempted for the right reasons, not silenced |
| 3 | axe over the gated pages | **VERIFIED** | authenticated pass in `a11y-sweep.mjs` (fixture; skipped with a note on a non-E2E dist): 6 page-views (/cart, checkout step 1, step 2 × 390/1280). One finding: `page-has-heading-one` on both checkout steps → `<h1 className="sr-only">Checkout — step N of 2 …</h1>`; re-swept in the final gate (line below) |
| 4 | QR round trip | **VERIFIED** | `scripts/test-qr-roundtrip.mjs` (8 assertions): for all four templates the full-wrap label renders → Chromium rasterizes at 2× → jsQR decodes `https://www.noirpeptides.com/v/A1B2C3D4E5F6G` from the pixels → `parseScannedCode` returns the code. Runs as `npm run test:qr` in the E2E job |
| 5 | Runbook currency | **VERIFIED (doc)** | `docs/RUNBOOK.md` gains: category visibility → rebuild; Errors tab (client 0025 + server 0035, request-id lookup); the E2E build and why its output is never deployed; the copy gates and what a 400 from the doors means |
| 6 | Generator rewrite | done | PLAYBOOK: cost/perf → "Bytes & requests" (deterministic) with timing as a measurement-only lane |

**Final gate on the finished tree:** build 78 routes / sitemap 72 · lint 0
errors · **59 suites, 1035 assertions** (+3 / +16) in 7 s · **mobile 52/52**
· `build:e2e` → **E2E 33 passed / 4 skipped** · axe 0 critical / 0 serious /
0 landmark / 0 keyboard across 24 page-views (18 public + **6 gated**) · QR
round trip 8/8.

### SCORECARD DELTA

| # | Scorecard | Before | After | Why |
| --- | --- | --- | --- | --- |
| 4.1 | Legal | 9 | 9 | every admin-entered text with a public render is now at the door; counsel items still open |
| 4.2 | Security | 8 | **9** | rate limits complete and enforced; envelopes, scrubber, admin guard gated in earlier cycles. Not 10: `verify:rls` on prod unconfirmed; repo public |
| 4.4 | Trust | 8 | **9** | the QR claim is proven end to end; lab keys remain owner data |
| 4.9 | Accessibility | 9 | 9 | gated pages swept and clean; screen-reader step announcements still unasserted |
| 4.11 | Admin | 9 | 9 | runbook current |
| others | — | — | unchanged |

### GENERATOR YIELDS (cycle 7)

Regulator walk 1 · Failure injection 1 · Accessibility sweep 1 · Data honesty
1 · Ops dry run 1 · Cost/perf (rewritten) not run · Competitor delta /
Inversion / Buyer walk not run.

### ESCALATIONS (owner-only; ranked — #1 leads until cleared)

Unchanged from cycle 6 (1: `verify:rls` on prod; 2: counsel items; 3: apply
`0031`–`0035`; 4: repo private; 5: domain; 6: lab data; 7: legacy
`products.js`; 8: webhook echo; 9: CSP font origins; 10: deploy hook; 11:
review backlog re-scan). One addition for the merge queue: **PR #38 (cycle
6) is still open** — this cycle's PR is stacked on it.

### What I'd do differently

Write the handler test before the handler edit even for a two-line check —
it took one failing run to find that the lab picker nests its fields. Read
the picker's return shape, not its name. And when a generator has yielded
nothing for two cycles, rewrite it at the START of the cycle (done), not
after another attempt.

### PR DRAFT (open only on approval)

**Title:** Optimization cycle 7 — copy doors for discounts and labs, rate-limit gate, QR round trip, axe on the gated pages

**Summary.** Five verified items stacked on cycle 6 (PR #38): (1) discount
descriptions and lab names — the last admin-entered texts with a public
render — are refused at the door when they carry use language; (2) a gate
proves every public POST endpoint rate-limits (webhooks by signature);
(3) "scan the label, land on the lot" is proven end to end for every
template (render → rasterize → decode → parse); (4) axe now sweeps the
gated cart and checkout through the auth fixture — the missing h1 is fixed;
(5) the runbook covers cycles 4–7. +3 unit suites, +1 E2E-job step.

**Risks.** None to production behaviour beyond two more 400s from admin
endpoints on flagged copy and an sr-only heading on the checkout. The CI
E2E job gains the QR step (needs Chromium, already installed there).

**Rollback.** Revert the branch.
