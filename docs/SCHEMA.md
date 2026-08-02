# Noir Peptides — Canonical Database Schema

**Source of truth:** the ordered migrations in `supabase/migrations/` (`0001`
→ `0016`). They are **additive and idempotent** — applying the whole set to a
fresh database, or re-applying it over an existing one, is safe.

**Validation (2026-06-30):** all 16 migrations were applied in order to a fresh
PostgreSQL 16 database and **completed cleanly**, producing **29 tables**, the
seeded catalog (**37 products / 66 variants / 330 price tiers / 7 categories**),
and all RLS policies.

> **Local caveat — pgvector:** `0008` enables `pgvector` (`create extension
> vector`) for semantic search. pgvector is **native on Supabase** but was not
> installed in the validation sandbox, so `0008` was applied with a
> pgvector-shimmed variant (vector column/index/operator stubbed). Every other
> migration applied verbatim. On Supabase, run `0008` as-is.
>
> **Supabase `auth` schema:** `auth.users` and `auth.uid()` are provided by
> Supabase. The local validation shimmed them; on Supabase they exist natively.

## Migration order

| # | File | Purpose |
|---|------|---------|
| 0001 | `noir_peptides_products` | base products/categories |
| 0002 | `noir_categories_v2` | category revision |
| 0003 | `auth_wall_attestation` | profiles, `attestation_audit`, `is_attested()`/`is_admin()`, RLS auth wall, `handle_new_user()` trigger |
| 0004 | `profiles_and_commerce` | orders, order_items, price_tiers, **coas**, shipping_addresses, loyalty |
| 0005 | `ops_security` | rate_limits, audit_logs, api_usage |
| 0006 | `engagement` | reviews/wishlist/email-subscriber scaffolding |
| 0007 | `partners` | partner_applications |
| 0008 | `ai_and_vector` | ai_conversations, ai_feedback, **embeddings (pgvector)**, `match_embeddings()` |
| 0009 | `tier1_catalog` | **catalog reconcile + seed** (per-variant price_tiers, size_label; 37/66/330); generated from `src/data/tier1Catalog.js` |
| 0010 | `discounts` | discounts + discount_redemptions |
| 0011 | `reviews` | product_reviews |
| 0012 | `back_in_stock` | back_in_stock_subscriptions |
| 0013 | `public_catalog_reads` | **public SELECT** on products/variants/tiers/categories/coas (indexability) |
| 0014 | `coa_lots` | coas: lab_name, lot_number, ms_confirmed, is_published; public read = published only |
| 0015 | `attestation_order_link` | attestation_audit: order_id, context (checkout consent record) |
| 0016 | `orders_provider` | orders: payment_provider, provider_ref (unique) — rail-agnostic idempotency |

## Tables by domain (29)

- **Catalog:** `products`, `product_variants`, `price_tiers`, `product_categories`, `coas`
- **Commerce:** `orders`, `order_items`, `shipping_addresses`, `discounts`, `discount_redemptions`
- **Identity / consent:** `profiles`, `attestation_audit`
- **Loyalty / referral:** `loyalty_ledger`, `referral_codes`, `referral_rewards`
- **Engagement:** `product_reviews`, `wishlist_items`, `back_in_stock_subscriptions`, `email_subscribers`, `research_articles`
- **AI / search:** `ai_conversations`, `ai_feedback`, `embeddings`
- **Ops / security:** `rate_limits`, `audit_logs`, `api_usage`, `support_tickets`, `contact_requests`, `partner_applications`

## Access model (RLS)

- **Public read (anon):** `products`, `product_variants`, `price_tiers`,
  `product_categories`, `coas` (published only), `discounts`,
  `research_articles`. This is what makes product pages indexable.
- **Owner-only:** `orders` (own), `profiles` (own), `attestation_audit` (own),
  loyalty/referral/wishlist/reviews (own where applicable).
- **Admin:** `is_admin()` (= `profiles.role = 'admin'`) grants catalog writes
  and full reads.
- **Server-only:** `embeddings`, `rate_limits`, `api_usage` (service role).
- **Purchase gate:** independent of read access — checkout endpoints require a
  **current** research-use attestation server-side (403 otherwise).

## Legacy note

`src/data/products.js` is a **stale** 13-product static file with category
slugs that no longer match the live catalog. It is **not** the source of truth
(that is `src/data/tier1Catalog.js` + the `0009` seed) and should be removed in
a follow-up once its remaining importers are repointed.

## COA seed (migration 0019)

Migration `0019_janoshik_coas.sql` seeds 13 third-party **Janoshik Analytical**
Certificates of Analysis (one per tested catalog product) transcribed verbatim
from the owner's certificate images (`public/coas/janoshik/<product>.jpg`):
HPLC purity, mass-spec identity, manufacturing batch `2026-05`, analysis date,
and the Janoshik task number as the lot key (`JAN-<task>`) so `/verify-lot`
resolves to the exact report. Blends store per-component content (no single
purity %). Idempotent (replaces `lab_name='Janoshik Analytical'` rows).
Validated on fresh Postgres 16 (13 rows, FK-intact, idempotent across re-runs).

**Not seeded (no catalog listing):** Tirzepatide (×2) and Retatrutide (×4)
certificates — compliance-gated, absent from the catalog — and bacteriostatic
water (not a listed product). Their images are retained in the upload only.
