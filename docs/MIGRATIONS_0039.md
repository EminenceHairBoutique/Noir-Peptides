# Applying migration 0039

Follows `docs/MIGRATIONS_0038.md`. Migration **0039** is **update-only** and
**idempotent**: it clears `products.purity_percent` where it still equals the
seeded `99.0` — a blanket specification nobody measured, which the site's own
published certificates contradict (KPV 98.54 %, Semax 98.80 %, Tesamorelin
98.49 %). Since opt cycle 12 no public surface reads that column: the shop
card chip, the product page badge, the certificate panel, the specs panel and
the compare table all show the latest **published certificate's** HPLC result
or nothing. Applying 0039 only stops the seeded number from sitting in the
database; it changes nothing a visitor sees. A purity you entered deliberately
(any value other than exactly 99.0) is kept.

## Step 1 — apply

**SQL Editor → New query**, paste `supabase/migrations/0039_null_seeded_purity.sql`,
run. Expected: `Success. No rows returned.`

## Step 2 — verify

```sql
select count(*) filter (where purity_percent = 99.0) as seeded_left,
       count(*) filter (where purity_percent is not null) as entered
from public.products;
```

Expected: `seeded_left = 0`; `entered` = the number of products whose purity
you set yourself (0 unless you did).

## If you have supplier-stated purity specifications

They belong on the certificate (`coas.purity_percent`, per lot, published
through the Control Room → COA Manager), not on the product row — that is the
only place the site will show them.
