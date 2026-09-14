# Noir Peptides — Launch Readiness

_Last updated: 2026-09-14 (opt cycle 12)_

This tracks the Launch Remediation work (6 tasks) and what remains before going
live. Branch: `claude/noir-peptides-launch-UwkB3`.

---

## ✅ Done (Sept-14 optimization cycle 12 — branch `claude/opt-cycle-12-20260914`, base `main`, Draft PR)

The addendum's "Cycle 5+ — hold at nine; promote to ten only from live
evidence" (`OPTIMIZATION_LOG.md`, cycle 12). RECON was an adversarial
re-read of cycles 10 + 11 (a workflow: 8 readers, 3 verifiers per finding):

- **Purity is certificate-only.** Every card, product page and the specs
  panel printed "≥ 99 % PURE" from a seeded constant (`purity_percent: 99`
  on all 44 static products, 0009 seeds 99.0) that the site's own published
  certificates contradict (KPV 98.54 %, Semax 98.80 %, Tesamorelin 98.49 %).
  Purity now comes from the LATEST PUBLISHED certificate or is absent;
  migration `0039` nulls the seeded value (update-only — apply is yours);
  the Home page's "≥ 99 %" strings are gone; gated by `test-purity-honesty`.
- **Partner application hardened:** no upsert-by-email (an existing
  approved / rejected row is never overwritten, another account's row is
  never touched), a failed store is a 502 (never "received"), profile →
  `partner_pending` only on a NEW row, `partner_pending` no longer passes
  the partner guard; the Control Room Partners tab shows every field and
  lets you pick the tier on approval (`lib/partnerTiers.js`).
- **Live-evidence readiness:** the post-deploy smoke had **never executed**
  (all 16 production runs died in 2 s on a Playwright config check) — fixed
  (`playwright.config.js` omits `webServer` for a remote URL; dispatch input),
  so it fires for real on the first deployment after this merges. The live
  probe expects the configured production host, checks that a payable rail
  exists, derives the sitemap floor from build metadata and asserts hidden
  categories stay out of the live sitemap. Both evidence workflows split into
  a read-only job and a write-only publish job. **Observability is scored 7
  until the first executed smoke and the first probe record exist.**
