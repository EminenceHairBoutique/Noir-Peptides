# Noir Peptides — Launch Readiness

_Last updated: 2026-06-30_

This tracks the Launch Remediation work (6 tasks) and what remains before going
live. Branch: `claude/noir-peptides-launch-UwkB3`.

---

## ✅ Done (in this remediation)

### Task 1 + 2 — Indexability & SEO
- Build-time prerender of **every** public route: home, shop index, **7
  categories**, **37 product pages**, education, legal — real
  `<title>`/description/canonical/OG **in the static HTML** (not post-hydration).
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
