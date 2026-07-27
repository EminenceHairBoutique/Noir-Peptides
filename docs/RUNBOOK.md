# Noir Peptides — Owner's Runbook

_The one document for operating the store. Everything here reflects code on
`main` as of Phase 11; when in doubt, the code and `docs/` deep-dives win._

## Stack at a glance

| Layer | Service | Where configured |
| --- | --- | --- |
| Frontend + API | Vercel (React 19 + Vite, `/api` serverless) | vercel.com project `noir-peptides` |
| Database + auth | Supabase (Postgres + RLS + Auth) | supabase.com project — SQL editor runs migrations |
| Email | Resend (orders, shipping, restock, concierge) | `RESEND_API_KEY` |
| Payments | Stripe (cards) + BTCPay (crypto) | keys below; both rails share server pricing + fulfillment |

## 1. Database migration ledger

Migrations live in `supabase/migrations/` and are run **by pasting into the
Supabase SQL editor** (this project has no CLI ledger). All are idempotent —
re-running is safe.

**Run this first — it reports what's still missing on YOUR database:**

```sql
select 'client_errors table (0025)' as feature,
       exists (select 1 from information_schema.tables where table_name='client_errors') as applied
union all select 'inventory columns (0028)',
       exists (select 1 from information_schema.columns where table_name='product_variants' and column_name='inventory_count')
union all select 'fulfillment columns (0029)',
       exists (select 1 from information_schema.columns where table_name='orders' and column_name='tracking_url')
union all select 'label FK RESTRICT (0027, optional)',
       exists (select 1 from pg_constraint c where c.conname='label_configs_product_id_fkey' and c.confdeltype='r');
```

| Migration | Purpose | Status |
| --- | --- | --- |
| 0001–0024 | Schema, catalog, labels, COAs, policy reconciles | Applied (via reconciles + manual-seed kit) |
| `scripts/manual-seed.sql` + `manual-seed-rls.sql` | Hand-made-DB seed + RLS | **Run** (verified: 44/96/480/19/96, 0 orphans, 19 policies) |
| 0026 | Admin-access repair | **Run** |
| 0025 | Error-telemetry table (Errors tab) | Run if the check above says false |
| 0028 | Tracked inventory columns | Run if false |
| 0029 | Fulfillment/tracking columns | Run if false |
| 0027 `_PROPOSED` | Label FK CASCADE→RESTRICT (protects label history) | **Optional — owner approval required** |

## 2. Environment variables (Vercel → Settings → Environment Variables)

`.env.example` documents every variable. The ones that gate features:

| Variable | Unlocks | Without it |
| --- | --- | --- |
| `VITE_SUPABASE_URL` / `VITE_SUPABASE_ANON_KEY` | All live data | Storefront falls back to the bundled catalog; admin/auth dead |
| `SUPABASE_SERVICE_ROLE_KEY` | Every `/api` endpoint's DB access | Checkout, admin, verification all fail |
| `STRIPE_SECRET_KEY` + `STRIPE_WEBHOOK_SECRET` + `VITE_STRIPE_PUBLISHABLE_KEY` | Card checkout + fulfillment | No card rail |
| `STRIPE_US_SHIPPING_RATE_ID` | Shipping line at checkout | Checkout errors |
| `BTCPAY_URL` / `BTCPAY_STORE_ID` / `BTCPAY_API_KEY` / `BTCPAY_WEBHOOK_SECRET` | Crypto rail | Crypto option hidden/fails |
| `RESEND_API_KEY` | Order/shipping/restock/concierge email | Everything else works; emails silently queue or skip |
| `ADMIN_EMAILS` (+ `VITE_ADMIN_EMAILS` mirror) | Admin bootstrap allowlist | Admin depends solely on `profiles.role` (drift-fragile — set both) |
| `VITE_SITE_URL` / `SITE_URL` | Auth-email links, SEO, QR base | Falls back to deploy origin (previews send preview links) |
| `VITE_GA_MEASUREMENT_ID` / `VITE_META_PIXEL_ID` | Analytics funnel (consent-gated) | No analytics fire |
| `ANTHROPIC_API_KEY` | AI assistant + deep compliance scan | AI features report unconfigured |
| `VOYAGE_API_KEY` / `INDEXNOW_KEY` / `ACH_API_KEY` / `HIGHRISK_CARD_API_KEY` | Semantic search / SEO ping / future rails | Feature-specific no-ops |

