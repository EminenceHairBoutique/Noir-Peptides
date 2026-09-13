# Applying migration 0038

Follows `docs/MIGRATIONS_0037.md`. Migration **0038** is **update-only** and
**idempotent**: it fills `peptide_sequence`, `molecular_weight` and
`cas_number` on 11 products from `src/data/productSpecs.js` (transcribed from
the retired 0001 seed, each with a named source), using `coalesce` so a value
you already entered in the Control Room is never overwritten. No column, no
row is created. It is GENERATED — `node scripts/gen-specs-migration.mjs` —
and the unit suite byte-compares it.

## Step 1 — apply

**SQL Editor → New query**, paste `supabase/migrations/0038_product_specs.sql`,
run. Expected: `Success. No rows returned.`

## Step 2 — verify

```sql
select count(*) filter (where peptide_sequence is not null) as seq,
       count(*) filter (where molecular_weight is not null) as mw,
       count(*) filter (where cas_number is not null)       as cas
from public.products;   -- ≥ 8 / 11 / 10
```

## Step 3 — the other products

The Control Room → Catalog → **Specs** row per product accepts a sequence,
a molecular weight (`N g/mol`) and a CAS (check-digit validated), as the
supplier document or certificate states them. The Owner Sprint tab (D5b)
counts the coverage. Left for you to verify from source documents:
**TB-500** (the legacy values referenced the parent Tβ4 protein), the
**CJC-1295 (no DAC)** CAS (ambiguous between the DAC and no-DAC forms), and
every product not listed in `productSpecs.js`.

## Rollback

Not needed — values can be cleared per product in the Control Room; the
migration only fills empty fields.
