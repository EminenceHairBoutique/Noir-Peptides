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

---

## Cycle 8 — 2026-09-13

**HEAD before:** `6bb21eb` (main, Merge PR #39). **Branch:** `claude/opt-cycle-8-20260913`.

### RECON

Nothing landed on `main` since the cycle-7 merge (PR #39 merged before the
owner's "Continue"). Build 78 routes / sitemap 72; `test:unit` 59 suites /
1035 ✓; `npm audit` 0. Live site still unreachable.

**Acting on cycle 7's "what I'd do differently":** the rewritten cost/perf
generator ran FIRST this cycle as a deterministic gate (bytes & requests),
before anything else; the regulator read of the research articles was done
by reading, not by pattern.

**Findings (VERIFIED by a command unless marked):**
- **4.6 — every unknown path is a soft 404.** `vercel.json` rewrites
  `/((?!api/).*)` to `/index.html`, so `/asdf`, a mistyped product slug or a
  removed page answers **200** with the "not found" body; the generator
  already emits a real `404/index.html` that nothing serves with a 404
  status. Crawlers index or flag soft 404s; the fix is a routing rule that
  rewrites ONLY the client-side routes and lets everything else fall to the
  static 404.
- **4.12 — nothing runs after a deploy.** `npm run test:e2e:prod` exists
  (server-gate specs: unauthenticated / stale / malformed requests must be
  refused with 401 / 403 / 400 — read to confirm they write nothing) but no
  workflow triggers it; the scorecard asks for a post-deploy chain.
- **4.8 / 4.4 — rendered hygiene, first deterministic pass:** 78 pages, no
  lorem / "coming soon" / TBD / `[object Object]` / `undefined` / `NaN` /
  `null` / Invalid Date / template braces / stray "placeholder" in any
  visible text, meta, JSON-LD or alt/aria. A raw grep had shown hits — all
  inside scripts and class names, which is why the gate extracts what a
  person reads.
- **4.7 — bytes & requests (rewritten generator, first run):** `/` 262 KB /
  19 req · `/shop` 278 / 28 · PDP 288 / 33 · `/test-results` 270 / 23 ·
  `/faqs` 263 / 19 on a cold mobile visit, unthrottled; no heavy lazy chunk
  on any first visit. Budgets set with ~20 % headroom.
- **4.1 — research articles read as a regulator would:** four published
  articles (COA, lab models, HPLC, purity vs content) and two drafts; dry,
  analytical, the preclinical section states findings are "what the
  literature reports, not established human effects". No dates are emitted
  in their JSON-LD (none exist in the data — nothing invented). Nothing to
  change.
- **4.10 — the gated pages have no overflow guard** (the mobile audit runs
  on the production dist, where they are unreachable).

### SCORE (before this cycle's work)

| # | Scorecard | Score | Evidence |
| --- | --- | --- | --- |
| 4.6 | SEO | 8 | soft 404 on every unknown path |
| 4.7 | Performance | 8 | budgets unenforced |
| 4.8 | UI/UX | 7 | hygiene unasserted (found clean) |
| 4.10 | Mobile | 8 | gated pages unguarded |
| 4.12 | Observability | 7 | no post-deploy chain |
| others | — | as cycle 7 | unchanged |

### PLAN (written before execution of items 1, 2 and 5; items 3–4's gates were written and run during RECON)

1. **[4.6] Real 404s for unknown paths.** The generator also writes
   `dist/404.html` (what Vercel serves with a 404 status when nothing
   matches); `vercel.json` rewrites only the client-side routes (cart,
   checkout, account, admin, auth callbacks, alias redirects, code links)
   to `index.html`; `serve-dist.mjs` mirrors the rule. `scripts/test-
   routing.mjs` enumerates every `<Route path>` in `src/App.jsx` and proves
   each is either prerendered or matched by a rewrite, that `/api/*` is
   never rewritten, and that a junk path is not. Generator: inversion
   ("what drops us from Google?" → soft 404s).
2. **[4.12] Post-deploy smoke chain.** `.github/workflows/post-deploy.yml`
   on `deployment_status` success for the Production environment runs the
   server-gate spec against the live origin. Generator: ops dry run.
3. **[4.8] Rendered hygiene gate** (`test-dist-hygiene.mjs`, in `test:unit`).
4. **[4.7] Bytes & requests budget** (`test-bytes-budget.mjs`, E2E job).
5. **[4.10] No horizontal overflow on the gated pages** — asserted in the
   sweep's authenticated pass at 390. Generator: accessibility sweep.

### EXECUTION — results

| # | Item | Status | Evidence |
| --- | --- | --- | --- |
| 1 | Real 404s for unknown paths | **VERIFIED** | `vercel.json`: the catch-all `/((?!api/).*)` → 28 explicit client-route rewrites (account, admin, auth, cart, checkout, aliases, `/v/:code`, `/test-results/:slug`, …); generator writes `dist/404.html`; `serve-dist.mjs` reads the rewrite list from `vercel.json` (path-to-regexp subset) and is importable without starting. `scripts/test-routing.mjs` (23 assertions): all 55 declared routes prerendered or rewritten; 6 junk paths fall to the 404; `/api/*` never rewritten; no static route double-listed; `404.html` is the noindex shell. **Found on the way: `/quality` had never been prerendered** — the generator imported `QUALITY_DOC` since Sept 11 and never emitted the route; linked from header + footer since launch; with real 404s it would have vanished. Now emitted, in the footer nav and the sitemap (72 → 73); the dist-copy allowlist gains its one negated "therapeutic" finding |
| 2 | Post-deploy smoke chain | **VERIFIED** | `.github/workflows/post-deploy.yml` on `deployment_status` success for the Production environment: `checkout-attestation-gate.spec.js` against `environment_url` (its requests are refused by the server with 401 / 403 / 400 before any write — read to confirm). Live evidence on PR #40 itself: Vercel's preview deployment triggered the workflow and the `prod-gates` job **ran and skipped** (environment Preview) — syntax and guard validated by GitHub; the first real run is the next production deploy |
| 3 | Rendered hygiene gate | **VERIFIED** | `scripts/test-dist-hygiene.mjs` (11 assertions) over 78→79 pages: 0 findings across ten patterns. The raw grep during RECON had shown `[object Object]` (2 pages), `NaN` (2), `TBD` (1), `{{` (20) — all inside scripts and class names; the gate reads what a person reads |
| 4 | Bytes & requests budget | **VERIFIED** | `scripts/test-bytes-budget.mjs` (15 assertions, E2E job). First calibration used the CI production build (`/` 262 KB / 19 req … PDP 288 / 33) and the first gate run failed on the PDP's request count (43 > 42): the E2E build — which the job actually serves — carries the Supabase client and makes the runtime data calls production makes, so it is the honest baseline: `/` 306 KB / 20 · `/shop` 324 / 33 · PDP 336 / 43 · `/test-results` 315 / 25 · `/faqs` 307 / 20. Budgets set with ~20 % headroom over those; no heavy lazy chunk on any first visit |
| 5 | Overflow guard on the gated pages | **VERIFIED** | the sweep's authenticated pass records horizontal overflow as a serious finding; final gate: 0 across the six gated views |

**Final gate on the finished tree:** build 79 routes / sitemap 73 / `404.html`
· lint 0 errors · **62 suites, 1068 assertions** (+3 / +33) in 6 s ·
**mobile 52/52** · `build:e2e` → **E2E 33 passed / 4 skipped** · axe 0
critical / 0 serious / 0 landmark / 0 keyboard / 0 overflow across 24
page-views · QR round trip 8/8 · bytes & requests 15/15 (after the
recalibration above).

### SCORECARD DELTA

| # | Scorecard | Before | After | Why |
| --- | --- | --- | --- | --- |
| 4.6 | SEO | 8 | **9** | unknown paths 404; `/quality` real and in the sitemap; link depth still ≤ 2. Not 10: domain owner-gated |
| 4.7 | Performance | 8 | 8 | budgets enforced; no shipped byte reduction |
| 4.8 | UI/UX | 7 | 7 | hygiene enforced; no systematic per-route audit yet |
| 4.10 | Mobile | 8 | **9** | gated pages guarded; 52/52 |
| 4.12 | Observability | 7 | **8** | post-deploy chain wired; uptime target and backup dry run remain owner items |
| others | — | — | unchanged |

### GENERATOR YIELDS (cycle 8)

Inversion 1 (+ the /quality find) · Ops dry run 1 · Cost/perf (bytes &
requests, rewritten) 1 · Data honesty 1 · Accessibility sweep 1 · Regulator
walk 0 (articles read, clean) · Buyer walk / Competitor delta / Failure
injection not run.

### ESCALATIONS (owner-only; ranked — #1 leads until cleared)

Unchanged from cycle 7 (1: `verify:rls` on prod; 2: counsel items; 3: apply
`0031`–`0035`; 4: repo private; 5: domain; 6: lab data; 7: legacy
`products.js`; 8: webhook echo; 9: CSP font origins; 10: deploy hook; 11:
review backlog re-scan). **Heads-up for the next production deploy:** the
routing change makes mistyped product / category / article URLs return 404
(correct) — every route the app declares is covered by the routing gate.

### What I'd do differently

Calibrate a budget on the build the gate will actually run against — the
bytes ceilings were set on the CI production build and tripped on the E2E
build's PDP the first time the chain ran (the E2E build is also the more
honest number: it carries the runtime data calls). Run the routing
enumeration in cycle 2, when the crawl-depth claim was
first computed: `/quality` sat unlinked-in-the-graph for six cycles because
the graph only knew prerendered pages, and the footer link to it lived in
React, not the static nav. A page the app declares and the site links is a
claim (H-008) until a test proves it is served.

### PR DRAFT (open only on approval)

**Title:** Optimization cycle 8 — real 404s (and the never-prerendered /quality page), post-deploy smoke chain, bytes budget, hygiene gate

**Summary.** Five verified items on top of PR #39: (1) unknown paths are
real 404s — `vercel.json` rewrites only the client-side routes, the
generator emits `dist/404.html`, the local server follows the same rule,
and a routing gate proves every declared route is served; on the way the
Quality & Batch Standards page, linked since launch, turned out never to
have been prerendered — it is now a real page in the sitemap; (2) a post-
deploy workflow runs the server-gate specs against every successful
production deployment; (3) per-route bytes and request budgets in CI; (4) a
rendered-hygiene gate (no leaked `undefined` / `NaN` / placeholder text);
(5) a horizontal-overflow guard on the gated pages. +3 unit suites, +2
E2E-job steps, +1 workflow.

**Risks.** Routing: a path that is neither prerendered nor in the rewrite
list now returns 404 instead of the app shell — the gate enumerates every
`<Route>` in `src/App.jsx`; batch-history pages (`/test-results/:slug`) are
rewritten so they keep working on a build without database env. The post-
deploy workflow's first run is the next production deploy. No migrations,
no data, no payment / RLS / CSP files touched.

**Rollback.** Revert the branch.

---

## Cycle 9 — 2026-09-13 (addendum "Path to Ten", its "Cycle 2")

**HEAD before:** `5977b84` (main, Merge PR #40). **Branch:** `claude/opt-cycle-9-20260913`.
**Prompt:** the owner's addendum *Path to Ten* (version 2026-09-13) to
`noir-optimization-engine-fable51.md`. Where it conflicts with the base
prompt or this playbook, the addendum wins and the conflict is logged in
`PLAYBOOK.md` (§ Prompt conflicts). Its §C pre-authorizations are in force
for this cycle: C1 legacy deletion, C2 webhook envelope, C3 CSP font lines,
C4 workflows, C5 `evidence/`, C6 push + **Draft** PR without asking, C7
`code_name`, C8 admin screens (deferred to cycle 10). Everything else the
base prompt marks ask-before stays ask-before.

### RECON

Nothing landed on `main` since the cycle-8 merge. Build 79 routes / sitemap
73 / `404.html`; `test:unit` 62 suites / 1068 ✓ / 0 ✗; `npm audit` 0; lint 0
errors / **3 warnings** (`SEO.jsx:234` ×2, `UserContext.jsx:216`). Live site
still unreachable from the sandbox. `evidence/` does not exist.
`supabase/config.toml` does not exist (no CLI project). `ROTATION_CHECKLIST.md`
exists. `lighthouse` / `@lhci/cli` are not installed.

**The addendum diffed against reality (H-007).** It was written after cycle
1 and plans "Cycle 2 → 5". Eight cycles have merged since (PRs #33–#40).
Already in the tree — credited, not redone: internal-link depth ≤ 2 clicks
(c2), fonts self-hosted from tracked woff2 + preloads (c2; Hy-002 resolved by
measurement — only the CSP origins remain, see C3), axe-core sweep (c2) incl.
the gated pages (c7), keyboard-only checkout E2E + authenticated fixture
(c5), order-confirmation email tested (c5), server error ledger (c6),
post-deploy `test:e2e:prod` on production deployments (c8), real 404s +
routing gate (c8), rendered-hygiene crawl — dead links, lorem, "coming
soon", TODO, placeholder, empty `<main>` (c8), bytes & requests budget (c8),
`.env.example` complete + gated (c3), `prerender-meta.json` (Sept 11),
category posture executable (`soft_launch_hidden` + Control Room toggle +
rebuild hook), rate-limit coverage gate (c7), copy doors on every
admin-entered public text (c5–c7), static↔seed sync gate
(`test-seed-sync.mjs`), runbook current (c7).

**Premise corrections (H-007):**
- "The engine was blind — cannot download Chromium, cannot fetch Google
  Fonts." Chromium is pre-installed in this sandbox
  (`/opt/pw-browsers/chromium-1194`); screenshots, axe and E2E have run
  locally since cycle 2; fonts are self-hosted. The one real blind spot is
  the **live site** (egress to `*.vercel.app` / `noirpeptides.com` is
  blocked). So B2 (live probe in CI) is what gives the engine eyes; B1 is
  the durable, dated evidence trail.
- "4.14 unlocked when 4.1–4.5 ≥ 8 (now true)." 4.3 is **7** (db:verify never
  run anywhere but by hand). 4.14 stays gated until B3 lifts 4.3.
- The addendum's honesty rule is labelled "H-008"; that label is taken
  (structural claims are false until computed, cycle 2). Filed as **H-014**.
- Addendum "Cycle 2 / 3 / 4" = engine cycles **9 / 10 / 11**.

**Still missing — this cycle's scope:** B1 evidence workflow (screenshot
matrix, axe on every route, Lighthouse median-of-3 hard gate, crawl,
compact summary), B2 live probe (6-hourly, against `PROD_URL`, issue on
failure), B3 DB gates (the real `verify:rls` + `db:verify` need PostgREST +
GoTrue, not bare Postgres), B4 fallback reader, C1, C2, C3, C7, lint 0
warnings, §F reporting, H-014.

**Owner decisions taken before execution (asked, answered):**
1. Evidence lives on a dedicated orphan **`evidence` branch** (CI pushes
   compact JSON there; the engine fetches it at RECON). The addendum said
   "commit back to the PR branch"; C6 says never push to `main`, and the
   scheduled probe would have had to. Logged as a conflict.
2. Lighthouse is a **hard gate on the median of 3 runs**.
3. B3 runs the **Supabase CLI local stack** in a new `db-gates.yml`; the PG16
   ordering job in `ci.yml` stays.
4. C7 `code_name` ships on the **client, prerender and admin** surfaces; the
   server order-line path (`lib/pricing.js` nested select → persisted lines
   → emails) is ask-before and is escalated, not touched.

**Deviations from the addendum's text, logged (H-007 / H-011):**
- B1 serves `npm run build:e2e` through `scripts/serve-dist.mjs` (the
  Vercel-style server that applies the `vercel.json` rewrites and headers),
  not `npm run build` + `vite preview :4173`: `vite preview` uses neither, so
  screenshots / axe / Lighthouse would measure a transport the site never
  uses, and only the E2E build makes `/cart` and `/checkout` reachable.
- Lighthouse runs through `@lhci/cli` (same engine; adds median-of-N and
  assertions), pinned in the workflow via `npx`, **not** added to
  `package.json` — keeps `npm ci` and `npm audit` unchanged.
- B2 "sitemap URL count matches build": the probe job builds without DB env
  and asserts prod ≥ local (DB-sourced routes can only add), recording both.

### SCORE (before this cycle's work)

| # | Scorecard | Score | Blocks 9 (engine) |
| --- | --- | --- | --- |
| 4.1 | Legal | 9 | — (10 needs live scanner = 0 + counsel) |
| 4.2 | Security | 9 | webhook echo; `verify:rls` not CI-provable; fonts CSP |
| 4.3 | Data | 7 | `db:verify` not CI-provable; no static↔DB diff |
| 4.4 | Trust | 9 | — (COA upload / batch permalinks → cycle 10–11) |
| 4.5 | Commerce | 9 | — |
| 4.6 | SEO | 9 | — |
| 4.7 | Performance | 8 | no Lighthouse gate |
| 4.8 | UI/UX | 7 | no screenshot matrix / per-route notes |
| 4.9 | Accessibility | 9 | axe not on every route |
| 4.10 | Mobile | 9 | — |
| 4.11 | Admin | 9 | — (C8 screens → cycle 10) |
| 4.12 | Observability | 8 | no live probe / uptime target |
| 4.13 | Hygiene | 8 | 3 lint warnings; legacy `products.js` |
| 4.14 | Growth | — | gated (4.3 < 8) |

### PLAN (written before execution; one commit per item, in this order)

0. This entry + `PLAYBOOK.md` H-014 and the conflict log.
1. **[B1] `evidence.yml`** — E2E build served Vercel-style; screenshot
   matrix (sitemap + `/cart` + `/checkout`) × {320, 390, 768, 1280}; axe on
   every route (the existing sweep, `A11Y_ALL_ROUTES=1`); LHCI median-of-3
   hard gate on `/`, `/shop`, `/product/bpc-157`, `/test-results`; link-depth
   + hygiene crawls; `evidence/summary.json` → artifact + `evidence` branch.
2. **[B2] `live-probe.yml` + `scripts/live-probe.mjs`** — every 6 h against
   `PROD_URL`; the assertion list from the addendum (canonical host,
   `dbEnvPresent` — this executes Hy-001 —, CSP byte-equal to the builder,
   HSTS, nosniff, scanner hits = 0, sitemap ≥ local build, ≥ 1 COA row,
   rails envelope, real 404); axe + LHCI on prod; `live-probe.json` →
   `evidence` branch; single "Live probe failing" issue.
3. **[B3] `db-gates.yml`** — Supabase CLI stack in a scratch project
   (`0027_PROPOSED` excluded), `verify:rls` and `db:verify` unchanged, plus
   `scripts/db-shape-diff.mjs` (static ↔ DB rows).
4. **[B4] `scripts/evidence-latest.mjs`** — the sandbox reader; RECON rule.
5. **[C1]** delete `src/data/products.js` + audit script + CI step + docs.
6. **[C2]** webhook signature failure → `{ error: "invalid signature" }`.
7. **[C3]** CSP `style-src` / `font-src` without Google font hosts.
8. **[C7]** `0036_products_code_name.sql`; `displayName` mapping; shopper
   surfaces; prerender overlay; admin field + copy door; tests. Set on nothing.
9. **[4.13]** lint 0 warnings, `--max-warnings 0`.
10. §F report: ten-tracker, Owner Sprint D1–D12, provenance; docs; runbook.
11. Push + Draft PR (C6). The PR's own `evidence` / `db-gates` runs are the
    proof; red runs are fixed on the branch and the run URLs cited here.

Generators this cycle: Ops dry run (B1–B4), Failure injection (B3 on a fresh
stack; C2), Data honesty (C7 mapping, shape diff), Inversion (C1: "what
still imports a file nothing renders?"), Accessibility sweep (B1 every
route), Cost/perf — measurement lane (Lighthouse in CI).

### EXECUTION — results

| # | Item | Status | Evidence |
| --- | --- | --- | --- |
| 0 | Plan + H-014 + conflict log | **VERIFIED** | commit `24c786c`, written before any code |
| 1 | B1 evidence workflow | **VERIFIED locally; CI run pending** | `scripts/evidence-screens.mjs`: **308 views** (73 sitemap routes + age gate + cart + checkout steps 1–2, × 320/390/768/1280) in 228 s, 0 failing, 0 overflow; `a11y-sweep` with `A11Y_ALL_ROUTES=1` (82 routes × 2 widths + 6 gated views) **found two defects the 9-route sweep had never reached** — `/contact`: six form controls with unassociated labels (axe `label` + `select-name`, critical); `/about`: h1 → h3 — both fixed, both routes now clean; LHCI (median of 3, mobile simulation): `/` LCP **3122 ms**, `/shop` **3347**, `/product/bpc-157` **3167**, `/test-results` **3276**; CLS 0.000 everywhere; TBT 65 / 118 / 68 / 73 ms — **the LCP gate is RED on all four routes** (see 4.7); `evidence-summary.mjs` folds screens + axe + LHCI + link-depth + hygiene into `summary.json`; `evidence-publish.mjs` proven against a local bare remote: orphan branch created, second run "nothing new", dry run. `@lhci/cli` runs pinned via `npx` — no devDependency, `npm audit` unchanged |
| 2 | B2 live probe | **VERIFIED locally; prod run pending** | `scripts/live-probe.mjs` against the static server: **28 / 35** checks pass; the 7 misses are exactly the production-only checks (CSP/HSTS/nosniff headers, `dbEnvPresent`, `coaRowCount`, rendered COA rows, `/api/payment-rails`) — the script reports them honestly and exits 1; `--finalize` folds axe + Lighthouse and sets the verdict; the workflow keeps one "Live probe failing" issue (open / refresh / close). The scanner check uses the SAME extraction and negation allowlist as the dist gate (`scripts/_copy-scan.mjs`, shared) |
| 3 | B3 DB gates | **shape diff VERIFIED; workflow SUSPECTED until CI** | `scripts/db-shape-diff.mjs` against a fake PostgREST fed from the static catalog: in sync → exit 0 (44 products / 96 variants / 480 tiers); a changed price + a ghost product → exit 1 naming both. The Supabase-CLI job cannot run here (no Docker daemon) — its first run is on this PR; `supabase start --help` confirmed the `-x` names; `supabase_migrations` exposed to PostgREST so `db:verify`'s ledger check runs for real |
| 4 | B4 reader | **VERIFIED** | `scripts/evidence-latest.mjs`: branch absent → "none — score from local evidence only and say so"; branch present → verdict, date, age, sha, run URL, per-route Lighthouse, failing gates |
| 5 | C1 legacy deletion | **VERIFIED** | grep over js/jsx/mjs/json/yml: only the audit script imported the file; build green; suite green without it (1071 ✓ at that point); CI step + npm script + six doc mentions removed |
| 6 | C2 webhook envelope | **VERIFIED** | one statement changed; `test-error-envelopes` exception removed and replaced by an assertion |
| 7 | C3 CSP font origins | **VERIFIED** | builder no longer emits the hosts; `vercel.json` regenerated (byte-equal per `test-csp`); dead SW font-CDN branch removed; `test-fonts-selfhosted` asserts both |
| 8 | C7 `code_name` | **VERIFIED** | migration `0036` (nullable, 1–80 chars, writes nothing); `src/lib/displayName.js` is the one rule; three-step degrading selects (0036 → 0033 → base) in the client and the admin API; shop / cards / PDP / cross-sell / cart / checkout render the display name, certificate surfaces keep the substance name; prerender overlays code names at build (`codeNameCount` in `prerender-meta.json`, 0 here); Control Room row + copy door (real handler: use language → 400 naming `code_name`, nothing written; 81 chars → 400; markup → 400; clean → written trimmed; "" → null). `test-code-name.mjs` 32 ✓. Found on the way: `docs/SCHEMA.md`'s migration table had stopped at **0016** — completed through 0036 |
| 9 | Lint 0 warnings | **VERIFIED** | 3 → 0 (`SEO.jsx` effect keys on serialized `images` / `jsonLd` via a ref; `UserContext` fetch memoized); `eslint . --max-warnings 0` |

**Final gate on the finished tree:** build 79 routes / sitemap 73 / `404.html`
· lint **0 errors / 0 warnings (enforced)** · unit suite **1123 assertions**
(+55, +1 suite) · `build:e2e` → **E2E 33 passed / 4 skipped** · **mobile
52/52** · axe 0 critical / 0 serious / 0 landmark / 0 keyboard / 0 overflow
(default sweep, 24 page-views; all-routes sweep clean after the two fixes) ·
QR 8/8 · bytes & requests 15/15 · Lighthouse **LCP over budget on 4 / 4
routes** (CLS, TBT within budget). Runtime budget recorded (4.13): unit ≈
8 s · E2E 33 s · mobile 60 s · default axe ≈ 60 s · screenshot matrix 228 s
· LHCI 12 runs ≈ 4 min.

### SCORECARD DELTA (H-014: 9 = every local/CI check VERIFIED green; 10 = production-verified)

| # | Scorecard | Before | After | Why |
| --- | --- | --- | --- | --- |
| 4.1 | Legal | 9 | 9 | `code_name` is at the copy door; the live scanner check exists but has not run on prod |
| 4.2 | Security | 9 | 9 | C2 + C3 shipped; `verify:rls` is CI-runnable but the run is pending; not 10: prod `verify:rls`, repo public |
| 4.3 | Data | 7 | **8** | static↔DB shape diff written and proven; `db:verify` CI-runnable. 9 when `db-gates` is green on this PR |
| 4.4 | Trust | 9 | 9 | — |
| 4.5 | Commerce | 9 | 9 | — |
| 4.6 | SEO | 9 | 9 | live canonical / sitemap / robots checks exist, not yet run on prod |
| 4.7 | Performance | 8 | **7** | **corrected downward.** The first mobile-simulated Lighthouse run (4× CPU, slow-4G model) puts LCP at 3.1–3.4 s on all four gated routes; the earlier 8 rested on unthrottled local paint numbers. Nothing shipped for LCP this cycle — measurement only (H-013 lane) |
| 4.8 | UI/UX | 7 | 7 | the screenshot matrix exists (308 views); per-route review is cycle 11's item |
| 4.9 | Accessibility | 9 | 9 | axe now covers every route and found two real defects on routes the 9-route sweep never reached; both fixed; not 10: prod axe unproven |
| 4.10 | Mobile | 9 | 9 | — |
| 4.11 | Admin | 9 | 9 | code-name screen added; COA upload / flag screen / Owner Sprint panel are cycle 10 |
| 4.12 | Observability | 8 | 8 | live probe written, not yet run; 9 after its first run writes `live/latest.json` |
| 4.13 | Hygiene | 8 | **9** | lint 0 warnings enforced; legacy file gone; `.env.example` complete; runtime budget recorded; CI order build → unit → migrations → E2E → evidence → DB gates |
| 4.14 | Growth | — | **unlocked** | 4.1–4.5 ≥ 8 is now true (4.3 = 8); work starts cycle 11 per the roadmap |

### TEN-TRACKER (§F)

| Card | Score | Blocks 9 (engine) | Blocks 10 (owner) | Evidence (path · date) |
| --- | --- | --- | --- | --- |
| 4.1 Legal | 9 | — | live probe scanner = 0 on prod (needs D4 for the real host); attorney sign-off (D6) | local: `test-dist-copy`, `test-admin-copy-doors` · 2026-09-13 |
| 4.2 Security | 9 | first green `db-gates` run | D1 `verify:rls` on prod · D3 private · D12 rotate | local: `test-error-envelopes`, `test-csp` · 2026-09-13 |
| 4.3 Data | 8 | first green `db-gates` run | D2 apply 0031–0036, decide 0027 · `db:verify` clean on prod | local: `db-shape-diff` vs fake PostgREST · 2026-09-13 |
| 4.4 Trust | 9 | COA upload (c10), batch permalinks in sitemap (c11) | D5 labs / codes / PDFs | — |
| 4.5 Commerce | 9 | duplicate-submit E2E (c10) | D8 BTCPay live smoke | — |
| 4.6 SEO | 9 | — | D4 domain + `VITE_SITE_URL` + `CANONICAL_HOST`; Search Console | local: `test-link-depth`, `test-routing` · 2026-09-13 |
| 4.7 Performance | 7 | **LCP ≤ 2.5 s on the LHCI gate (3.1–3.4 s now)** | live Lighthouse within budget | local: `evidence/lighthouse` (LHCI, median of 3) · 2026-09-13 |
| 4.8 UI/UX | 7 | per-route notes from `evidence/screens` (c11) | D10 iPhone walk-through | local: 308 screenshots · 2026-09-13 |
| 4.9 Accessibility | 9 | — | live axe clean (first live-probe run) | local: all-routes sweep · 2026-09-13 |
| 4.10 Mobile | 9 | touch-target gate (c10) | D10 | local: mobile 52/52 · 2026-09-13 |
| 4.11 Admin | 9 | C8 screens (c10) | owner order dry-run | — |
| 4.12 Observability | 8 | first live-probe run | D11 backup/restore dry-run | — (workflow written; no run yet) |
| 4.13 Hygiene | 9 | — (9 = 10) | — | local: `npm run lint` 0/0 · 2026-09-13 |
| 4.14 Growth | — | unlocked; c11 foundations | first attributed repeat order | — |

### OWNER SPRINT STATUS (§D — ✅ only with evidence; none yet)

| # | Step | Status | How the engine will know |
| --- | --- | --- | --- |
| D1 | `npm run verify:rls` with prod keys (apply `0030` if unclean) | ⬜ | paste the output into the PR or `LAUNCH_READINESS.md`; the CI twin (`db-gates`) proves the script itself |
| D2 | Apply `0031`–`0036`, decide `0027` | ⬜ | `docs/MIGRATIONS_0032_0033.md`, `_0034.md`, `_0036.md`; then `npm run db:verify` clean |
| D3 | Repo private | ⬜ | GitHub → Settings → Danger zone |
| D4 | Domain + `VITE_SITE_URL` + repo variables `PROD_URL`, `CANONICAL_HOST` | ⬜ | the live probe's canonical / sitemap / robots checks go green on the real host |
| D5 | Labs → lookup codes + CAS per certificate; PDFs | ⬜ | Control Room → COAs (needs D2) |
| D6 | Attorney decision (categories; code names — now a data entry) | ⬜ | Control Room → Catalog → `soft_launch_hidden` / Code name |
| D7 | GLP-1 pricing | ⬜ | edit `tier1Catalog.js` → re-seed, or state the prices |
| D8 | BTCPay live smoke | ⬜ | one real invoice; `docs/LAUNCH_CHECKLIST.md` |
| D9 | Analytics posture (GA4-only or none) | ⬜ | Vercel env |
| D10 | iPhone walk-through | ⬜ | screenshots → `owner/<date>/` on the `evidence` branch, or attached to an issue |
| D11 | Backup / restore dry-run | ⬜ | date in `LAUNCH_READINESS.md` |
| D12 | Rotate per `ROTATION_CHECKLIST.md` (after D3) | ⬜ | tick list in the file |

### EVIDENCE PROVENANCE (§F)

Everything scored this cycle came from **sandbox runs dated 2026-09-13**
(this branch, Chromium 1194, the E2E build served Vercel-style). **No live
record** — the probe runs from `main` after merge (or by dispatch).

**First CI artifacts (added after PR #41's first runs, same day):**
- `Evidence` run 34758093351 on `7303688`: 308 screenshots in 184 s, axe **0
  findings on every route**, link-depth + hygiene pass, 336-file artifact,
  `ci/latest.json` pushed to the new `evidence` branch (read back through the
  API). Verdict **red on Lighthouse only** — medians `/` 3141 ms · `/shop`
  3637 ms + TBT 332 ms · PDP 2586 ms (runs 3490 / 2586 / 2291, the Hy-008
  bimodality) · `/test-results` 3305 ms; CLS 0. CI-verified scores: 4.9
  stays 9 (axe green on every route in CI), 4.7 stays 7, 4.8 stays 7.
- `DB gates` run 34758093345: the Supabase stack started and applied
  `0001 → 0036` (visible in the failure log), then every probe errored on a
  URL that carried quotes — `supabase status -o env` quotes its values and
  the workflow forwarded them (`Failed to parse URL from
  "http://127.0.0.1:54321"/rest/v1/profiles…`). Nothing was verified; a
  one-line `sed` fix follows on this branch. 4.2 / 4.3 move on that run's
  result, not on this one.
- `CI` run 34758093318: green (lint 0/0 enforced, 1123 assertions, E2E,
  migration hygiene).

### GENERATOR YIELDS (cycle 9)

Ops dry run 4 (B1–B4) · Accessibility sweep 1 (all-routes → 2 defects
fixed) · Data honesty 2 (`SCHEMA.md` migration table stale since 0016 —
completed; 4.7 corrected from 8 to 7 once measured properly) · Failure
injection 1 (shape-diff drift case; C2) · Inversion 1 (C1: "what still
imports a file nothing renders?") · Cost/perf measurement lane 1 finding, 0
shipped (LCP over budget) · Regulator walk 1 (code-name copy door) · Buyer
walk 0 (308 screenshots taken, not yet reviewed — cycle 11) · Competitor
delta not run.

### ESCALATIONS (owner-only; ranked — #1 leads until cleared)

1. **D1** `verify:rls` on prod (the CI twin now proves the script; only you
   can run it against the live keys).
2. **D2** apply `0031`–`0036` (`docs/MIGRATIONS_*.md`), decide `0027`.
3. **D3** repo private → then **D12** rotate.
4. **D4** domain + `VITE_SITE_URL`; set repository variables `PROD_URL` and
   `CANONICAL_HOST` so the live probe targets the real host.
5. **D6** counsel — categories; `code_name` is now a data entry per product.
   Two follow-on decisions: should certificate pages (`/test-results`,
   `/documents`) and **order records / emails** carry the code name? The
   order path lives in `lib/pricing.js` (ask-before) and was not touched.
6. **The Lighthouse LCP gate is red** (3.1–3.4 s vs 2.5 s, mobile
   simulation, all four routes). You chose a hard gate, so the `Evidence`
   check on this PR will show red until LCP moves. The engine's next cycle
   leads with it (levers measured, none shipped yet — see Hy-008).
7. D5 labs / codes / PDFs · D7 GLP-1 pricing · D8 BTCPay smoke · D9
   analytics · D10 iPhone · D11 backup dry-run · `VERCEL_DEPLOY_HOOK_URL` ·
   review backlog re-scan after `0035`.

### What I'd do differently

Measure under the production CLIENT's conditions, not only through the
production transport (H-011 extended): the 4.7 "8" survived seven cycles
because every local paint number was unthrottled; the first mobile-simulated
run cut it to 7 in one afternoon. Run every new eye BEFORE re-scoring the
card it looks at. And write new source with the gates' parsers in mind: an
apostrophe inside a block comment derailed `test-jsx-undefined`'s naive
string stripper for half an hour (Hy-009 opened to harden it).

### PR DRAFT (opened as a Draft per addendum C6)

**Title:** Opt cycle 9 — eyes for the engine (evidence, live probe, DB gates) + pre-authorized debt (C1–C3, code_name)

**Summary.** Three workflows give the engine dated evidence it could never
produce from the sandbox: `Evidence` (screenshot matrix, axe on every route,
Lighthouse median-of-3 hard gate, crawls → `evidence` branch), `Live probe`
(every 6 h against `PROD_URL`, one self-closing issue while red) and `DB
gates` (the real `verify:rls` / `db:verify` / a new static↔DB shape diff on a
fresh Supabase stack). Pre-authorized debt cleared: legacy `products.js`
deleted, webhook 400 is a generic envelope, CSP drops the Google Fonts
origins, `products.code_name` (migration 0036, set on nothing) renders on the
shop surfaces with a Control Room field behind the copy door. Lint is at zero
warnings and enforced. The all-routes axe sweep found and fixed two real
defects (`/contact` labels, `/about` heading order).

**Risks / honest state.** The `Evidence` check will be **red on this PR**:
the Lighthouse LCP budget (2.5 s) is missed on all four routes under mobile
simulation (3.1–3.4 s) — that is the gate doing its job; nothing was shipped
for LCP yet. `DB gates` runs for the first time here (Supabase CLI in CI). No
migration applied to live, no price / visibility / flag change, no
pricing / shipping / checkout-session / btcpay file touched.

**Rollback.** Revert the branch; migration 0036 is additive and unapplied.

---

## Cycle 10 — 2026-09-13 (addendum "Cycle 3 — ops to nine")

**HEAD before:** `32fe4c7` (cycle-9 branch, PR #41 open as a Draft — this
branch is stacked on it, as cycle 7 was on 6). **Branch:**
`claude/opt-cycle-10-20260913`.

### RECON

Read from the `evidence` branch (B4, first use): `ci/latest.json` for
`7303688` — verdict red on Lighthouse only; screens 308 / axe 0 / crawls
pass. `DB gates`' first run failed on a quoting bug in the workflow (fixed
in `32fe4c7`, re-run pending). Live probe: no record yet (runs from `main`).
Local: build 79 routes / sitemap 73; lint 0/0; unit 1123 ✓.

**Findings that shape this cycle (VERIFIED by reading, measured where
stated):**
- **4.7 — every LCP is text; the boot path is the cost.** `vendor-supabase`
  (44 KB transfer, 83 % unused on `/`) is in the entry closure only because
  `UserContext.jsx` imports the client statically and the provider mounts
  at boot. The `/` hero sits inside an unconditional 0.9 s framer-motion
  opacity fade. The two preloaded variable fonts total 72 KB with no
  `unicode-range`; the hero paragraph's mono face is not preloaded and
  arrives at 173–460 ms. `/shop` TBT 332 ms = 44 cards with per-card motion.
- **4.11 — no Storage upload exists anywhere**; `coas.file_url` is a plain
  `href` in four renderers and is baked into static HTML, so a signed URL
  can never be stored — a stable same-origin URL must redirect to a fresh
  one. No admin route is rate-limited. Feature flags: three, all default
  off, one parser. The Control Room shows env presence in exactly one place
  (the rebuild-hook copy).
- **4.11 — emails:** the shipped email exists (`sendOrderStatusEmail`) and is
  untested; an attestation receipt does not exist.
- **4.5 — the BTCPay rail passes no idempotency key** (ask-before file —
  escalated, not touched); step 1's Continue button has no double-submit
  guard; no behavioural double-submit test.
- **4.10 — the mobile suite has run locally every cycle and never in CI**;
  the tap-target check is a reporter, not a gate; seven keyframe classes
  ignore `prefers-reduced-motion`.

### SCORE (before this cycle's work)

As cycle 9's final table: 4.7 **7** (lowest), 4.8 7, 4.3 8 (→ 9 when
`db-gates` is green), 4.12 8, others 9; 4.14 unlocked.

### PLAN (written before execution; one commit per item, in this order)

1. **[4.7] LCP through the LHCI lane** (`scripts/perf-lhci.mjs`, same
   config and server as the CI gate; H-013): baseline, then one lever per
   build — (a) Supabase client out of the boot path (dynamic import in the
   hydration effect), (b) hero paints without the entry fade on first
   mount, (c) Latin subsets for the storefront faces (new files; the label
   embeds keep the originals), (d) `/shop` cards without above-the-fold
   motion. Keep a lever only if the median LCP drops with no CLS/TBT
   regression. The gate stays hard; 4.7 scores from CI.
2. **[4.11 C8a] COA file upload** → private `coa-files` bucket (migration
   0037, `coas.file_path`), `api/admin/coa-upload.js` (raw body ≤ 4 MB,
   magic-byte sniff PDF/JPEG, rate-limited), public `api/coa-file/[name].js`
   (published only → 302 to a 10-minute signed URL), Control Room upload
   controls, `storage` stub + harness tests.
3. **[4.11 C8b] Read-only feature-flag screen** (`api/admin/flags.js`, GET
   only, on/off never values; tab "Feature flags").
4. **[4.11 C8c] Owner Sprint panel** (`api/admin/owner-sprint.js`: D2/D5/D6
   from data, D4/D8/D9 env presence, the rest grey with the command; tab
   "Owner Sprint").
5. **[4.11] Emails to the gate:** test the shipped email; add an
   attestation-receipt email sent best-effort after a successful
   attestation record; corpus gate.
6. **[4.5] Duplicate submit:** step-1 Continue disabled while submitting +
   an E2E double-click spec (one request); delete the unused
   `api/payments/rails.js` after grep proof.
7. **[4.10] Mobile in CI** (`test:mobile` + E2E-job step), tap-target
   assertion (≥ 44 px) with fixes, reduced-motion wrap + spec.
8. **[4.11] RUNBOOK §6 → Owner Sprint**; `LAUNCH_READINESS.md`.
9. §F report from CI artifacts; PLAYBOOK (H-011 extended; Hy-008 numbers;
   Hy-009 closed while `AdminHome.jsx` is touched); push; Draft PR.

Generators: Cost/perf (bytes & requests) leads with four deterministic
levers; Ops dry run (C8 ×3, mobile in CI); Failure injection (upload sniff,
double submit); Regulator walk (attestation receipt copy); Accessibility
sweep (tap targets, reduced motion).

### EXECUTION — results

| # | Item | Status | Evidence |
| --- | --- | --- | --- |
| 1 | [4.7] LCP through the LHCI lane | **MEASURED, 0 shipped** | `scripts/perf-lhci.mjs` (same config + server as the CI gate). Baseline reproduced within 30 ms (`/` 3107 → 3097, `/shop` 3310 → 3313, PDP 3167 → 3140, `/test-results` 3279 → 3264; 3 vs 5 runs). Levers, each its own build: **A** Supabase client behind a dynamic import (+11 ms), **A2** + the cart context's static path cut so the entry no longer preloads `vendor-supabase` (+74 / +150 / +94 / +51), **A3** + import deferred to `load` (+81 / +151 / +84 / +36, 5 runs); **B** no entrance animation on first paint (+131 / +117 / +110 / −1); **C** Latin subsets: 34.6 → 32.3 KB and 36.1 → 34.3 KB for the variable faces, 9.8 → 8.4 KB per mono face — not a lever, dropped with its dependency; **E1** stylesheet hoisted to the top of `<head>` (+12 / −10 / −4 / +3); **E2** the three mono faces preloaded (+10 / **+130 / +291** / +27). Diagnosis (observed, unthrottled): the page is loaded by 89 ms; the largest paint lands at 469 ms on `/` (React's hero paragraph, after the age-gate paragraph at 180 ms) and at 165 ms on the PDP (prerendered text); a real CPU profile shows < 60 ms of script (Lighthouse's own tracing inflated `bootup-time`). Simulated LCP on `/` equals TTI in every run; the simulator charges every request started before the observed paint — the whole parse-time first wave — and credits nothing after it. The path to 2.5 s is structural (paint-first loader with a hashed inline script, shell parity, then the boot-closure diet) — Hy-008 carries the model; cycle 11 leads with it |
| 2 | [4.11 C8a] COA file upload | **VERIFIED** | migration `0037` (private `coa-files` bucket + `coas.file_path`); `api/admin/coa-upload.js` — rate-limited (first admin route to be), 4 MB cap enforced before buffering (413), magic-byte sniff (415 for text named `.pdf`; JPEG bytes sent as `application/pdf` are stored as a JPEG — the bytes decide), content-addressed path, row gets the stable `/api/coa-file/<id>.<ext>`; `api/coa-file/[name].js` — published only → 302 to a 10-minute signed URL, private/no-store, else 404. Control Room row per certificate. `scripts/test-coa-upload.mjs` 24 ✓ against a Storage stand-in |
| 3 | [4.11 C8b] Feature-flag screen | **VERIFIED** | `api/admin/flags.js` GET only: the three flags by name + on/off, never a value; tab "Feature flags"; `test-feature-flags` unchanged and green |
| 4 | [4.11 C8c] Owner Sprint panel | **VERIFIED** | `api/admin/owner-sprint.js`: D1–D12; D2 proven per migration by its column (7/7 on a migrated database, "missing: 0031 (coas.cas_number), …" on a pre-migration one), D5 by lab-linked / CAS / file counts on published certificates + labs with a template, D6 by code names + hidden categories, D4 / D8 / D9 by env presence (no value ever in the response — asserted); the rest grey with the command. `scripts/test-admin-screens.mjs` 20 ✓ pre- and post-migration |
| 5 | [4.11] Emails | **VERIFIED** | `orderStatusHtml` pure + tested (https-only tracking link, `javascript:` refused, escaping, RUO line); `attestationReceiptHtml` / `sendAttestationReceiptEmail` (version, timestamp, statements; no product names — asserted) sent best-effort from `api/attestation.js`; +13 assertions; corpus gate unchanged |
| 6 | [4.5] Duplicate submit | **VERIFIED** | ref guard + disabled/`aria-busy` Continue; `checkout-double-submit.spec.js`: two synchronous clicks → exactly one `POST /api/checkout-compliance`; busy state observable while the response is held. `api/payments/rails.js` deleted (grep: nothing called it). **Escalated:** BTCPay invoice creation passes no idempotency key (ask-before file) |
| 7 | [4.10] Mobile in CI, tap targets, reduced motion | **VERIFIED** | `npm run test:mobile` + E2E-job step (the suite had never run in CI); the tap-target reporter is a gate (44 px controls, 24 px inline text links, skip link exempt) — first run found **13 undersized links** across `/`, `/shop`, PDP, `/cart` → `/login` (footer columns 32 px, footer bar 33 px wide, landing legal links 17 px, shop "All" chip 26 px wide, PDP inline links 15 px, cookie-banner links 14 px, cart item link 18 px, login links 17 px, auth wordmark 18 px) — all fixed; text inputs/selects get the 44 px floor; seven keyframe classes disabled under `prefers-reduced-motion`; `reduced-motion.spec.js` (needed `page.emulateMedia` — a context-level `test.use` did not apply under the device profile). Mobile suite **56 / 56** |
| 8 | [4.11] RUNBOOK §6 → Owner Sprint; `LAUNCH_READINESS.md` | **VERIFIED** | D1–D12 with the screen or command; the tab named as the live source |
| — | Hy-009 (JSX gate stripper) | **RESOLVED** | a quote after a word character is prose; the gate still resolves every component |

**Final gate on the finished tree:** lint 0 / 0 · build 79 routes / sitemap
73 · unit **1181 assertions** (+58; +2 suites) · `build:e2e` → **E2E 35 passed /
4 skipped** (+2) · **mobile 56 / 56** (+4, now in CI) · axe 0 / 0 / 0 / 0 · QR 8/8
· bytes 15/15 · LHCI local medians unchanged (`/` 3.1 s · `/shop` 3.3 · PDP 3.1
· `/test-results` 3.3 — the gate stays red).

### SCORECARD DELTA (H-014)

| # | Scorecard | Before | After | Why |
| --- | --- | --- | --- | --- |
| 4.2 | Security | 9 | 9 | **`verify:rls` now proven in CI** on a fresh stack (DB gates run #2 green on `32fe4c7`, PR #41); still not 10: prod run, repo public |
| 4.3 | Data | 8 | **9** | `db:verify` + the static↔DB shape diff green in CI on the full migration chain (0001 → 0036) |
| 4.4 | Trust | 9 | 9 | COA upload path exists; batch-history permalinks in the sitemap are cycle 11; 10 is owner data (D5) |
| 4.5 | Commerce | 9 | 9 | duplicate-submit proven; BTCPay idempotency escalated; 10 = live smoke (D8) |
| 4.7 | Performance | 7 | 7 | measured, not moved; the model is now known (Hy-008); gate red |
| 4.8 | UI/UX | 7 | 7 | 308 screenshots exist; per-route review is cycle 11 |
| 4.9 | Accessibility | 9 | 9 | axe green on every route in CI; reduced motion asserted |
| 4.10 | Mobile | 9 | 9 | suite in CI; tap-target gate + 13 fixes; 10 = owner iPhone sign-off (D10) |
| 4.11 | Admin | 9 | 9 | C8 ×3 + emails; 10 = owner order dry-run |
| 4.12 | Observability | 8 | 8 | live probe still unrun (runs from `main` after PR #41 merges) |
| 4.13 | Hygiene | 9 | 9 | — |
| others | — | — | unchanged (4.1 9, 4.6 9, 4.14 unlocked) |

### TEN-TRACKER (§F)

| Card | Score | Blocks 9 (engine) | Blocks 10 (owner) | Evidence (path · date) |
| --- | --- | --- | --- | --- |
| 4.1 Legal | 9 | — | live scanner = 0 on the real host (D4); counsel (D6) | CI: `ci/latest.json` 7303688 · 2026-09-13 |
| 4.2 Security | 9 | — | D1 · D3 · D12 | **CI: DB gates run 34774411540 green** · 2026-09-13 |
| 4.3 Data | 9 | — | D2 (apply 0031–0037), `db:verify` on prod | CI: DB gates run 34774411540 · 2026-09-13 |
| 4.4 Trust | 9 | batch permalinks in sitemap (c11) | D5 | local: `test-coa-upload` 24 ✓ · 2026-09-13 |
| 4.5 Commerce | 9 | — | D8 (+ BTCPay idempotency key, ask-before) | local: `checkout-double-submit.spec` · 2026-09-13 |
| 4.6 SEO | 9 | — | D4 | CI: `ci/latest.json` (links, hygiene) |
| 4.7 Performance | 7 | **LCP ≤ 2.5 s on the LHCI gate** (paint-first loader + shell parity, c11) | live Lighthouse | local: `evidence/lhci-*` (7 builds) · CI 7303688 |
| 4.8 UI/UX | 7 | per-route notes from `evidence/screens` (c11) | D10 | CI artifact 336 files |
| 4.9 Accessibility | 9 | — | live axe (first probe) | CI: axe 0 on every route |
| 4.10 Mobile | 9 | — | D10 | local: mobile 56/56 → CI on this PR |
| 4.11 Admin | 9 | — | owner order dry-run | local: `test-admin-screens` 20 ✓ |
| 4.12 Observability | 8 | first live-probe run | D11 | — (workflow on `main` after #41) |
| 4.13 Hygiene | 9 | — (9 = 10) | — | lint 0/0 · 2026-09-13 |
| 4.14 Growth | — | c11 foundations | first attributed repeat order | — |

### OWNER SPRINT STATUS (§D)

Unchanged from cycle 9: **D1–D12 all ⬜** — nothing evidenced yet. What
changed: the **Control Room → Owner Sprint tab** now shows each step's live
status (green / partial / grey) with its command or screen, so the next
report can cite it instead of assuming. D2's list now ends at **0037**.

### EVIDENCE PROVENANCE (§F)

- **From CI (read through the `evidence` branch and the Actions API):**
  `ci/latest.json` for `7303688` (Evidence run 34758093351: screens 308 /
  184 s, axe 0, crawls green, Lighthouse red on LCP); **DB gates run
  34774411540 green** on `32fe4c7` after the one-line quoting fix —
  `verify:rls`, `db:verify` (44 / 8 / 96 / 480 / 96 + ledger) and the shape
  diff on the full chain. These are the CI-verified facts behind 4.2, 4.3,
  4.9 this cycle.
- **From this sandbox (2026-09-13):** everything in the gate above, the
  seven LHCI builds under `evidence/lhci-*` (ignored, not committed — the
  medians are in the table and in Hy-008).
- **Live:** none yet.

### GENERATOR YIELDS (cycle 10)

Ops dry run 4 (C8 ×3, mobile in CI) · Accessibility sweep 2 (tap-target
gate → 13 fixes; reduced motion) · Failure injection 3 (upload sniff + cap,
double submit) · Regulator walk 1 (attestation receipt) · Data honesty 2
(Owner Sprint from data only; 4.7 measured rather than asserted) · Cost/perf
measurement lane: 7 builds measured, **0 shipped** (the honest result) ·
Buyer walk / Competitor delta not run.

### ESCALATIONS (owner-only; ranked)

1. **D1** `verify:rls` on prod — the CI twin is green; only the production
   run remains.
2. **D2** apply `0031`–`0037` (`docs/MIGRATIONS_0037.md` is new), decide `0027`.
3. **D3** repo private → **D12** rotate.
4. **D4** domain + `VITE_SITE_URL`; repo variables `PROD_URL`, `CANONICAL_HOST`.
5. **Merge PR #41** (cycle 9) so the live probe starts running from `main`
   — 4.12's next step depends on it; this cycle's PR is stacked on it.
6. **BTCPay idempotency key** on invoice creation (`api/btcpay/create-invoice.js`,
   ask-before): `checkoutIdempotencyKey({ rail: "btcpay", … })` exists;
   without it a double submit on the crypto rail mints two invoices.
7. **The Lighthouse LCP gate stays red** — the structural fix (paint-first
   loader; a hashed inline script in the strict meta CSP) is cycle 11's lead
   item; say if you would rather relax the gate meanwhile (the engine will not).
8. D5 · D6 (also: should certificate pages carry code names?) · D7 · D8 · D9 ·
   D10 · D11 · `VERCEL_DEPLOY_HOOK_URL`.

### What I'd do differently

Read the observed timeline before touching bytes: the first four levers
were chosen from the waterfall's sizes; the fifth minute of looking at the
observed LCP candidates and the simulated-equals-TTI pattern explained all
of them. One diagnosis call before any experiment, every time. And keep
test files free of hoisted imports of env-dependent modules — the unit
chain crashed on a static import placed above the placeholders.

### PR DRAFT (opened as a Draft per addendum C6, base = the cycle-9 branch)

**Title:** Opt cycle 10 — ops to nine: COA upload, flag + Owner Sprint screens, emails, double-submit guard, mobile in CI; LCP measured (0 shipped)

**Summary.** The addendum's "Cycle 3". Three Control Room screens
(certificate file upload through a private bucket + signed redirect; a
read-only feature-flag screen; an Owner Sprint tab whose statuses come only
from data), the shipped email tested and an attestation receipt added, one
compliance record per Continue (guard + E2E), the mobile suite in CI with a
tap-target gate (13 links fixed) and reduced-motion proof, RUNBOOK §6 →
Owner Sprint. Performance: five LCP levers measured through the Lighthouse
gate, none shipped; the measurement lane (`scripts/perf-lhci.mjs`) and the
model are in the log for cycle 11.

**Honest state.** The `Evidence` check stays red on the LCP budget (by
design — hard gate). `DB gates` is green on the cycle-9 head. No migration
applied to live (0037 is additive and unapplied), no price / visibility /
flag change, no pricing / shipping / checkout-session / btcpay file touched.

**Rollback.** Revert the branch.

---

## Cycle 11 — 2026-09-13 (addendum "Cycle 4 — polish to nine everywhere + growth foundations")

**HEAD before:** `24900d9` (cycle-10 branch, PR #42 Draft, stacked on #41).
**Branch:** `claude/opt-cycle-11-20260913`, stacked on cycle 10.

### RECON

- **CI on #42:** CI green (incl. the mobile step); DB gates green; Migration
  hygiene was red on `0037` (bare Postgres has no `storage.buckets`) — guarded,
  green expected on the re-run; Evidence red on Lighthouse only (CI medians
  `/` 2968 · `/shop` 3285 · PDP 2746 · `/test-results` 3276 ms). #41: DB gates
  green on run #2. Both PRs carry one engine comment naming the LCP gate.
- **The mechanism, measured (H-012), unthrottled at 390 px:**

  | route | JS blocked: LCP candidate at FCP | with JS: what wins |
  | --- | --- | --- |
  | `/` | shell `<p>` 26,496 px² at 116 ms | React hero `<p>` **29,991** px² at 484 ms (larger) |
  | `/shop` | shell `<p>` 26,358 px² | React RUO `<p>` **32,791** px² at 416 ms (larger) |
  | `/product/bpc-157` | shell `<p>` **54,003** px² | nothing larger — the shell should win, but it never gets a frame |
  | `/test-results` | shell `<p>` 35,154 px² | React `<p>` **40,464** px² at 400 ms (larger) |

  With JS present the shell is replaced before the first frame is presented
  (the first candidate with JS is the cookie banner's paragraph at 72 ms), so
  the observed LCP is always React's paint and the simulator charges the
  whole pre-paint request graph to it. Two conditions make the paint the
  shell's: the JS wave must start **after** the first frame, and each shell
  paragraph must be **at least as large** as React's largest above-the-fold
  text on that route (the PDP already is — it is the route nearest the
  budget in CI, 2586 ms).
- **From the screenshot matrix (cycle 9 run, 4.8 notes in the log's plan):**
  consent dialog covered every fold (fixed in the matrix; product fix F2
  below); PDP spec rows show "—" for sequence / MW / CAS on all 44 (the
  static catalog and the 0009 seed carry none by design; 12 verified values
  exist in the retired 0001 rows); About/Deals `whileInView` blanks (matrix
  fixed); checkout summary at the bottom on mobile; cart badge 1 vs 4.
- **Growth (4.14) reality:** the routed checkout sends no `redeemPoints` /
  `discountCode` while the account page promises points; partner pricing is
  dormant schema; `api/partners/apply.js` has no page; restock is done but
  source-grep-tested only; no scheduler writes to the site.
- **Tokens (4.8):** `tailwind.config.js` is dead (a different brand, zero
  references), `src/input.css` unreferenced, three dead `--font-family-*`
  `@theme` lines, hex values duplicated between `:root` and `@theme`; 37 hex
  / 9 rgba / 23 arbitrary-colour literals and 737 `text-[…]` sizes in JSX.

### PLAN (written before execution; one commit per item, in this order)

1. **[4.7] Paint-first loader + shell parity**, measured through
   `scripts/perf-lhci.mjs` (5 runs), shipped only on a win: `public/boot.js`
   (external `src` script — the only loader shape the CSP gate lets through;
   waits two frames, then appends the modulepreloads and the module script);
   the generator strips Vite's entry tag + vendor preloads from the template
   and feeds the per-route chunk list to the loader; shell paragraphs sized
   ≥ React's (`/`, `/shop`, `/test-results`), `/shop`'s intro un-drifted via a
   shared constant, the hero disclaimer in the `/` shell; tests updated
   (route-preload extractor, routing's 404 literal, bytes +1 request, SW
   install list).
2. **[4.4] Specs — verified only:** the 12 transcribed values (from the retired
   0001 rows) into the static catalog + an update-only migration `0038`;
   Control Room fields for sequence / MW / CAS (format-validated); the panel
   omits empty rows; `test-product-specs` reports the count; the other 32 are
   owner data (D5b in the Owner Sprint).
3. **[4.4/4.6] Batch-history permalinks in every build** from a static mirror of
   the 19 seeded certificates; PDP ↔ permalink links in the crawlable HTML;
   sitemap 73 → 88.
4. **[4.14] Growth foundations:** executed loyalty-coherence test + the spend
   path wired on step 2 (client only); `/partners` request page on the existing
   endpoint; executed restock test; abandoned-cart nudge + draft template
   behind a default-off flag; tokens audit (dead config removed, ratchet test,
   `docs/DESIGN_TOKENS.md`).
5. **[4.8] UI:** consent as a bottom sheet at ≤ 640 px; checkout summary strip;
   cart-badge investigation; re-shot matrix + per-route notes.
6. §F report, PLAYBOOK, docs, full gate, push, Draft PR (C6).

Generators: Cost/perf (bytes & requests) leads with a *structural* change
measured through the gate; Data honesty (specs never fabricated; 12
transcribed, 32 escalated); Buyer walk (the matrix notes); Failure injection
(loader fallback when rAF never fires); Regulator walk (wholesale + cart copy).

### EXECUTION — results

| # | Item | Commit(s) | Result |
| --- | --- | --- | --- |
| 1 | [4.7] Paint-first loader + shell parity | `7f8958c` | **Shipped on a measured win** (5 runs, LHCI lane): `/` 3097 → 1366 ms · `/shop` 3313 → 1862 · PDP 3140 → 1503 · `/test-results` 3264 → 1504; CLS 0; TBT flat. Final tree re-measured below. `public/boot.js` is an external `src` script — the only loader shape the CSP gate admits (H-015); no CSP edit. |
| 2 | [4.4] Specs, verified only | `f7e02c5` | 11 products with transcribed sequence / MW / CAS (TB-500 excluded: the retired row annotated parent-protein values; CJC-1295 has no CAS in the source). `0038_product_specs.sql` update-only, byte-generated; panel omits unknown rows; Control Room fields format-validated; Owner Sprint **D5b** counts coverage (11 / 44 → owner data). |
| 3 | [4.4/4.6] Batch permalinks in every build | `a6082e5` | `src/data/coaSeed.js` mirrored from migration 0019 (19 rows, 15 products; byte-compared); `/test-results` + 15 permalinks + PDP certificate cards in env-less builds; `coaSource: "db" \| "seed"` in `prerender-meta.json`; crawlable "Full batch history" link on every PDP with certificates. Sitemap 73 → 88. |
| 3b | QR chunk on first paint | `50bd5e1` | The seeded cards mounted `QrCode`, which eagerly imported the encoder; `test-bytes-budget` caught it. Import now waits for the card to come within 200 px of the viewport (probed: 0 requests at load, 1 on scroll, image renders). |
| 4a | [4.14] Loyalty coherence | `3f12405` + `84f671e` | One redemption rate (`src/utils/loyalty.js`, imported by `lib/rewards.js` and every spend control; the hard-coded "100 pts = $5" is gone); 38 executed assertions on the real `computeAdjustments` / `validateLoyaltyRedemption` / `validateDiscount`; pricing proven identity-blind (partner pricing dormant, ask-before); spend path on step 2 posts `discountCode` / `redeemPoints` as hints, never dollars; balance hydrated from `profiles.loyalty_points`; E2E spec (350 pts → 100/200/300; 40 pts → no select). The step-2 helper text failed axe contrast at 3.88:1 on first sweep — fixed. |
| 4b | [4.14] `/partners` | `8b40481` | Wholesale / institutional request page on the existing `POST /api/partners/apply` (which turned a SAVED application into a 500 when RESEND was unset — email now best-effort); logistics copy only, one accepted negation; prerendered + linked + preloaded; executed handler test (honeypot, 400s, column mapping, 405). |
| 4c | [4.14] Restock proof | `9266023` | `notifyBackInStock` executed through the real PATCH handler with an observable email stub: 18 assertions (flip-only, variant vs product scope, one-shot `notified`, cap 200, unconfigured/failing transport, audit log). Stub fix: row COPIES — the old stub returned the fixture object and hid every before/after comparison. |
| 4d | [4.14] Cart recovery, default off | `91718b4` | `VITE_FEATURE_CART_RECOVERY` (fourth flag; documented-not-set; read-only on the flags screen); client nudge reads CartContext only, never the checkout draft; `cartReminderHtml` drafted with no sender (a server-sent reminder needs a write-capable scheduler → escalated). |
| 4e | [4.8] Design tokens | `99d1b15` | `tailwind.config.js` (another brand, zero references) + `src/input.css` deleted; `:root` is the single hex source, `@theme inline` maps onto it; four dead tokens removed; gate with a literal ratchet (hex 37 · rgba 9 · arbitrary 26 · palette re-typed 6); computed colours identical before/after (13 selectors, 0 diffs); CSS −572 B. |
| 5 | [4.8] UI from the matrix | `035ba9c` (+ cookie offset) | F2 consent sheet 331 → 271 px at 390 (39 % → 32 %) and clear of the 52 px bottom nav; F4 checkout summary strip + jump link; F5 not reproducible (executed: badge 1 throughout); F6 card chips one wrapping row (they collided), tighter padding, form line hidden < 480 px, real "✓ COA · lot" chips (24 px targets; date hidden < 480). Card 386 → 359 px; `/shop` 11 291 → 10 554 px. |
| 5b | CI follow-ups on PR #44 | `753056c`, `629128c` | axe: 24 px batch-history links, underlined permalink link, key routes widened (+`/product/glow`, `/test-results/bpc-157`, `/partners`); `/shop` TBT: eight animated cards + content-visibility, 128 → 64 ms locally. Vercel: `vercel.json` `git.deploymentEnabled.evidence=false` + skip-build file written into the evidence branch. |
| 6 | Report, PLAYBOOK, docs, gate, PR | this commit | below |

**Matrix (re-shot on the final tree, 4.8 per-route notes):**
Re-shot twice on the final tree (`scripts/evidence-screens.mjs`, 372 views = 89
sitemap routes + 4 gated views × 4 widths; 0 failing, 0 horizontal overflow,
0 console errors). Fold shots now wait for hydration (the first re-shoot
caught the raw pre-hydration document on a product page — that frame is
what a slow device sees for ≈0.4–1 s, so it is now styled as a branded frame;
nothing hidden). Per-route notes, 390 px unless stated:
- **`/`** — wordmark, overline, one paragraph, two CTAs, legal links. No change.
- **`/shop`** — chips no longer collide; cards 359 px tall, page 10.5k px
  (was 11.3k); the 15 products with published certificates show a real
  "✓ COA · lot" chip instead of "COA on request". The 44-card grid is still a
  long scroll: the density lever left (a label-preview thumbnail per card) is
  measured separately next cycle.
- **`/product/bpc-157`** — back link, render, IDENTITY / PURITY / BATCH tabs,
  category overline, name, description, price, size chips above the fold;
  certificate cards further down with a QR that loads only when scrolled
  to; "Full batch history" and "All certificates" links are 24 px targets.
  Technical specification rows render only for known values (11 products).
- **`/test-results`, `/test-results/<slug>` (15)** — the certificate table and
  counters are prerendered from the mirrored seed and hydrate without a
  swap (CLS 0); the in-paragraph product link is underlined.
- **`/partners`** (new) — overline, heading, intro, eligibility and
  no-guidance paragraphs, the form on its own card; axe clean.
- **`/checkout` step 1** — RUO banner, "Signed in as", then the new summary
  strip ("1 item · Subtotal $44 · Shipping calculated at payment · VIEW
  SUMMARY") above the contact card; the jump lands the summary card at the
  top of the viewport.
- **`/checkout` step 2** — payment rails, then the promo input and (with a
  balance) the points select, fulfilment statements, Back / Complete
  payment; helper text at full steel contrast.
- **`/cart`, `/about`, `/deals`, `/faqs`, `/contact`, `/documents`,
  `/legal/*`, `/research/*`** — unchanged; the About / Deals `whileInView`
  blanks of the cycle-9 matrix are gone (the matrix scrolls through before
  the full-page shot).
- **First visit** — the age gate is the covering dialog (required, 21+); the
  cookie sheet, once the gate is passed, is 271 px tall and clears the
  bottom nav.

**Final-tree LHCI (median of 5, same lane as CI):**
| route | cycle 10 (CI, `main` 37f01ad) | cycle 11 B1 (loader + parity) | **final tree** (specs, seeded certificates, cards, tokens, shell frame) | budget |
| --- | --- | --- | --- | --- |
| `/` | 3130 ms | 1366 ms | **1505 ms** · TBT 33 · CLS 0 · perf 100 | ≤ 2500 |
| `/shop` | 3630 ms | 1862 ms | **1872 ms** · TBT 128 · CLS 0 · perf 98 | ≤ 2500 |
| `/product/bpc-157` | 3482 ms | 1503 ms | **1503 ms** · TBT 53 · CLS 0 · perf 100 | ≤ 2500 |
| `/test-results` | 3308 ms | 1504 ms | **1503 ms** · TBT 40 · CLS 0 · perf 100 | ≤ 2500 · CLS ≤ 0.1 |

The first final-tree run showed `/test-results` at **CLS 0.263** (over the
gate): with seeded rows in the HTML and the loader, React mounted the page as
"Loading…" and refilled it when the fetch resolved, moving the footer twice.
Fixed by hydrating the page from the mirrored rows (`getSeedCoas()`), re-run:
CLS 0. `evidence/lhci-cycle11-final2/`, local, mobile simulation, 5 runs per
route, median.

**CI, first Evidence runs on PR #44 (`ci/latest.json` for `cb08150`, run
34784572145):** LCP **passes on all four routes** — `/` 1657 · `/shop` 1509 ·
PDP 1510 · `/test-results` 1512 ms (the H-014 CI proof); screens 372 / 0
failing; crawls green. Two reds, both fixed on the branch afterwards:
`/shop` TBT 228 ms (budget 200; runners are slower than the sandbox) → eight
animated cards + `content-visibility` below the fold, 128 → **64 ms**
locally (5 runs, LCP/CLS unchanged); axe 40 serious on surfaces the seed
mirror made visible in CI for the first time (`target-size` on the PDP
batch-history links, `link-in-text-block` on the 15 permalink pages) →
fixed, and the local key-route sweep widened so it cannot miss them again.
`/` is bimodal on the local lane (1.37–1.5 s or ≈1.85 s across runs; always
under budget) — noted, not chased.

**CI, final (head `72b80dc`, Evidence run 34789025447, 23:29Z): GREEN.**
LCP `/` 1659 · `/shop` 2047 · `/product/bpc-157` 1510 · `/test-results`
1514 ms (budget 2500); CLS 0; TBT 51 / 135 / 135 / 82 ms (budget 200);
screens, axe (all routes), link and hygiene crawls green. With `CI`
(lint · unit · build, migration hygiene, E2E + mobile), `DB gates` and
GitGuardian green on the same head, PR #44 is fully green — the first
green Evidence run since the gate was created in cycle 9.

**CI, second finding (E2E job, mobile step, run 34787382668):** 12 mobile
failures that the local mobile runs had not shown — because the local runs
went through `serve-dist` while CI's `test:mobile` uses `vite preview`
(H-011, again). Under preview the page hydrates *after* the tests' first
measurements: (1) the service worker never registered — `main.jsx` waited
for the window `load` event, which had already fired by the time the
paint-first loader ran the module (a real production regression of B1:
no offline shell on a fast load) → register immediately when
`document.readyState === "complete"`; (2) the tap-target gate on the
certificate surfaces (card COA chip 131×28, "View certificate image"
167×20, "Verify this lot" 71×17, the PDP batch-history links, the inline
"enter or scan a lot number" link) → 44 px controls / 24 px line box; the
"COA on request" placeholder now has the chip's height and the shop grid
seeds its certificate map synchronously so the price row never wraps
after first paint; (3) the bottom-nav "footer above the bar" spec scrolled
the un-hydrated shell → it waits for the hydrated footer. Mobile suite
under `vite preview`: 56/56. Lever B (`content-visibility`) was reverted
along the way — an instant scroll to the end landed short of the real
page height; the hoisted certificate map (one state update instead of 44)
replaced it: `/shop` TBT 100 ms locally (5 runs), LCP/CLS unchanged.

**Vercel:** every pushed code head deploys ("Deployment has completed" on
the cycle 9, 10 and 11 heads); the failed deployments the owner saw were
the orphan `evidence` branch (a push per Evidence run, no site). Fixed
twice over: `git.deploymentEnabled.evidence=false` in `vercel.json` and a
skip-build `vercel.json` written into the evidence branch by the
publisher (landed 22:00Z). Owner-side durable option: the project's
"Ignored Build Step" — escalated.

### SCORECARD DELTA (H-014)

| # | Scorecard | Before | After | Why |
| --- | --- | --- | --- | --- |
| 4.4 | Trust | 9 | 9 | permalinks + certificate cards in every build, real COA chips on cards, 11 verified spec sets; still 9: 33 spec sets and every 10-condition are owner data (D5, D5b) |
| 4.5 | Commerce | 9 | 9 | the spend path exists and is proven; BTCPay idempotency still escalated; 10 = live smoke (D8) |
| 4.6 | SEO | 9 | 9 | sitemap 73 → 89 with crawlable batch history; 10 = D4 |
| 4.7 | Performance | 7 | **9** | **CI Evidence green on head `72b80dc`** (run 34789025447: LCP `/` 1659 · `/shop` 2047 · PDP 1510 · `/test-results` 1514 ms, CLS 0, TBT ≤ 135 ms — every hard budget met); with CI, DB gates, hygiene, E2E and mobile all green on the same head this is the H-014 nine. 10 = live Lighthouse on the real host (D4 + a recorded live-probe run) |
| 4.8 | UI/UX | 7 | **8** | per-route review done from a re-shot matrix, four defects fixed, tokens single-sourced and gated; 9 = a second clean review pass after the owner's iPhone walk (D10) |
| 4.11 | Admin | 9 | 9 | spec fields + D5b; unchanged otherwise |
| 4.12 | Observability | 8 | 8 | the live probe is on `main` since #41 merged but has no green run recorded in `evidence/live/` yet (no repo variables set) |
| 4.14 | Growth | — | **7** | foundations executed (loyalty coherence, wholesale request, restock proof, cart recovery flagged off); 8 = first real wholesale application or redemption observed; 9 = attributed repeat order |
| others | — | — | unchanged (4.1 9, 4.2 9, 4.3 9, 4.9 9, 4.10 9, 4.13 9) |

### TEN-TRACKER (§F)

| Card | Score | Blocks 9 (engine) | Blocks 10 (owner) | Evidence (path · date) |
| --- | --- | --- | --- | --- |
| 4.1 Legal | 9 | — | live scanner = 0 on the real host (D4); counsel (D6) | CI: `ci/latest.json` 37f01ad (main) · 2026-09-13 |
| 4.2 Security | 9 | — | D1 · D3 · D12 | CI: DB gates green on #41/#42 heads · 2026-09-13 |
| 4.3 Data | 9 | — | D2 (apply 0031–0038), `db:verify` on prod | CI: DB gates · local `test-coa-seed-sync`, `test-product-specs` |
| 4.4 Trust | 9 | — | D5 · D5b (33 spec sets) | local: `test-prerender-coverage` (seed branch), sitemap 89 · 2026-09-13 |
| 4.5 Commerce | 9 | — | D8 (+ BTCPay idempotency key, ask-before) | local: `test-pricing-coherence` 38 ✓, `checkout-rewards.spec` 2 ✓ |
| 4.6 SEO | 9 | — | D4 | local: link-depth, routing, jsonld-shapes on 95 pages |
| 4.7 Performance | 9 | — | live Lighthouse (D4 + first probe) | **CI: Evidence run 34789025447 green** (`ci/latest.json` for the #44 head, 2026-09-13 23:29Z) · local: `evidence/lhci-*` 5-run medians |
| 4.8 UI/UX | 8 | second review pass | D10 | local: `evidence/screens` re-shot 2026-09-13 |
| 4.9 Accessibility | 9 | — | live axe (first probe) | local sweep 0/0 after two fixes · CI on the PR |
| 4.10 Mobile | 9 | — | D10 | CI: mobile 56/56 under vite preview (E2E job, run 34789025458) · local 56/56 |
| 4.11 Admin | 9 | — | owner order dry-run | local: `test-admin-screens` (13 rows) · `test-back-in-stock` 18 ✓ |
| 4.12 Observability | 8 | a recorded green live-probe run | D4 (`PROD_URL` / `CANONICAL_HOST`), D11 | `evidence/live/latest.json`: **none** |
| 4.13 Hygiene | 9 | — (9 = 10) | — | lint 0/0 · unit chain green · 2026-09-13 |
| 4.14 Growth | 7 | first observed redemption / application (data, not code) | attributed repeat order | local: the four executed tests above |

### OWNER SPRINT STATUS (§D)

**D1–D12: none evidenced** (`evidence/live/latest.json` absent; no DB gate on
prod; no repo variables). What moved: **#41 merged** (the live probe now
exists on `main` — it needs `PROD_URL` / `CANONICAL_HOST` to target the real
host); D2's list ends at **0038**; **D5b** is a new Owner Sprint row
(specs: 11 / 44 products carry sequence · MW · CAS — the other 33 are yours
to enter in the Control Room catalog editor, never the engine's to invent);
**D10** now has a re-shot matrix to walk against. The Control Room → Owner
Sprint tab shows each row's live status.

### EVIDENCE PROVENANCE (§F)

- **From CI (read through `scripts/evidence-latest.mjs` at RECON):**
  `ci/latest.json` for `37f01ad` (**main**, Evidence run 34780258445 —
  red on Lighthouse only: LCP 3130 / 3630 / 3482 / 3308 ms, CLS 0, axe 0,
  crawls green). This is the pre-cycle-11 baseline on `main`; the cycle-11
  PR's Evidence run is the proof that 4.7 crosses to 9.
- **From this sandbox (2026-09-13):** every number in the tables above,
  `evidence/screens/*` re-shot on the final tree, `evidence/lhci-*` medians
  (ignored, not committed).
- **Live:** none (`evidence/live/latest.json` absent — the probe has not
  recorded a run; set the repo variables so it targets the real host).

### GENERATOR YIELDS (cycle 11)

Cost/perf 1 (the lead item: a structural change measured through the gate,
shipped on a win after ten cycles of "measured, not moved") · Data honesty 3
(transcribed specs / TB-500 excluded; seeded certificates, never synthetic;
COA chips only from real rows) · Buyer walk 4 (matrix at 390: chips, sheet,
summary strip, chip clipping) · Regulator walk 2 (wholesale copy; cart
reminder draft) · Failure injection 3 (loader fallback; restock transports;
QR chunk on a page that never scrolls) · Ops dry run 2 (spec fields + D5b;
restock end to end) · Inversion 2 (dead config; dead tokens) · Accessibility
sweep 2 (contrast, target size — both on brand-new surfaces) · Competitor
delta not run.

### ESCALATIONS (owner-only; ranked)

1. **PR #43** (cycle 10, unchanged; #42 was closed by GitHub when the
   cycle-9 branch was deleted) → then **this cycle's PR**, stacked on it.
   Merge order: #43, then cycle 11.
2. **D4** repo variables `PROD_URL` / `CANONICAL_HOST` — the live probe is on
   `main` now and runs every 6 h against the default `*.vercel.app` host until
   they are set; 4.12 cannot move without a recorded run.
3. **D2** apply `0031`–`0038` (`0038` is update-only, 11 rows; `docs/MIGRATIONS_0038.md`).
4. **D5b** enter sequence · MW · CAS for the 33 products without them
   (Control Room → Catalog; format-validated). Verify TB-500 and CJC-1295
   with the supplier before entering — the engine would not transcribe them.
5. **D1** `verify:rls` on prod · **D3** repo private → **D12** rotate.
6. **BTCPay idempotency key** (`api/btcpay/create-invoice.js`, ask-before) — unchanged.
7. **Partner pricing** — dormant by design and now *asserted* dormant; turning
   it on touches `lib/pricing.js` (ask-before). Say if you want a proposal.
8. **Cart reminder email** — the template exists, nothing sends it; a
   server-sent version needs a write-capable scheduled workflow (the only
   cron is the read-only live probe). Decide whether you want it at all.
9. **Code names on order lines** (`lib/pricing.js`) — unchanged.
10. **Vercel project setting** — the evidence-branch deployments are stopped
    in code (both `vercel.json`s); the durable owner-side setting is the
    project's "Ignored Build Step" / Git branch filter, if you prefer it there.
11. D6 · D7 · D8 · D9 · D10 (walk the re-shot matrix) · D11 · `VERCEL_DEPLOY_HOOK_URL`.

### What I'd do differently

Look at the gate before the fix (H-015): the CSP gate settled the loader's
shape in one read, after cycle 10 had planned a hashed inline script. And
never trust a harness that returns its own fixture objects: the restock
before/after comparison was invisible until the stub returned copies —
half a cycle of "it works" tests could have been written against that.
The seed mirror also changed a production behaviour the E2E build had never
exercised (the QR encoder on first paint); the bytes gate caught it, which
is what gates are for.

### PR DRAFT (opened as a Draft per addendum C6, base = the cycle-10 branch)

**Title:** Opt cycle 11 — LCP under 2 s (paint-first loader), verified specs, certificates in every build, growth foundations, matrix fixes

**Summary.** The addendum's "Cycle 4". Performance moved on a structural
change measured through the Lighthouse lane (all four gated routes
3.1–3.3 s → 1.4–1.9 s); 11 verified spec sets with an update-only migration;
the 19 published certificates mirrored so trust pages and permalinks render
in every build; loyalty coherence executed and the spend path restored;
`/partners`; restock proven; cart recovery flagged off; design tokens
single-sourced; four matrix defects fixed.

**Honest state.** 4.7 is 8 until the CI Evidence run on this PR is green.
No migration applied to live (0038 unapplied), no price / visibility /
flag change (the new flag defaults off), no pricing / shipping /
checkout-session / btcpay file touched.

**Rollback.** Revert the branch.

---

## Cycle 12 — 2026-09-14 (addendum "Cycle 5+ — hold at nine; promote to ten only from live evidence")

**HEAD before:** `a04f331` (`main`; PR #43 merged cycles 10 + 11 at 01:41Z after the owner merged
#44 into the cycle-10 branch). **Branch:** `claude/opt-cycle-12-20260914` from `main`.

### RECON

- **Evidence at start (`scripts/evidence-latest.mjs`):** `ci/latest.json` **green** for `a04f331`
  on `main` (run 34796722607: LCP 1511 / 1656 / 1509 / 1509 ms, CLS 0, TBT ≤ 156 ms, screens 372 / 0,
  axe 0, crawls green). `live/latest.json`: **none** — 0 live-probe runs (cron `17 */6` had one slot
  since the workflow reached `main`; GitHub cron is best-effort). Post-deploy smoke: **16 runs, every
  production one failed in 2 s** — the gate has never executed (see below).
- **Method (ultracode):** RECON ran as a workflow (`noir-cycle12-recon`, run `wf_23d8d950-8f2`):
  8 lens readers (correctness, compliance/data honesty, security, performance, a11y/mobile,
  hold-at-nine, growth/UI, ops/docs) over the merged tree → 63 findings → each judged by 3
  adversarial verifiers (reproduce · already-covered · scope-and-value; majority rules) → 61
  confirmed, 2 refuted → one synthesizer ranked them into 20 items. 198 agents, 11.5 M tokens,
  78 min. Provenance: the journal under the session's `subagents/workflows/wf_23d8d950-8f2/`.
- **Pre-verified by hand (primary sources) before planning:**
  1. `api/_utils/auth.js:142` — `tier.startsWith("partner_")` makes `partner_pending` (the tier
     `api/partners/apply.js` sets for any signed-in applicant) pass `requirePartner`. Real.
  2. `scripts/generate-static-seo.mjs` — every category/route decision reads
     `getVisibleCategories()` from the STATIC catalog; the Control Room's
     `product_categories.soft_launch_hidden` flip + rebuild never reaches the prerender. Real.
  3. Post-deploy smoke run 34796753523 on `a04f331`: `Error: https://noir-peptides-…vercel.app is
     already used … set reuseExistingServer:true` — `playwright.config.js` always starts
     `vite preview` even with a remote `E2E_BASE_URL`, so 0 tests have ever run against production.
     Also learned: Vercel reports the production deployment as a per-deployment URL
     (`noir-peptides-<hash>-sryle-eternal.vercel.app`), not a stable alias.
  4. Purity: `src/lib/catalog.js:45` `purity_percent: 99` for every static product (and 0009 seeds
     `99.0`), rendered as "≥ 99% PURE" / "≥ 99% (HPLC)" on every card, PDP and the specs panel that
     promises "what is verified and nothing else" — while the site's own published certificates
     say KPV 98.54 %, Semax 98.80 %, Tesamorelin 98.49 %. A seeded constant presented as a
     measurement and contradicted by the site's own data: hard-rule territory (4.4 / 4.1), missed by
     the cycle-11 specs pass. The cycle leads with it.
  5. `node scripts/live-probe.mjs` against a local production build: 21/35 — every failure is a
     local-vs-Vercel delta (canonical host, security headers, `dbEnvPresent`, the rails API), so the
     probe's code path is sound; but its expected canonical host defaults to the probed host, so the
     first real run is red on nine checks unless `CANONICAL_HOST` is set. Fixed this cycle.
- **Not covered by this RECON (carry to cycle 13):** anything on the live hosts (sandbox egress);
  StepPersonal / AiChat / admin runtime a11y; `api/btcpay/*`, `api/stripe-webhook.js` beyond the
  body destructure (ask-before); `sw.js` navigation caching writes every route's HTML into the
  `/index.html` shell slot (pre-existing, unverified); other public forms (contact, concierge,
  research upload) for the same upsert / 200-on-failure / log-object patterns; the repo variables
  `PROD_URL` / `CANONICAL_HOST` are not readable via API.

### SCORE (before this cycle's work)

All cards as reported at the end of cycle 11 (4.7 = 9 on the green CI run; 4.14 = 7; 4.8 = 8;
4.12 = 8). Two of the confirmed findings would move cards DOWN under H-014 if left: the purity
constant (4.4 → 8, arguably 4.1) and the never-executed production smoke (4.12's cycle-8 row was
scored on a gate that had not run). Both are corrected in this cycle's delta, honestly.

### PLAN (written before execution; one commit per item, in this order)

1. **[4.4 / 4.1] Purity only from a published certificate.** Static fallback `purity_percent: null`;
   card chip, PDP badge/COA panel row and the specs panel render the LATEST PUBLISHED certificate's
   HPLC value (`98.54 % (HPLC, lot …)`) or nothing; `Home.jsx` hard-coded "≥ 99%" strings removed;
   the PDP's per-product "Methods: HPLC / MS" / "Endotoxin: LAL tested" lines become
   certificate-derived or generic. Migration `0039_null_seeded_purity.sql` (update-only, apply is
   ask-before) + `docs/MIGRATIONS_0039.md`. Gate: no rendered purity value without a matching
   published row; `test-dist-copy` asserts no "≥ 99" in dist. 0009 stays as history (never edited).
2. **[4.2 / 4.14 / 4.9] Partner application hardening.** No blind upsert on email (existing
   approved/rejected → untouched; another user's row → no write, no leak; signed-in → keyed by
   user; resubmission refreshes only the free-text fields); a failed store is a 502 envelope, never
   "received"; profile → `partner_pending` only on a NEW row and never for an approved partner;
   scrubbed logs; capped fields; `requirePartner` no longer accepts `partner_pending`; the success
   heading takes focus. Executed tests for each case + an E2E.
3. **[4.12] Post-deploy smoke actually runs.** `playwright.config.js` omits `webServer` for a
   remote `E2E_BASE_URL`; config test; `workflow_dispatch` input on `post-deploy.yml`; first executed
   run cited (the earlier "VERIFIED" cycle-8 row corrected).
4. **[4.12 / 4.5 / 4.6] Live probe:** expected canonical host = `CANONICAL_HOST` || the site's
   configured production host (localhost only when probing localhost); a `rails available` check
   (≥ 1 payable rail); sitemap floor from `prerender-meta.json` counts instead of a CI-build
   constant; host-config checks grouped in the issue body; first record via manual dispatch after
   merge.
5. **[4.6 / 4.1] Soft-launch hides reach the rebuild:** the generator unions the DB column with
   the static flags when DB env is present; `prerender-meta.json` lists hidden categories; the
   probe asserts no hidden-category product in the live sitemap; RUNBOOK sentence corrected.
6. **[4.14] Referral program real end-to-end:** referral input on step 2 posting `referralCode`
   (a hint; both rails already consume it); `GET /api/account/referral-code` issues the server
   code on demand; the account page shows the server code, never a locally generated one.
7. **[4.5 / 4.2] Loyalty deduction atomic:** compare-and-swap update (`.eq("loyalty_points",
   read)`) with one retry, a `redeem_shortfall` ledger row instead of a silent clamp; migration
   `0040_loyalty_nonnegative.sql` (check constraint NOT VALID; apply ask-before). Executed
   concurrency test through the fulfilment harness.
8. **[4.9 / 4.7 / 4.4] ProductCard without link-in-link** (stretched link, chip as a sibling) and
   ONE certificate source for `/shop` (the filter/compare column reads the same map as the chips);
   request budget −1; a render test that no `<a>` nests in an `<a>`.
9. **[4.7 / 4.9] Shell parity on the 8 category pages and 15 permalinks**, permalink hydration
   from the seed (CLS), shell links underlined, LHCI gate +3 URLs (`/shop/tissue-repair-research`,
   `/test-results/bpc-157`, `/partners`), measured through `perf-lhci` before shipping.
10. **[4.7] Shell-parity gate** `scripts/test-shell-parity.mjs` (JS blocked → largest text block
    area vs hydrated) in the E2E job.
11. **[4.9 / 4.10] Checkout a11y:** step change moves focus to the step heading; payment error is a
    live region; `#order-summary` focusable and focused by the jump link; programmatic scrolls
    honour reduced motion (`src/lib/motion.js`). Specs extended.
12. **[4.10 / 4.9] CartRecoveryNudge** clears the bottom nav (same offset as the consent sheet),
    region semantics, focus destination on dismiss, suppressed while consent is open; a flag-on
    mobile spec in its own lane (the flag stays off everywhere documented).
13. **[4.9 / 4.1] AgeGate** takes, traps and restores focus; the page behind is inert; a keyboard
    E2E without the ack seed.
14. **[4.11 / 4.3 / 4.13] D2 proves 0038**, `db:verify` gains a per-migration feature-presence
    section (columns via PostgREST HEAD; 0038 via the spec-row count), a migration-doc convention
    gate for every migration ≥ 0032, RUNBOOK §1/§6 + checklist to 0038.
15. **[4.13 / 4.5 / 4.4 / 4.6] Owner-doc drift sweep:** the Copilot "auth wall" block rewritten
    (catalog is public — hard rule), `PAYMENTS_STRIPE_LIVE_ACK` documented and surfaced on the
    Owner Sprint D8 row (presence only), dead `STRIPE_US_SHIPPING_RATE_ID` removed, spec counts
    11 / 33 everywhere, "verified" → "transcribed" for the 0001-sourced specs, tracker cells,
    0019 header; a doc-drift test.
16. **[4.3 / 4.4] COA storage hygiene:** replaced objects removed on re-upload; `lookupByLot` seed
    fallback; mirror rows carry no synthetic `created_at`; migration `0041_coa_bucket_limits.sql`
    (apply ask-before).
17. **[4.2] Evidence / live-probe workflows split** into a read-only job and a write-only publish
    job (`contents: write` never runs PR-branch code).
18. **[4.11 / 4.14] Control Room Partners tab** shows every application field and lets the owner
    pick the tier on approve.
19. **[4.13 / 4.7] Hygiene:** dead client loyalty helpers deleted (the second earning rate), the
    modulepreload bound split (route vs vendor).
20. **[4.7] Measured-only probes** (ship on a win, else the number goes in the log): Plex Mono
    preload; plain cards + `memo(ProductCard)` for `/shop` TBT.
21. §F report, PLAYBOOK, docs, full gate the way CI runs it (mobile under `vite preview`,
    all-routes axe, `perf-lhci`), push, Draft PR (C6), watch CI, post-deploy + live-probe dispatch.

Deferred to cycle 13 (confirmed, not planned, to keep the cycle finishable): `text-[…]` typography
scale + ratchet (767 sites); shop card density lever; account "Points activity" ledger + a Control
Room redemptions StatCard; `dist/app.html` for the SPA fallback (no PublicLanding preload on
client-only routes); the ProductDetail label double-fetch; `sw.js` navigation-cache shell slot.

Generators: Inversion + adversarial verification (the workflow) led; Data honesty (purity, spec
provenance wording); Failure injection (partner rebind, concurrent redemption, remote-URL smoke);
Ops dry run (D2 proof, doc drift); Accessibility sweep (five keyboard/SR gaps on the money path);
Cost/perf measurement lane (parity, gate coverage, two probes).

### EXECUTION — results

| # | Item | Commit | Result |
| --- | --- | --- | --- |
| 1 | Purity only from a published certificate | `4fde8f5` | Static fallback null; card chip, PDP badge, certificate panel (purity / methods / endotoxin), traceability methods, specs panel, shop compare + sort read the LATEST PUBLISHED certificate or show nothing; Home's "≥ 99%" strings removed; migration 0039 (apply ask-before). Gate: `test-purity-honesty` (react-dom/server renders; no "≥ 99%" literal in src). |
| 2 | Partner application hardened | `0709f0c` | Insert, never upsert-by-email; existing rows untouched by anyone but their account (free-text only, while pending); failed store → 502; profile → partner_pending only on a new row; scrubbed logs; capped fields; `requirePartner` rejects `partner_pending`; success heading focused. 18 executed cases + E2E. |
| 3 | Post-deploy smoke can run | `618467f` | No Playwright webServer for a remote base URL (both configs; 3-branch config test); `workflow_dispatch` input. The first executed record is produced after merge (§ below). |
| 4 | Live probe | `2a6c4f6` | Canonical host from `lib/siteUrl.js`; `rails available`; sitemap floor from build metadata; hidden-category check; host-config grouped in the issue. Local run 31/37 (the six reds are Vercel-only). |
| 5 | Soft-launch hide reaches the rebuild | `7f676d5` | Generator unions the DB flag with the static one; `hiddenSource` in meta; gate on the sitemap. |
| 6 | Referral program real | `254a466` | `GET /api/account/referral-code` issues the server code; UserContext hydrates it; referral input on step 2 posts the hint; executed endpoint + resolution tests; E2E. |
| 7 | Atomic loyalty deduction | `3f4098e` | Compare-and-swap with one retry; shortfall ledger rows; migration 0040 (apply ask-before). Race test: exactly one of two deducts. |
| 8 | Card without link-in-link; one COA source | `e50f9f1` | `<article>` + stretched name link (44 px); chip a sibling; the facet/compare column and chips share one map; /shop −1 request. |
| 9 | Parity on 23 more pages; parity gate; 7 gated URLs | `2aa74dd` | Category pages + permalinks carry parity; permalinks hydrate from the seed; shell links underlined; `test-parity` in the E2E job (12 families, first run caught 3); LHCI +3 URLs. |
| 10 | Shell-parity gate | (in 9) | `scripts/test-shell-parity.mjs`. |
| 11 | Checkout a11y | `fc6d225` | Step heading focus, live-region errors, focusable summary target, reduced-motion scrolls (`src/lib/motion.js`); specs. |
| 12 | Cart nudge | `b2b4e58` | Bottom-nav offset, region semantics, consent wait, focus on dismiss; flag-on CI lane + spec. |
| 13 | Age gate focus | `7ad7134` | Takes / traps / hands over focus; inert page; first-visit keyboard E2E. |
| 14 | D2 proves 0038–0041; db:verify feature presence; migration-doc gate | `776e3fb` | Data probes for the update-only migrations; `test-migration-docs` enforces the convention for every migration. |
| 15 | Owner-doc drift sweep | `81d5933` | Copilot "auth wall" rewritten (catalog public); Stripe live-ack documented, dead shipping variable gone; 11/33; "transcribed"; `test-doc-drift`. |
| 16 | COA storage hygiene | `e4d244d` | Replaced objects removed; `lookupByLot` seed fallback; honest mirror ids; migration 0041 (apply ask-before). |
| 17 | Workflows split | `79bbf4c` · `a89ca82` | PR-branch code runs with `contents: read`; only the publish job writes. Follow-up from the first CI runs on #46: the publish jobs ran `always()` and failed on a missing artifact after a superseded push cancelled the build — now `!cancelled()` (a red build still publishes; a cancelled one never does). |
| 18 | Partners tab | `dd6f617` | Every field; tier select validated against `lib/partnerTiers.js`. |
| 19 | Hygiene | `b4e1527` | Dead client loyalty helpers deleted (gated); preload bound split (route ≤ 20, vendor ≤ 8). |
| 20 | Measured levers (4.7) | `26a2c20` · `063c339` · `8422c1c` · `7f4d91a` | The first 7-URL lane on the finished tree was **red twice** — PDP LCP median 2706 ms (runs 1502 / 2706 / 2849 on one build) and `/shop` TBT 205 ms. Read per run (H-017): observed LCP = observed FCP in 21 of 21 runs (the shell paragraph never lost), so the flip lived in the simulation — the two-frame trigger issued the bundle request 5–30 ms before the observed paint and Lighthouse charged the bundle to first paint whenever that request finished first; the same flip is in cycle 11's own numbers (`/` 1503 / 1505 / 1504 / 1851 / 2161). Four levers, each built and measured on its target routes (`perf-lhci --urls`, 5 runs): **L1** the loader starts on the `first-contentful-paint` entry → 15 / 15 runs request after the paint, sim FCP a constant ~1205 ms, LCP 1503–1659 on every run, TBT unchanged; **L2** an identical live answer no longer replaces seeded state + the PDP settles in one batch → React scripting −8 – 13 %, TBT medians within ±10 ms; **L3** `memo(ProductCard)` + plain frames past the fold → `/shop` TBT 192 → 167, PDP 159 → 129; **L4** the initial render as a transition (time-sliced) → `/shop` 167 → **77**, PDP 129 → **32**, `/test-results` 111 → **53**; LCP, CLS and TTI unchanged by all four. Not measured this cycle: the Plex Mono preload (the per-run reading showed the font was not the cause; the remaining 150 ms LCP step 1503 → 1655 is the font wave — a cycle-13 measured-only probe). **L1 refined by the gate (`588bb50`):** the E2E lane read `/verify-lot` 1.5 s early — a client-only route's prerendered shell has nothing to paint, so the paint entry never came and the app waited for the timer; the loader now waits for the paint only on a shell with content and starts an empty shell on frames (the seven gated URLs all have shells; the request-after-paint property is unchanged there). |

**Lighthouse levers (`scripts/perf-lhci.mjs`, this sandbox, same session; LCP · TBT in ms, CLS 0 throughout):**

| build | `/shop` | `/product/bpc-157` | `/test-results` | note |
| --- | --- | --- | --- | --- |
| finished tree, 7-URL lane, 3 runs (`evidence/lhci-cycle12-parity`) | 1503 · **205** | **2706** · 138 | 1504 · 171 | two red; PDP runs 1502 / 2706 / 2849 |
| L1 loader on the paint entry, 5 runs (`lhci-c12-L1`) | 1655 · 190 | 1652 · 153 | 1506 · 120 | no run over 1659; request after paint 15 / 15 |
| + L2 no redundant render, one settled batch (`lhci-c12-L2`) | 1654 · 192 | 1653 · 159 | 1505 · 111 | scripting −8 – 13 % |
| + L3 memoised card, plain frames past the fold (`lhci-c12-L3`) | 1654 · 167 | 1654 · 129 | — | motion 123–155 → 96–115 |
| + L4 initial render as a transition (`lhci-c12-L4`) | 1655 · **77** | 1653 · **32** | 1506 · **53** | longest task 180–270 → 90–140 |

**Lighthouse lane, final tree (7 URLs, median of 3):**
`evidence/lhci-cycle12-final` (default E2E build, serve-dist, mobile simulation, 3 runs per URL, 340 s):

| URL | LCP | TBT | CLS | perf | every run |
| --- | --- | --- | --- | --- | --- |
| `/` | 1655 ms | 3 ms | 0 | 100 | LCP 1655–1659 · TBT 2–31 |
| `/shop` | 1652 ms | 36 ms | 0 | 100 | LCP 1505–1653 · TBT 33–63 |
| `/product/bpc-157` | 1654 ms | 60 ms | 0 | 100 | LCP 1653–1655 · TBT 55–100 |
| `/test-results` | 1504 ms | 34 ms | 0 | 100 | LCP 1504–1508 · TBT 29–36 |
| `/shop/tissue-repair-research` | 1653 ms | 10 ms | 0.009 | 100 | LCP 1653–1654 · TBT 8–15 |
| `/test-results/bpc-157` | 1654 ms | 5 ms | 0 | 100 | LCP 1507–1655 · TBT 4–15 |
| `/partners` | 1653 ms | 6 ms | 0 | 100 | LCP 1653–1658 · TBT 2–7 |

No run on any URL outside the budgets (LCP ≤ 2500 · TBT ≤ 200 · CLS ≤ 0.1); the first lane on the same items had two red medians and runs at 2.7–2.85 s (item 20). The CI Evidence run on the PR is the H-014 proof.

**Full gate (the way CI runs it):**
Second pass on the finished tree (the first pass caught three things, all fixed and re-run: the copy scan on the category shells, the E2E read of an empty-shell route 1.5 s early, the sweep's skip-link check after the age gate's new focus handover — `588bb50`, `40b5f8c`). Logs under the session scratchpad `gate2/`.

| lane | how CI runs it | result |
| --- | --- | --- |
| lint | `npm run lint` (`--max-warnings 0`) | 0 errors · 0 warnings |
| unit chain | `npm run test:unit` (incl. `test-coa-state`, `test-purity-honesty`, `test-partner-apply`, `test-dist-copy`, `test-route-preload`) | green, every script |
| shell parity | `node scripts/test-shell-parity.mjs` (12 families) | all pass |
| QR round trip · bytes & requests | `npm run test:qr` · `node scripts/test-bytes-budget.mjs` | all pass |
| E2E (Chromium) | `npx playwright test` against serve-dist | **41 / 41** |
| mobile | `npm run test:mobile` under `vite preview`, no `E2E_BASE_URL` | **58 / 58** (cart-nudge skipped by design: flag off) |
| all-routes axe | `A11Y_ALL_ROUTES=1 node scripts/a11y-sweep.mjs` (+ 6 authed views) | 0 critical / serious · 0 landmark · 0 keyboard (age-gate handover + skip link on 3 routes) |
| flag-on lane | `VITE_FEATURE_CART_RECOVERY=1 npm run build:e2e` + `cart-nudge.spec` under `vite preview` | 1 / 1; default build restored after |
| Lighthouse | `perf-lhci cycle12-final --runs 3` (7 URLs, the gate's config) | table above, all green |

### SCORECARD DELTA (H-014)

| # | Scorecard | Before | After | Why |
| --- | --- | --- | --- | --- |
| 4.1 | Legal | 9 | 9 | a seeded purity constant presented as a measurement (hard-rule territory) is gone from every surface; the age gate takes / traps / hands over focus; the catalog stays public (the Copilot "auth wall" text corrected) |
| 4.2 | Security | 9 | 9 | partner application: no upsert-by-email, no cross-account write, 502 on a failed store, `partner_pending` no longer passes `requirePartner`; loyalty deduction atomic; PR-branch code never runs with `contents: write` |
| 4.3 | Data | 9 | 9 | D2 proves 0038–0041 by data; `db:verify` feature presence; migration-doc gate; storage objects removed on re-upload |
| 4.4 | Trust | 9 | 9 | **honest note:** at RECON this card was an 8 — every card and product page printed "≥ 99 % PURE" from a seeded constant the site's own certificates contradicted (KPV 98.54 %, Semax 98.80 %, Tesamorelin 98.49 %); the cycle-11 nine was scored over that defect. Item 1 makes purity certificate-only (or absent) and gates it; 9 holds on this cycle's evidence. 10 stays owner data (D5, D5b: 33 spec sets) |
| 4.5 | Commerce | 9 | 9 | referral code issued server-side and posted from step 2; compare-and-swap redemption with a shortfall ledger; BTCPay idempotency still escalated; 10 = live smoke (D8) |
| 4.6 | SEO | 9 | 9 | a Control Room hide now reaches the rebuild (sitemap + prerender); the live probe asserts it; canonical host from one constant; 10 = D4 |
| 4.7 | Performance | 9 | 9 | the nine now rests on a **deterministic** lane: the loader race that flipped the median for two cycles is fixed (H-017), hydration is time-sliced (TBT 205 / 138 / 171 → 77 / 32 / 53 locally), seven URLs gated; the CI Evidence run on this PR is the H-014 proof. 10 = live Lighthouse on the real host |
| 4.8 | UI/UX | 8 | 8 | card without link-in-link, nudge above the bottom nav, consent-aware; the second clean review pass still waits on D10 |
| 4.9 | Accessibility | 9 | 9 | six keyboard / screen-reader gaps on the money path closed and gated (step focus, live errors, summary target, reduced-motion scrolls, nudge region + focus, age-gate trap); all-routes axe 0 / 0 |
| 4.10 | Mobile | 9 | 9 | nudge clears the bottom nav; checkout summary jump focuses; mobile suite under `vite preview` green (see gate) |
| 4.11 | Admin | 9 | 9 | Partners tab shows every field, tier validated; D2 row proves the update-only migrations by data |
| 4.12 | Observability | 8 | **7** | **corrected down (H-014 / H-016):** the cycle-8 "post-deploy smoke VERIFIED" row was scored on a gate that had never executed — all 16 production runs died in 2 s on a Playwright config check. The config is fixed here (both configs omit `webServer` for a remote URL; dispatch input), the live probe is hardened (canonical host, rails, sitemap floor, hidden categories) and the workflows split read / write — but **no executed production smoke and no live-probe record exist yet**. 8 = the first executed post-deploy run on the merged head; 9 = a green live probe on the real host (D4) |
| 4.13 | Hygiene | 9 | 9 | lint 0 / 0; dead loyalty helpers gone; doc-drift, migration-doc and preload-bound gates; 11 / 33 and "transcribed" everywhere |
| 4.14 | Growth | 7 | 7 | referral real end to end, partner flow hardened and reviewable with a tier; still 7 by the stated criterion — no observed application or redemption (data, not code) |

### TEN-TRACKER (§F)

| Card | Score | Blocks 9 (engine) | Blocks 10 (owner) | Evidence (path · date) |
| --- | --- | --- | --- | --- |
| 4.1 Legal | 9 | — | live scanner = 0 on the real host (D4); counsel (D6) | local: `test-purity-honesty`, `test-dist-copy`, corpus gate · 2026-09-14 |
| 4.2 Security | 9 | — | D1 · D3 · D12 | local: `test-partner-apply` (18 cases), `test-rewards` race · CI: DB gates on this PR |
| 4.3 Data | 9 | — | D2 (apply 0031–**0041**), `db:verify` on prod | local: `test-migration-docs`, `test-coa-seed-sync`, `test-coa-state` · CI: DB gates + migration hygiene |
| 4.4 Trust | 9 | — | D5 · D5b (33 spec sets) | local: `test-purity-honesty` (certificate-only purity), `test-prerender-coverage` · 2026-09-14 |
| 4.5 Commerce | 9 | — | D8 (+ BTCPay idempotency key, ask-before) | local: `test-referral-code`, `test-rewards`, `test-pricing-coherence`, `checkout-rewards.spec` |
| 4.6 SEO | 9 | — | D4 | local: link-depth, routing, jsonld-shapes; generator hidden-category gate |
| 4.7 Performance | 9 | — | live Lighthouse (D4 + first probe) | **CI: Evidence run 34810277084 green on #46 head `a89ca82`** (7 URLs: LCP 1655–1660 ms, TBT ≤ 80, CLS ≤ 0.009) · local: `evidence/lhci-cycle12-final` (7 × 3, every run in budget) and the four lever lanes above |
| 4.8 UI/UX | 8 | second review pass | D10 | local: `evidence/screens` (cycle 11) · card/nudge fixes this cycle |
| 4.9 Accessibility | 9 | — | live axe (first probe) | local: all-routes sweep 0 / 0 (gate below) · CI on the PR |
| 4.10 Mobile | 9 | — | D10 | local: mobile under `vite preview` (gate below) · CI E2E job on the PR |
| 4.11 Admin | 9 | — | owner order dry-run | local: `test-admin-screens` (D2 probes 0038 / 0039; 0040 / 0041 named unprovable) |
| 4.12 Observability | **7** | an executed post-deploy run; a recorded live-probe run | D4 (`PROD_URL` / `CANONICAL_HOST`), D11 | `evidence/live/latest.json`: **none**; post-deploy: 0 executed runs (config fixed `618467f`) |
| 4.13 Hygiene | 9 | — (9 = 10) | — | lint 0 / 0 · unit chain green · 2026-09-14 |
| 4.14 Growth | 7 | first observed redemption / application (data) | attributed repeat order | local: the executed referral / partner / rewards tests |

### OWNER SPRINT STATUS (§D)

**D1–D12: none evidenced** (`evidence/live/latest.json` absent; no DB gate on
prod; no repo variables). What moved this cycle: **D2**'s list ends at
**0041** (0039 nulls the seeded purity, 0040 the non-negative points check,
0041 the certificate bucket limits — all update-only / guarded, none applied);
the Owner Sprint row proves 0038 / 0039 by data and names 0040 / 0041 as
unprovable from the API; **D5b** unchanged (11 / 44 spec sets; 33 are yours);
**D8** gains the `PAYMENTS_STRIPE_LIVE_ACK` presence row; **D4** is now the
single blocker for 4.7 / 4.9 / 4.12 tens and for a meaningful live probe. After
this PR merges the post-deploy smoke fires on Vercel's deployment status by
itself for the first time (the engine also dispatches it and the live probe
by hand and cites both runs in the thread).

### EVIDENCE PROVENANCE (§F)

- **From CI (read through `scripts/evidence-latest.mjs` at RECON):** `ci/latest.json` for
  `a04f331` (**main**, Evidence run 34796722607, green: LCP 1511 / 1656 / 1509 / 1509 ms, CLS 0,
  TBT ≤ 156 ms, screens 372 / 0, axe 0). **From CI on this PR:** `ci/latest.json` for the #46
  head (Evidence run 34810277084, 2026-09-14 05:59Z, green on seven URLs — numbers in the PR DRAFT
  section); CI run 34810277109; DB gates run 34810277115.
- **From this sandbox (2026-09-14):** every number above; `evidence/lhci-cycle12-parity`
  (the red baseline), `lhci-c12-L1` … `L4` (one lever each, 5 runs), `lhci-cycle12-final`
  (7 URLs × 3); the RECON workflow journal (`wf_23d8d950-8f2`, 198 agents); the gate log
  (`scratchpad/gate/*.log`, not committed).
- **Live:** none (`evidence/live/latest.json` absent; 0 live-probe runs; 0 executed
  post-deploy runs — the latter's config defect is fixed in `618467f`).

### GENERATOR YIELDS (cycle 12)

Inversion + adversarial verification 2 (the workflow: "which gate has never run?" → the
production smoke and the live probe; "which helper does nothing call?") · Regulator walk 1
(the purity constant) · Data honesty 4 (purity from certificates; "transcribed"; honest mirror
ids; D2 by data) · Failure injection 4 (partner rebind / demotion / failed store; concurrent
redemption; remote-URL smoke; a hide that never reached the rebuild) · Cost/perf 1 + 4 levers
(parity on 23 pages and the parity gate; then the loader race, the redundant render, the
memoised card, the time-sliced first render — each measured) · Ops dry run 3 · Accessibility 6
(all on the money path, by adversarial reading, then gated) · Buyer walk 1 (first-visit
keyboard path) · Competitor delta not run.

### ESCALATIONS (owner-only; ranked)

1. **This PR** (Draft; base `main`). Merge when the checks are green; the post-deploy smoke then
   executes for the first time on Vercel's deployment status.
2. **D4** repo variables `PROD_URL` (the real production origin) and `CANONICAL_HOST` — the live
   probe defaults to the `*.vercel.app` host and reads red on nine host-config checks until set;
   4.12 cannot pass 7, and 4.7 / 4.9 cannot reach 10, without a recorded run against the real host.
3. **D2** apply `0031`–`0041` (`docs/MIGRATIONS_0039.md` / `0040` / `0041`; 0039 nulls the
   seeded 99.0 purity — until it is applied, the LIVE database still carries the constant the
   storefront no longer prints).
4. **D5b** sequence · MW · CAS for the 33 products without them (Control Room → Catalog).
5. **D1** `verify:rls` on prod · **D3** repo private → **D12** rotate.
6. **`PAYMENTS_STRIPE_LIVE_ACK`** — set it only after the Stripe live-mode review (RUNBOOK §2).
7. **BTCPay idempotency key** (`api/btcpay/create-invoice.js`, ask-before) — unchanged.
8. **Partner pricing** — dormant and asserted dormant; turning it on touches `lib/pricing.js`.
9. **Cart reminder email** — template exists, nothing sends it; decide whether you want it.
10. **Code names on order lines** (`lib/pricing.js`) — unchanged.
11. **Vercel "Ignored Build Step"** for the `evidence` branch — done in code; the project setting is
    the durable owner-side form.
12. D6 · D7 · D8 · D9 · D10 (walk the matrix on a phone) · D11 · `VERCEL_DEPLOY_HOOK_URL`.

### What I'd do differently

Read every run before trusting a median (H-017): the 1.5 s ↔ 2.7 s flip was in cycle 11's own
lane and passed by luck; one hour of per-run reading found the ordering race that ten levers of
"measured, not moved" in cycle 10 had circled. Measure a lever on the routes it targets with
five runs (`perf-lhci --urls`, ~4 min each) — four levers in an hour instead of one per cycle.
And hold the measured-win rule against the commit reminder: three levers went in as three
commits with their own numbers, the fourth waited for its lane rather than ride along.

### PR DRAFT (opened as a Draft per addendum C6, base = `main`)

**Opened:** [#46](https://github.com/EminenceHairBoutique/Noir-Peptides/pull/46) at 2026-09-14 05:31Z (Draft; subscribed; steward check-in armed).

**CI green on head `a89ca82` (06:00Z, `mergeable_state: clean`):** CI run [34810277109](https://github.com/EminenceHairBoutique/Noir-Peptides/actions/runs/34810277109) (Lint · test · build, End-to-end, Migration hygiene) · DB gates run [34810277115](https://github.com/EminenceHairBoutique/Noir-Peptides/actions/runs/34810277115) · **Evidence run [34810277084](https://github.com/EminenceHairBoutique/Noir-Peptides/actions/runs/34810277084)** — `ci/latest.json` verdict green: Lighthouse median of 3 on seven URLs LCP `/` 1660 · `/shop` 1656 · PDP 1656 · `/test-results` 1655 · category 1656 · permalink 1655 · `/partners` 1655 ms, TBT 0 / 80 / 66 / 37 / 9 / 0 / 0 ms, CLS ≤ 0.009, perf 99–100; screens 372 views / 0 failing; axe 0; link-depth and hygiene green · GitGuardian · Vercel preview. Two earlier red `Publish` checks were on superseded heads under the old workflow file (`always()` after a cancelled build) — fixed by `a89ca82` (`!cancelled()`), one comment each side. **This is the H-014 CI proof for 4.7 = 9.**

**Title:** Opt cycle 12 — purity only from certificates, partner hardening, deterministic paint-first + time-sliced hydration, live-evidence readiness

**Summary.** Adversarial RECON of cycles 10 + 11 (a workflow: 8 readers, 3 verifiers per
finding) led with a hard-rule defect the engine itself had shipped — "≥ 99 % PURE" from a seeded
constant the site's own certificates contradict — and two security defects in the partner
application. 20 planned items shipped; the performance lane then caught its own flakiness:
the paint-first loader raced Lighthouse's first paint and the LCP median flipped by luck; fixed
at the mechanism, with hydration time-sliced on top (TBT 205 / 138 / 171 → 77 / 32 / 53 ms on
`/shop`, the PDP and `/test-results`). Migrations 0039–0041 (update-only, guarded; apply is
ask-before). Post-deploy smoke can now actually run against a remote URL; live probe hardened;
workflows split so PR-branch code never holds `contents: write`.

**Honest state.** 4.7's nine rests on the CI Evidence run on this PR (seven URLs, hard budgets,
median of 3). 4.12 is corrected to **7**: the production smoke has never executed (its config
defect is fixed here); the first executed run and the first live-probe record are the next
proofs. No migration applied to live, no price / visibility / flag change (the cart-recovery flag
stays off everywhere), no pricing / shipping / checkout-session / btcpay file touched.

**Rollback.** Revert the branch.

---
