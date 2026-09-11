# Applying migration 0034

Paste-ready SQL for the Supabase SQL editor, following the same pattern as
`docs/MIGRATIONS_0032_0033.md`.

Migration **0034** is **strictly additive** and **idempotent**: one boolean
column on `product_categories`, `NOT NULL DEFAULT false`, plus a partial index.
It writes **no rows**. Every existing category stays visible exactly as before.

Validated on a fresh PostgreSQL 16 instance: the full chain `0001 → 0034`
applies clean and re-applies clean a second time.

---

## Step 1 — apply

In the Supabase dashboard: **SQL Editor → New query**. Paste the entire
contents of `supabase/migrations/0034_category_soft_launch_hidden.sql` and run.

**Expected result:** `Success. No rows returned.` A `NOTICE: column … already
exists, skipping` line on a re-run is normal.

## Step 2 — verify

```sql
select column_name, data_type, column_default, is_nullable
from information_schema.columns
where table_schema = 'public' and table_name = 'product_categories'
  and column_name = 'soft_launch_hidden';
```

**Expect:** one row, `boolean`, default `false`, `is_nullable = NO`.

```sql
-- The migration hides NOTHING. This must be zero.
select count(*) filter (where soft_launch_hidden) as hidden_categories,
       count(*) as total
from public.product_categories;
```

**Expect:** `hidden_categories = 0`.

## Step 3 — repository checks

Same as for 0032/0033 (`docs/MIGRATIONS_0032_0033.md` Step 4): with a `.env`
in place, `npm run db:verify`.

---

## What the flag does (owner decision — Control Room → Catalog)

With `soft_launch_hidden = true` on a category:

- the category and every product in it are excluded from `/shop`, the
  category page, related-product rails, the sitemap and the prerender;
- a direct product URL renders the 404 page (`noindex`), both as the static
  file and after hydration;
- nothing is deleted or un-published — flip it back and everything returns.

**Mirror it in code.** The storefront falls back to the bundled catalog when
the database is unreachable, and the prerenderer reads only the bundled
catalog. So when you hide a category, also set `softLaunchHidden: true` on that
category in `src/data/tier1Catalog.js` and redeploy; the test suite asserts
the build's hidden set matches the static mirror. The Control Room toggle is
the runtime switch; the static field is what the build and the fallback see.

To hide by SQL instead of the Control Room:

```sql
update public.product_categories set soft_launch_hidden = true where slug = '<slug>';
```
