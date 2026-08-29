# Applying migrations 0032 and 0033

Paste-ready SQL for the Supabase SQL editor, plus what each result means.

Both migrations are **strictly additive** and **idempotent**: they add columns,
tables, constraints and indexes, and they write **no rows**. Nothing is dropped,
renamed, retyped or deleted, so re-running them is safe and rolling forward from
a partial run needs no cleanup.

Validated on a fresh PostgreSQL 16 instance: the full chain `0001 → 0033`
applies clean, re-applies clean a second time, and leaves `labs` and
`batch_tests` empty with RLS enabled.

---

## Order

Run **0032 first**, then **0033**. They touch different tables (`coas`/`labs`
vs `products`) and do not depend on each other, but the code assumes both.

---

## Step 1 — apply the migrations

In the Supabase dashboard: **SQL Editor → New query**.

Paste the entire contents of each file and run it:

- `supabase/migrations/0032_labs_batch_tests_two_factor.sql`
- `supabase/migrations/0033_sds_and_lab_supplies.sql`

**Expected result:** `Success. No rows returned.`

`NOTICE: relation "…" already exists, skipping` lines are normal and mean the
migration is doing its job — they appear on a re-run, or when part of it was
applied before. They are not errors.

---

## Step 2 — verify 0032 (two-factor lot verification)

```sql
-- New tables exist, RLS is ON, and each has a public-read policy.
select c.relname                              as table_name,
       c.relrowsecurity                       as rls_enabled,
       (select count(*) from pg_policies p
         where p.schemaname = 'public' and p.tablename = c.relname) as policies
from pg_class c
join pg_namespace n on n.oid = c.relnamespace
where n.nspname = 'public'
  and c.relname in ('labs', 'batch_tests')
order by c.relname;
```

**Expect:** two rows, `rls_enabled = true`, `policies >= 1` each.
If `rls_enabled` is `false` for either, stop — do not enter data until it is on.

```sql
-- The certificate columns that make a lot independently checkable.
select column_name, data_type, is_nullable
from information_schema.columns
where table_schema = 'public' and table_name = 'coas'
  and column_name in ('lab_id','lab_lookup_code','purity_operator',
                      'net_peptide_content_mg','label_claim_mg',
                      'published_on','status')
order by column_name;
```

**Expect:** all seven rows, every one `is_nullable = YES`. Nullable is the point
— existing certificates stay valid and unmodified until you fill these in.

```sql
-- One certificate per (product, lot): the guard against a duplicate lot record.
select indexname from pg_indexes
where schemaname = 'public' and indexname = 'uq_coas_product_lot';
```

**Expect:** one row.

If this returns **no rows** and the migration reported an error about a
duplicate key, you already have two certificates sharing a product and lot
number. Find them before re-running:

```sql
select product_id, lot_number, count(*)
from public.coas
where product_id is not null and lot_number is not null
group by product_id, lot_number
having count(*) > 1;
```

Resolve those duplicates (keep the correct certificate, delete or re-lot the
other), then re-run 0032.

```sql
-- The migration seeds NOTHING. These must both be zero.
select (select count(*) from public.labs)        as labs,
       (select count(*) from public.batch_tests) as batch_tests;
```

**Expect:** `0` and `0`. Laboratory records and analytical panels are real-world
data; the migration will never invent them.

---

## Step 3 — verify 0033 (Safety Data Sheets + lab supplies)

```sql
select column_name, data_type, column_default, is_nullable
from information_schema.columns
where table_schema = 'public' and table_name = 'products'
  and column_name in ('sds_file_url','sds_updated_at','product_type')
order by column_name;
```

**Expect:** three rows. `product_type` carries `'peptide'::text` as its default;
the two SDS columns default to null.

```sql
select conname, pg_get_constraintdef(oid)
from pg_constraint where conname = 'products_product_type_check';
```

**Expect:** one row constraining `product_type` to `peptide` or `lab_supply`,
while still permitting NULL.