- **Performance, deterministic:** the paint-first loader's two-frame trigger
  raced Lighthouse's first paint and the LCP median flipped 1.5 ↔ 2.7 s run to
  run (in cycle 11's numbers too); the loader now starts the app on the
  `first-contentful-paint` entry (15 of 15 runs after the paint). Hydration is
  time-sliced (the first render is a React transition) and the seeded pages no
  longer render twice: TBT on `/shop` · product page · `/test-results`
  205 / 138 / 171 → 77 / 32 / 53 ms locally, LCP and CLS unchanged; seven URLs
  are now under the hard Lighthouse gate, with a shell-parity gate in CI.
- **Accessibility on the money path:** checkout step changes move focus to
  the step heading, errors are live regions, the order-summary jump lands on
  a focusable target, programmatic scrolls honour reduced motion; the
  saved-cart nudge clears the bottom nav and is a named region; the age gate
  takes, traps and hands over focus with the page behind it inert; product
  cards no longer nest a link in a link.
- **Referral and loyalty real:** the referral code is issued server-side and
  posted from step 2; point deduction is compare-and-swap with a shortfall
  ledger (migration `0040`, a NOT VALID check — yours to apply); COA storage
  removes replaced objects and `0041` caps the bucket (yours to apply).
- **Docs to the truth:** the Copilot instructions' "auth wall" text rewritten
  (the catalog is public), `PAYMENTS_STRIPE_LIVE_ACK` documented and shown on
  the Owner Sprint D8 row, spec counts 11 / 33 and "transcribed" everywhere,
  D2 proves 0038–0041 by data, migration-doc and doc-drift gates.

**Owner Sprint status:** none complete. New for D2: migrations `0039`,
`0040`, `0041`. D4 (`PROD_URL` / `CANONICAL_HOST`) is the single blocker for
a meaningful live probe and for every 10.

## ✅ Done (Sept-13 optimization cycle 11 — branch `claude/opt-cycle-11-20260913`, stacked on cycle 10, Draft PR)

The addendum's "Cycle 4 — polish to nine everywhere + growth foundations"
(`OPTIMIZATION_LOG.md`, cycle 11):

- **Performance, moved:** a paint-first loader (`public/boot.js`) starts the
  JavaScript wave after the first painted frame, and every prerendered shell
  carries the route's largest above-the-fold paragraph. Lighthouse LCP
  (mobile simulation, median of 5) on the four gated routes: `/` 3.1 → 1.4 s,
  `/shop` 3.3 → 1.9 s, product page 3.1 → 1.5 s, `/test-results` 3.3 → 1.5 s.
  **CI proof: the `Evidence` check is green on the PR head** (run 34789025447 —
  LCP 1.5–2.0 s on all four routes, CLS 0, TBT ≤ 135 ms); performance is
  scored 9 (10 needs the live host).
- **Specifications, honest:** sequence / molecular weight / CAS for the 11
  products with transcribed values (from the 0001 seed, CAS check-digit validated;
  migration `0038`, update-only — `docs/MIGRATIONS_0038.md`); the panel omits
  what it does not know instead of printing "—"; the Control Room edits the
  three fields (format-validated); the other 33 are **owner data** (Owner
  Sprint row D5b counts them). The 11 come from the self-authored 0001 seed,
  not from a supplier or the CAS registry — confirm before any "verified"
  wording returns.
- **Certificates in every build:** the 19 published certificates already in
  the live table are mirrored from their migration, so `/test-results`, the
  15 batch-history permalinks (sitemap 73 → 89 with `/partners`) and the
  product pages render them without database access; product cards show the
  real "✓ COA · lot" chip.
- **Growth foundations (4.14), zero product-benefit copy:** the promo /
  points spend path is back on the routed checkout (server-validated hints;
  the balance comes from the server; one redemption rate shared by client
  and server, executed tests); `/partners` wholesale / institutional request
  page on the existing apply endpoint (a saved application no longer 500s
  when the email transport is unset); restock notices proven by execution;
  a saved-cart return nudge behind `VITE_FEATURE_CART_RECOVERY` (default
  off) with a drafted reminder template nothing sends.
- **UI from the screenshot matrix:** consent sheet 39 % → 32 % of a phone
  viewport and clear of the bottom nav; checkout step 1 gets a summary strip
  at the top with a jump link; shop card chips no longer collide at 390 px;
  design tokens have one source (`docs/DESIGN_TOKENS.md`, gated).

**Owner Sprint status:** none complete. New for D2: migration `0038`. New
decision: `VITE_FEATURE_CART_RECOVERY` (default off). PR #42 was closed by
GitHub when the cycle-9 branch was deleted after #41 merged; **PR #43** is
cycle 10 unchanged against `main`; cycle 11 stacks on it.

## ✅ Done (Sept-13 optimization cycle 10 — branch `claude/opt-cycle-10-20260913`, stacked on cycle 9, Draft PR)

The addendum's "Cycle 3 — ops to nine" (`OPTIMIZATION_LOG.md`, cycle 10):

- **Control Room, three screens:** certificate **file upload** (PDF / JPEG,
  checked by content, 4 MB cap, private bucket, served through a 10-minute
  signed link for published certificates only — migration `0037`);
  **Feature flags** (read-only: names and on/off, never values; flags stay
  environment-controlled); **Owner Sprint** (D1–D12 with a status the
  database can prove and the exact screen or command per step).
- **Emails:** the shipped email is tested; a research-use **attestation
  receipt** is sent after every recorded attestation (best-effort).
- **Commerce:** a double-click on Continue writes one compliance record
  (guard + E2E proof); the unused second rails endpoint is gone.
- **Mobile:** the mobile suite now runs in CI; tap targets are a gate
  (44 px for controls, 24 px for inline text links) with the footer,
  landing, shop, cart and product-page links fixed to meet it; every
  decorative animation honours reduced motion (spec added).
- **Performance, honestly:** five LCP levers were measured through the
  Lighthouse gate (`scripts/perf-lhci.mjs`); none moved the median down, so
  none shipped. The model is now understood (the whole first-wave request
  graph is charged to the paint); the structural fix leads cycle 11.

**Owner Sprint status:** still none complete — the Control Room's Owner
Sprint tab now shows the live status. New this cycle for D2: migration
`0037` (`docs/MIGRATIONS_0037.md`).

## ✅ Done (Sept-13 optimization cycle 9 — branch `claude/opt-cycle-9-20260913`, Draft PR)

The owner's *Path to Ten* addendum, its "Cycle 2" (`OPTIMIZATION_LOG.md`, cycle 9):

- **The engine has eyes.** Three workflows: `Evidence` (screenshots of every
  route at four widths, axe on every route, Lighthouse median-of-3 hard
  budgets, crawls → the orphan `evidence` branch), `Live probe` (every 6 h
  against `PROD_URL`; one self-closing "Live probe failing" issue) and
  `DB gates` (the real `verify:rls` / `db:verify` + a static↔DB shape diff on
  a fresh Supabase stack). `node scripts/evidence-latest.mjs` reads the
  results from any sandbox.
- **Pre-authorized debt cleared:** legacy `src/data/products.js` + audit
  script + CI step deleted (proof: nothing imported it); Stripe webhook
  signature failure is a generic envelope; CSP no longer names the Google
  Fonts hosts.
- **`products.code_name`** (migration `0036`, set on nothing): an optional
  storefront display name — shop, product page, cart, checkout — editable in
  the Control Room behind the copy door. Certificates and order records keep
  the substance name. → `docs/MIGRATIONS_0036.md`.
- **Accessibility:** the first all-routes axe sweep found and fixed
  unlabeled controls on `/contact` and a heading jump on `/about`.
- **Hygiene:** lint at zero warnings, enforced; `docs/SCHEMA.md`'s migration
  table completed (it had stopped at 0016).

**Honest state:** the Lighthouse LCP budget (2.5 s) is missed on all four
gated routes under mobile simulation (3.1–3.4 s), so the `Evidence` check is
red until LCP moves — the engine leads with it next cycle. Performance is
scored **7**, corrected down from 8.

**Owner Sprint (D1–D12) status: none complete yet** — the exact command or
screen for each step is in the cycle-9 log's Owner Sprint table. First three:
`verify:rls` on prod, apply `0031`–`0036`, make the repo private. Set the
repository variables `PROD_URL` and `CANONICAL_HOST` so the live probe
targets the real host.

## ✅ Done (Sept-13 optimization cycle 8 — branch `claude/opt-cycle-8-20260913`)

Five verified items (`OPTIMIZATION_LOG.md`, cycle 8):

- **SEO: unknown paths are real 404s.** Vercel now rewrites only the
  client-side routes to the app shell; everything else falls to a static
  `404.html` served with a 404 status. On the way: the **Quality & Batch
  Standards page had never been prerendered** — linked from the header and
  footer since launch, reachable only through the SPA fallback, absent from
  the sitemap. It is now a real page (sitemap 72 → 73).
- **Observability: a post-deploy smoke chain** runs the server-gate specs
  against every successful production deployment.
- **Performance:** per-route bytes and request budgets are enforced in CI.
- **UI hygiene:** no leaked `undefined` / `NaN` / placeholder text on any
  rendered page — found clean, now enforced.
- **Mobile:** the gated cart and checkout are guarded against horizontal
  overflow.

**Owner:** unchanged from cycle 7. Note for the next production deploy: the
routing change means a mistyped product URL now returns 404 (as it should);
every page linked anywhere on the site is covered by the routing gate.

## ✅ Done (Sept-13 optimization cycle 7 — branch `claude/opt-cycle-7-20260913`, stacked on cycle 6)

Five verified items (`OPTIMIZATION_LOG.md`, cycle 7):

- **Legal:** discount descriptions (shown on /deals) and lab names (on every
  COA card) are refused at the door when they carry use language — the last
  admin-entered texts with a public render.
- **Security:** every public POST endpoint rate-limits, and a gate now says
  so (webhooks are signature-verified instead).
- **Trust:** "scan the label, land on the lot" is proven end to end — a real
  label is rendered, rasterized, its QR decoded and parsed by the scanner's
  own parser, for every template.
- **Accessibility:** axe now sweeps the gated cart and both checkout steps
  through the auth fixture; the one finding (no level-one heading on the
  checkout) is fixed.
- **Ops:** the runbook covers the deploy hook, the Errors tab, the E2E build
  and the copy gates.

**Owner:** unchanged from cycle 6.

## ✅ Done (Sept-13 optimization cycle 6 — branch `claude/opt-cycle-6-20260913`)

Four verified items and one measured cut (`OPTIMIZATION_LOG.md`, cycle 6):

- **Legal: buyer reviews are held to the site's rules.** The review endpoint
  now applies the same use-language rules and compliance scanner that gate
  printed labels, on top of its own outcome / body-part list; anything
  flagged is refused with guidance and nothing is written.
- **Commerce: the checkout draft survives a reload** (session storage only;
  the three RUO certifications are re-affirmed every time). Asserted in E2E.
- **Observability: API failures now reach the Control Room.** Every
  safely-failed request is recorded (scrubbed, no PII) in a new
  `server_errors` ledger — migration `0035` — and listed beside the client
  errors. Until 0035 is applied the tab says so.
- **Cut, with data:** `font-display: optional` for the mono faces won as an
  inline variant and lost when built (+832 ms LCP on `/`, 4 of 4). Reverted.

**Owner:** apply `0035_server_errors.sql` with `0031`–`0034` (same
one-shot as before); everything else unchanged.

## ✅ Done (Sept-13 optimization cycle 5 — branch `claude/opt-cycle-5-20260913`)

Three verified items and one measured cut (`OPTIMIZATION_LOG.md`, cycle 5):

- **Legal: what an admin types on a label is refused at the door.** Label
  configs are checked at create and patch against the same rules the build
  gate renders real labels against — use language (volume, solvent, route,
  dose, schedule, reconstitution instruction) or an un-negated scanner
  finding returns a 400 naming the field. Nothing can print past it.
- **Commerce + accessibility: the gated checkout is exercised end to end.**
  `npm run build:e2e` and an authenticated fixture (no database, no
  production seam) let E2E walk /cart → checkout step 1 → step 2 with the
  keyboard, assert a focus indicator at every stop, and prove that a stale
  attestation bounces to the attestation step. CI's E2E job uses it.
- **Ops: the confirmation email is a receipt.** Line items, quantities, unit
  prices, total, ship-to snapshot, shipping method, the research-use line;
  user text escaped; nothing fabricated when data is absent.
- **Cut, with data:** a styled prerender shell (site typography for the
  first-second view) made the home page's largest paint land 860 ms later in
  4 of 4 runs against main. Reverted; the measurements refine Hy-008.

**What didn't move (owner):** unchanged from cycle 4.

## ✅ Done (Sept-13 optimization cycle 4 — branch `claude/opt-cycle-4-20260913`)

Six verified items (`OPTIMIZATION_LOG.md`, cycle 4):

- **Legal: the printed label is now gated.** Real labels (every template,
  front + full wrap, four configs) are rendered and scanned; volumes,
  solvents, routes, doses, schedules and reconstitution instructions are
  forbidden outright; the engine's fixed strings are scanned the same way.
  Nothing was found. One sentence is escalated to counsel (below).
- **Accessibility: the cart drawer is a dialog that takes focus** and
  returns it on close; a keyboard-only walk of the public commerce path
  (shop → product → Add to Cart → drawer → Escape) runs in E2E.
- **Ops/SEO: hiding a category now rebuilds the site** when the Vercel deploy
  hook is configured, and the Control Room says plainly when it is not —
  the prerendered (indexable) pages no longer wait for a manual deploy.
- **Performance:** the flat-label renderer and the QR library no longer
  ride every product page (−21 KB transfer per PDP); the first route no
  longer fades in from invisible over already-painted content (a 420–460 ms
  opacity-0 window on throttled mobile, measured); `npm run perf:compare`
  A/Bs two builds back to back.
- **Commerce:** cart lines say "Add N more for $X each" when a cheaper
  bundle tier is within reach (display only; server pricing untouched).

**What didn't move (owner):** unchanged from cycle 3. **New escalation
(counsel, low):** the full-wrap label carries "After reconstitution:
storage conditions must be determined by the validated research protocol."
It names no solvent, volume or schedule and the gate accepts it; whether a
label should mention reconstitution at all is a counsel call
(`src/lib/labels/storage.js`, `RECONSTITUTION_NOTE`). **New owner action:**
set `VERCEL_DEPLOY_HOOK_URL` (Vercel → Project → Settings → Git → Deploy
Hooks) so a visibility flip rebuilds the static pages by itself.

## ✅ Done (Sept-13 optimization cycle 3 — branch `claude/opt-cycle-3-20260913`)

Six verified items (`OPTIMIZATION_LOG.md`, cycle 3):

- **Legal: the rendered site is now scanned, not just its inputs.**
  `test-dist-copy.mjs` runs the compliance scanner over every prerendered
  page's visible text, meta / OG descriptions, JSON-LD and alt / aria text
  with an exact per-page allowlist of negations. 78 pages; product, category
  and article pages must be finding-free. Nothing positive was found.
- **Accessibility: one main landmark + skip link.** 407 moderate landmark
  findings → 0; "Skip to content" is the first Tab stop on every shell page
  and moves focus into `#main`; the CI sweep now fails on any landmark
  finding or a broken skip link.
- **Ops: the attestation behind an order is on the order screen.** The
  Control Room's order detail shows the checkout-time consent record
  (version, legal name, statements, IP, user agent, timestamp) or says
  plainly that none is on file.
- **Performance:** every prerendered page announces its route chunk with
  `modulepreload` (76 pages); `npm run perf` measures throttled-mobile
  TTFB / FCP / LCP / CLS; the test server now gzips like Vercel does.
- **Hygiene:** `.env.example` is complete (7 undocumented names added, 1 dead
  one removed) and gated; ESLint 10 forward-compat for the service worker.

**What didn't move (owner):** unchanged from cycle 2 — `verify:rls` on prod
leads; category posture; migrations; repo visibility; domain; lab data; the
legacy products file; the CSP font origins.

## ✅ Done (Sept-13 optimization cycle 2 — branch `claude/opt-cycle-2-20260913`)

Seven verified items (`OPTIMIZATION_LOG.md`, cycle 2):

- **Crawl depth is now true and enforced.** The Aug-28 "every public page ≤2
  clicks from any other" claim was false (315 pairs over, `/deals` and
  `/legal/returns` orphaned). The prerendered footer nav links Home, Deals and
  every visible category; the alias is noindex; `test-link-depth.mjs` gates it.
