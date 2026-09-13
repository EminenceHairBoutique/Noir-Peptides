# Noir Peptides — Launch Readiness

_Last updated: 2026-09-13_

This tracks the Launch Remediation work (6 tasks) and what remains before going
live. Branch: `claude/noir-peptides-launch-UwkB3`.

---

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
+ CI "Product data audit" step await a delete decision.

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
- **Legacy `src/data/products.js`** (stale 13-product file) should be removed once
  its importers are repointed to the live catalog (see `docs/SCHEMA.md`).
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