```sql
-- Existing catalogue is untouched: every product is a peptide, none has an SDS.
select count(*)                                              as total,
       count(*) filter (where product_type = 'peptide')      as peptides,
       count(*) filter (where product_type = 'lab_supply')   as lab_supplies,
       count(*) filter (where sds_file_url is not null)      as with_sds
from public.products;
```

**Expect:** `lab_supplies = 0` and `with_sds = 0`, with `peptides = total`.
Anything else means data was already present — investigate before proceeding.

---

## Step 4 — repository checks

Both commands talk to the live project, so they need credentials first. Without
them each one prints setup instructions and does nothing — it does not pass.

**Set the credentials once (works on Windows, macOS and Linux alike):**

1. Copy `.env.example` to `.env` in the repository root. `.env` is gitignored,
   so the keys never get committed.
2. Fill in three values from **Supabase dashboard → Settings → API**:

   | Variable | Where it comes from |
   | --- | --- |
   | `VITE_SUPABASE_URL` | Project URL |
   | `VITE_SUPABASE_ANON_KEY` | `anon` `public` key |
   | `SUPABASE_SERVICE_ROLE_KEY` | `service_role` secret — **server-only, never commit or paste into a browser** |

3. Run the checks. Both npm scripts read `.env` automatically:

```
npm run verify:rls   # policies behave as written
npm run db:verify    # read-only reachability of the expected tables/columns
```

If you would rather not keep a `.env`, set the variables for one shell session
instead — note that `export` is bash syntax and does **not** work in PowerShell:

```powershell
# PowerShell
$env:VITE_SUPABASE_URL="https://<project-ref>.supabase.co"
$env:VITE_SUPABASE_ANON_KEY="<anon-key>"
$env:SUPABASE_SERVICE_ROLE_KEY="<service-role-key>"
```

```bash
# bash / zsh
export VITE_SUPABASE_URL=https://<project-ref>.supabase.co
export VITE_SUPABASE_ANON_KEY=<anon-key>
export SUPABASE_SERVICE_ROLE_KEY=<service-role-key>
```

**What each proves.** `verify:rls` confirms `profiles`, `orders` and
`attestation_audit` are invisible to the anon key, and that a signed-in user
cannot promote itself to admin. `db:verify` is strictly read-only: it compares
live row counts against the static catalogue and reports drift. Run them after
applying the migrations, not before.

---

## What to enter afterwards (owner work)

Nothing below is generated by code, and none of it may be invented.

**Two-factor verification (0032).** The design goal is that a lot resolves
against the *issuing laboratory's own public record*, not only against this
site — that is the bar third-party vendor-audit sites treat as confirmation.

1. Add each laboratory to `public.labs`: `name`, `accreditation_body`,
   `accreditation_number`, and `public_lookup_url_template`.
   The template must be an **https** URL containing the literal placeholder
   `{code}`, for example
   `https://lab.example.org/reports?id={code}`.
   A template without `{code}`, or on plain http, renders **no link at all** —
   the UI refuses to build a trust link it cannot verify.
2. On each certificate, set `lab_id` and `lab_lookup_code` (the identifier that
   laboratory uses for the report). Only when both are present does the
   "verify at lab" link appear.
3. Where a purity value is qualified rather than exact, set `purity_operator`
   (e.g. `>=`) so `≥ 99%` is never displayed as an exact `99%`.
4. Record `net_peptide_content_mg` and `label_claim_mg` where the batch was
   assayed for content. Both null simply hides that comparison.
5. Add analytical results to `batch_tests`, one row per analysis, with
   `panel_category` set to `identity_potency`, `contamination`, or
   `integrity_stability`.

**Safety Data Sheets (0033).** In the Control Room, expand a product in the
catalog manager and fill the SDS row: the sheet URL (absolute **https**), its
revision date, and the product type. Clearing the URL removes the sheet — use
that when a document is withdrawn, rather than leaving a dead link. Products
without a sheet are listed on `/documents` as lacking one; they are never given
a placeholder.

**Lab supplies (0033).** Set `product_type = 'lab_supply'` on consumables. They
then appear in the cart as available additions. They must have at least one
purchasable variant, or they cannot be priced server-side and are skipped.