- **Fonts self-hosted** from the label engine's existing files, preloaded — no
  Google Fonts request on any page (`test-fonts-selfhosted.mjs`).
- **Accessibility:** axe sweep in CI; 20 serious findings → 0 (contrast
  tokens, link underline, heading order, decorative watermark). 407 moderate
  landmark findings remain (planned, cycle 3).
- **Legal:** the footer watermark still carried the retired "Performance"
  tagline — corrected; a source-wide guard now prevents its return.
- **Attestation records carry the user agent** on every order.
- **Secret scrubber** covers Anthropic and Resend key shapes.
- **SW precache budget** enforced. Mobile 52/52 on the final build.

**What didn't move (owner):** `verify:rls` on prod; repo visibility; domain;
migrations `0031`–`0034`; lab data entry; the legacy products file. **New
ask:** drop the Google Fonts origins from the CSP (ask-before file).

## ✅ Done (Sept-13 optimization cycle 1 — branch `claude/opt-cycle-1-20260913`)

Engine loop established: `PLAYBOOK.md` (heuristics, generator yields,
hypotheses) and `OPTIMIZATION_LOG.md` (plan-before-execution, scorecards,
escalations). Six verified items:

- **Copy gate.** The compliance scanner now runs over the whole public copy
  corpus (catalog, research incl. drafts, FAQs, page copy, every AI system
  prompt, email templates) as a unit-test gate with an explicit allowlist of
  accepted *negative* statements. Injection-consumable naming removed from
  code comments/docs; the literature summarizer no longer asks for "proposed
  mechanisms".