**Supabase dashboard (not env):** Authentication → URL Configuration →
Site URL = production origin; Redirect URLs allow-list = production `/**`,
preview `/**`, `http://localhost:3000/**`.

## 3. Operational flows

### Labels → print → verification
1. `/admin/labels`: pick a label, edit batch fields (lot = COA task number,
   MFG = test date − 2 days, EXP per policy), move Draft → In Review →
   **Approved**. Only approved labels ever render outside the studio —
   on PDPs, in the shop grid, and in print files.
2. **Print batch (N approved)** in the studio header → one merged print PDF
   (bleed, crop marks, slug lines). Per-label SVG/PNG/PDF exports remain.
3. Every label QR resolves `/v/<code>` → verification page + linked COA.
   Recalling a label (or letting it expire) flips its verification state.

### Catalog, inventory, restock
- Control Room → **Catalog**: price, stock, featured/new per product+variant.
- Enter a variant's **inv** count to start tracking: paid orders decrement
  it, checkout blocks oversells, status derives (0 = out, ≤ threshold = low).
  Blank = manual stock, exactly the old behavior.
- Flipping anything to in-stock (manually or by entering a restock count)
  emails its **back-in-stock waitlist** once ("N waiting" badges show demand).

### Orders → ship
- Control Room → **Orders** → click an order number: contents + SKUs,
  ship-to address, **Print packing slip** (RUO-boxed, no pricing), tracking
  entry → **Mark shipped + email customer** (stamps `shipped_at`; link also
  appears in the customer's Researcher Console).

### Promo codes
- Control Room → **Discounts**: create (percent ≤ 100 / fixed ≤ $10k, min
  subtotal, usage caps, bundle exclusion, Deals-page flag), toggle active,
  watch usage-vs-cap. Checkout re-prices server-side; codes can never be
  client-forged. Redemption history is read-only by design.

### Monitoring
- Control Room → **Errors**: production JS errors, grouped + deduped;
  resolve/reopen. Overview shows the open count.
- **AI Flags**: every assistant refusal/blocked output for review.
- `audit_logs` table records every admin catalog/label/discount change with
  before/after values.

## 4. Hard-learned invariants (do not relearn these)

- **Schema drift is the house failure mode.** Symptoms like "Could not load
  X", empty lists, or FK errors on things that "should exist" are almost
  always an unapplied migration or a stale policy — run the ledger check in
  §1 before debugging code. The storefront's static-catalog fallback can
  MASK an empty database; the Label Studio deliberately does not.
- **RLS must stay ON everywhere.** The anon key is public (it ships in the
  JS bundle); policies are the only lock. A table with policies but
  `rowsecurity = f` is wide open.
- **Never amend GitHub's merge commits** (`noreply@github.com`) — they are
  published history created by the owner's merge clicks.
- **Compliance invariants (enforced in code + tests):** RUO warnings render
  from constants and cannot drift; storage text prints only when
  owner-verified; blend quantities only when owner-entered; lots/labs/dates
  are never fabricated; only approved labels leave the studio; packing slips
  carry both RUO lines and no pricing.

## 5. Where the deep-dives live

`docs/LAUNCH_CHECKLIST.md` (go-live smoke test) ·
`LABEL_MASTER_ENGINE.md` / `LABEL_ROLLOUT.md` / `LABEL_PRINT_SPECS.md` ·
`LABEL_PDP_INTEGRATION.md` · `DB_RECONCILE.md` ·
`INCIDENT_EMPTY_CATALOG.md` · `PHASE6_OPS.md`

## 6. Known open items (owner decisions)

- CS10 (Cagrilintide + Semaglutide) price is a placeholder ($85) — now
  editable in the Catalog tab, no code change needed.
- Migration 0027 (label FK RESTRICT) awaits your approval.
- Printer die confirmation for the 72 mm masters (`LABEL_PRINT_SPECS.md`).
- Real-device iPhone pass + live-payment smoke test (`LAUNCH_CHECKLIST.md`).
