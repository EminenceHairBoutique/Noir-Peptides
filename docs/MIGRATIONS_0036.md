# Applying migration 0036

Paste-ready SQL for the Supabase SQL editor, following the same pattern as
`docs/MIGRATIONS_0034.md`.

Migration **0036** is **strictly additive** and **idempotent**: one nullable
text column `products.code_name` with a length constraint (1–80 characters
when set). It writes **no rows** — every product keeps showing its substance
name until you type a code name in the Control Room.

Validated by CI (`DB gates` workflow) on a fresh Supabase stack with the full
chain `0001 → 0036`.

---

## Step 1 — apply

In the Supabase dashboard: **SQL Editor → New query**. Paste the entire
contents of `supabase/migrations/0036_products_code_name.sql` and run.

**Expected result:** `Success. No rows returned.` A `NOTICE: column … already
exists, skipping` line on a re-run is normal.

## Step 2 — verify

```sql
select column_name, data_type, is_nullable
from information_schema.columns
where table_schema = 'public' and table_name = 'products' and column_name = 'code_name';
-- one row: code_name | text | YES
select count(*) from public.products where code_name is not null;
-- 0 (nothing is set by the migration)
```

## Step 3 — what changes

- **Control Room → Catalog**: each product gains a "Code name" field. Blank
  = the substance name is shown, as today. Text there is held to the same
  public-copy rules as every other admin-entered field (no use language).
- **Storefront**: with a code name set, `/shop`, the category pages, the
  product page (title, heading, JSON-LD), the cart and the checkout summary
  show the code name. `/test-results`, `/documents`, the certificates and
  order records / emails keep the substance name (a COA is about the
  substance; the order path is escalated separately — see the cycle-9 log).
- The static pages pick the code name up on the next build (the Control
  Room's rebuild hook, or the next deploy).

## Rollback

`alter table public.products drop column code_name;` — nothing else depends
on it; the code treats an absent column as "no code names".