- **Sanitized envelopes everywhere.** Four raw error passthroughs closed —
  including the **public** `/api/contact` — and a gate that no `api/**`
  response carries `err.message` and every `api/admin/*` calls `requireAdmin`.
- **Lab linkage without SQL.** Control Room can add a testing laboratory
  (validated https + `{code}` lookup template) and link each certificate to a
  lab + lookup code + purity qualifier. This is the data the "verify at lab"
  link has been waiting on since Aug 28. Hidden until migration `0032` is
  applied.
- **Data-integrity gates.** Regenerating `0009` from `tier1Catalog` must be
  byte-identical; all 19 certificate files must exist and be labelled by their
  real type.
- **PDP first-paint budget.** No product page may preload the 3D / PDF / QR
  chunks (44/44 clean).

**What didn't move (owner):** `verify:rls` on prod still unconfirmed since
`0030` — this leads every report until cleared. Repo still public. Domain not
attached. Migrations `0031`–`0034` not yet applied. 0 of 19 certificates
lab-linked (now possible from the Control Room). Legacy `src/data/products.js`
+ CI "Product data audit" step awaited a delete decision (deleted in cycle 9).

## ✅ Done (Sept-11 launch-hardening pass — branch `claude/launch-hardening-sep11`)

Eight tasks, each gated by build + suite green. Full detail with
VERIFIED/SUSPECTED markers in `LAUNCH_HARDENING_SEP11_REPORT.md`.

- **Dependencies:** `npm audit fix` (no `--force`) cleared all 15 advisories;
  lockfile-only change; 0 remain.
- **Build fails on a silent data fetch failure.** With Supabase credentials at
  build time, `/test-results` must carry counters + ≥1 certificate row and
  `/documents` the SDS list container, or `npm run build` exits 1 naming the
  route. Without credentials the honest shell is unchanged. **Consequence:** a
  deployment with credentials but zero published COAs cannot build — by
  design, no bypass.
- **COA tables say what the data is:** certificate links labelled by asset
  type (an image is never "PDF"); CAS column only when a row has a CAS;
  "Identity panel only" chip for MS-confirmed rows without purity. One
  shared helper for the table, the card and the prerender.
- **Home posture sentence** from one shared source: "Purchasing requires an
  account and a completed research-use attestation."
- **Free-shipping nudge** in the cart drawer, integer-cents maths, same
  wording on the cart page.
- **Feature flags, default OFF:** `/calculator` and the public AI surface
  (`/assistant` + four endpoints → 404 envelope). Owner decisions documented
  in `LAUNCH_CHECKLIST.md` §5b.
- **Category soft-launch flag** (migration `0034`, validated on fresh PG16,
  hides nothing): Control Room toggle; hidden paths ship a real noindex 404
  body; static mirror keeps the fallback in agreement.
- **CSP tightened at build time** when no analytics ID is set: no analytics
  origins, no `'unsafe-inline'` in `script-src` (no inline executable
  scripts exist), `cdn.jsdelivr.net` removed; `vercel.json` now derived from
  the same builder.

**Owner actions added:** apply migration `0034` (`docs/MIGRATIONS_0034.md`);
decide the two feature flags (`LAUNCH_CHECKLIST.md` §5b); watch the first
Vercel build after merge — it is the first run of the data-presence assertion
against the real database.

## ✅ Done (Aug-28 SEO crawlability pass — branch `claude/seo-crawlability-aug28`)

- **Full-coverage prerender.** 19 routes shipped an empty `<div id="root">`;
  now only the 4 interactive/auth routes in `PRERENDER_EMPTY_ALLOWLIST`
  (`/login`, `/register`, `/calculator`, `/verify-lot`) do. All legal pages,
  `/about`, `/faqs`, `/contact`, `/deals`, `/research` + its 3 articles, and
  `/test-results` now ship real crawlable `<main>` content, sourced verbatim
  from shared data modules imported by BOTH the page components and the
  prerenderer (`src/data/faqs.js`, `src/data/pageCopy.js`).
- **Structured data:** BreadcrumbList on PDPs and category pages (mirroring the
  rendered trail exactly), FAQPage on `/faqs` built verbatim from the shared
  FAQ data, and a missing WebSite node added so the Article graph's `isPartOf`
  no longer dangles. Article dates deliberately OMITTED — no real date exists.
- **Hydration no longer destroys structured data.** `SEO.jsx` was overwriting
  the build-time `@graph` with a single bare node — a PDP collapsed from
  `[Organization, WebSite, WebPage, Product]` to `[Product]`, and research
  articles lost their BreadcrumbList entirely. It now preserves the build-time
  graph for the current URL.
- **Sitemap/robots hygiene:** `lastmod` is now derived from real git commit
  times per source-of-truth file (omitted, never faked, when git is shallow);
  `Disallow: /verify` was a PREFIX rule silently blocking the indexable
  `/verify-lot` and is now exact-match; `/verify-lot`'s four-way
  index/noindex contradiction resolved to noindex.
- **Prerendered `/404`** with noindex + explicit not-found copy.
- **Internal linking:** related in-category products on every PDP, and a footer
  nav on every prerendered body (any public page ≤2 clicks from any other).
- **New gates in `test:unit`:** `test-prerender-coverage.mjs` (coverage vs the
  allowlist, canonical form, sitemap/robots, no-fabrication, RUO line) and
  `test-jsonld-shapes.mjs` (every emitted JSON-LD type; no
  Drug/MedicalEntity/Review/AggregateRating; no invented dates).

## ✅ Done (Aug-26 audit remediation — branch `claude/audit-remediation-aug26`)

- **RLS escalation fix formalized** as idempotent migration
  `0030_profiles_rls_escalation_fix.sql` (validated on fresh PG16), plus
  `npm run verify:rls` (read probes + active `role→admin` escalation test) and a
  static SQL unit test.
- **`npm run db:verify`** — read-only live-vs-catalog reconcile (row counts +
  migration ledger) with RUNBOOK §1 fix commands; derivation unit-tested.
- **Stripe live-key interlock** — a live `sk_live_` key without
  `PAYMENTS_STRIPE_LIVE_ACK` excludes the Stripe rail everywhere and makes
  `create-checkout-session` return 503; 16 new assertions, existing 47 untouched.
- **Homepage prerender** now emits crawlable `<h1>` + body + category links.
- **Compliance tagline** "Performance" → "Provenance" applied everywhere.
- **Stale auth-wall comment** in the SEO generator replaced with an accurate one
  (byte-identical route output).
- **Security headers** — dropped deprecated `X-XSS-Protection` and contradictory
  `X-Frame-Options`; tightened `img-src` to the named set; apex→www 308 redirect
  staged (inert until the domain is attached).
- **Business-identity config** (`src/config/business.js`) — phone/address/
  guarantee/cutoff render only when set; null by default (byte-identical);
  snapshot-tested.
- **`npm run test:e2e:prod`** fail-fast gate + a post-deploy verification chain
  in `LAUNCH_CHECKLIST.md §9`.

## ✅ Done (earlier launch remediation)

### Task 1 + 2 — Indexability & SEO
- Build-time prerender of every public route's `<head>`: home, shop index,
  categories, product pages, education, legal — real
  `<title>`/description/canonical/OG **in the static HTML** (not post-hydration).
  **Correction (Aug-28):** this section previously claimed prerendering covered
  "**every** public route" and cited "7 categories / 37 product pages". In fact
  only `<head>` metadata was universal — 19 of 73 routes shipped an EMPTY
  `<div id="root">` with no crawlable body until the Aug-28 pass below. The live
  catalog is 8 categories and 44 products.
- **Product JSON-LD** per product (offers/price/availability; `Product` schema
  only — never `Drug`/`MedicalEntity`). `Organization` sitewide.
- `sitemap.xml` lists all catalog + content URLs; `robots.txt` allows the
  catalog and blocks only transactional/auth routes.
- Single canonical host (`www.noirpeptides.com`); plural `/products/:slug`
  301s to the canonical singular.
- Catalog **reads** made public (migration `0013`) so pages render for anon
  visitors and crawlers; **purchase stays gated**.
- Source of truth unified: `src/data/tier1Catalog.js` feeds **both** the SQL
  seed and the prerenderer (verified byte-identical seed).

### Task 3 — COA infrastructure
- `coas` extended (`0014`): lab name, lot number, MS-confirmed, publish flag,
  case-insensitive lot lookup. Public read = published rows only.
- Public **/test-results** COA library (filter by product + lot search),
  **/verify?lot=** lookup (QR deep-link target), self-hosted lazy-loaded QR.
- Per-product COA shown on the PDP; footer links; broken category links fixed.

### Task 4 — Compliance hardening
- **21+ age gate** interstitial (persisted, dismissible-once).
- AI guardrail extracted to a pure module + **`npm run test:guardrail`** (18
  tests: dosing/therapeutic prompts refuse, analytical prompts pass).
- Explicit RUO line added to the footer (now on every page).
- Attestation→order linkage (`0015`); checkout already blocked without a current
  attestation server-side.
- **`COMPLIANCE_COPY_AUDIT.md`** delivered (copy is claim-safe overall; one
  "Performance" tagline flag with a proposed rewrite — **not merged**, awaiting
  your sign-off).

### Task 5 — Payment architecture (honest rails)
- Provider abstraction (`lib/payments/providers.js`): `createCharge`/`getStatus`/
  `handleWebhook`/`refund` interface; **BTCPay (primary) + Stripe** implemented;
  **high-risk card + ACH adapter slots** (off until keyed). `availableRails()` +
  `GET /api/payments/rails` for a dynamic checkout UI.
- **BTCPay settlement webhook** (`api/btcpay/webhook.js`) — the missing piece:
  crypto orders now fulfill (HMAC-verified, re-fetches the invoice, idempotent).
- One **shared fulfillment path** (`fulfillOrder`) for all rails; Stripe webhook
  refactored onto it.
- Honest rails only — no transaction-obfuscation/disguise gateways.

### Task 6 — Trust, polish & schema
- **All 16 migrations validated on a fresh PostgreSQL 16 DB** → 29 tables,
  37/66/330/7 catalog, RLS intact. Canonical schema documented in
  `docs/SCHEMA.md`.
- Clear pricing + COA on every PDP; shipping/support surfaced.

---

## ⛔ Blocked on you (owner actions / decisions)

> **Cycle 9 onward:** the sequenced list with a command or screen per step
> is the **Owner Sprint** table (D1–D12) in `OPTIMIZATION_LOG.md`; the items
> below are the original launch list and remain valid.

1. **Domain consolidation (gated).** Confirm the single canonical host and which
   other domains/deployments should 301 to it. I have **not** hard-coded any
   apex→www or cross-domain redirect yet — give me the targets and I'll add them
   (Vercel redirect config).
2. **Payment credentials (gated).** No live keys enabled. To go live:
   - BTCPay: set `BTCPAY_URL/API_KEY/STORE_ID/WEBHOOK_SECRET`, configure the
     store webhook "Invoice settled" → `/api/btcpay/webhook`, test on testnet.
   - Card/ACH: after underwriting, supply `HIGHRISK_CARD_API_KEY` / `ACH_API_KEY`;
     I'll finish those adapters (`api/card/*`, `api/ach/*`) — interface is ready.
3. **Copy rewrites (gated).** Approve the `COMPLIANCE_COPY_AUDIT.md` proposals
   (mainly the "Performance" tagline) and I'll apply them.
4. **Attorney sign-off (FDCA).** Legal review of the catalog + all copy + the
   21+ threshold + attestation text.
5. **COA data entry.** The COA system is built but ships **no fabricated lab
   data**. Enter real per-batch COAs (lab, lot, HPLC %, MS, PDF) so
   `/test-results` and per-product COAs populate.
6. **Env + infra.** Set `VITE_SITE_URL`, apply migrations `0001–0016` to prod
   Supabase, configure Stripe + `ANTHROPIC_API_KEY`/`ANTHROPIC_MODEL`, Voyage,
   Resend, Google OAuth; bootstrap `ADMIN_EMAILS` then flip `profiles.role`;
   create the `research-uploads` bucket; add Search Console/Bing/`INDEXNOW_KEY`,
   `VITE_GA_MEASUREMENT_ID`.

---

## ⚠️ Remaining risks / follow-ups (not launch-blocking)

- **Crypto shipping address.** BTCPay doesn't collect a shipping address; the
  webhook stores whatever the checkout passed in invoice metadata. The Checkout
  UI should collect the US address **before** creating the crypto invoice.
- **Dynamic-rail UI wiring.** `GET /api/payments/rails` exists; the Checkout
  page should consume it to render rails dynamically (currently Stripe + crypto
  buttons). Backend is ready.
- **pgvector** must be enabled on Supabase for `0008` (native there).
- **E2E not executed** in-sandbox (Playwright browser download blocked); specs
  parse only. Guardrail unit tests do run and pass.
- Card/ACH adapters are interface stubs until credentials exist.

---

## Verification snapshot

- `npm run build` → 61 prerendered route files, 59-URL sitemap, robots.
- `npm run lint` → 0 errors (3 pre-existing hook-dep warnings).
- `npm run test:guardrail` → 18/18 pass.
- Migrations `0001–0016` → apply cleanly to a fresh PostgreSQL 16 DB.
