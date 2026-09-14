# Applying migration 0040

Follows `docs/MIGRATIONS_0039.md`. Migration **0040** adds one check constraint,
`profiles.loyalty_points >= 0`, as **NOT VALID** — new writes are checked, existing
rows are not re-scanned on apply, so it cannot fail on a balance that is
already negative. It backs the compare-and-swap deduction `lib/rewards.js` uses
since opt cycle 12 (two checkouts can no longer spend the same points twice; a
shortfall is recorded as a `redeem_shortfall` ledger row instead of a silent
clamp). Idempotent.

## Step 1 — apply

**SQL Editor → New query**, paste `supabase/migrations/0040_loyalty_nonnegative.sql`,
run. Expected: `Success. No rows returned.`

## Step 2 — verify and validate

```sql
select count(*) as negative from public.profiles where loyalty_points < 0;
```

Expected `0`. If so, make the constraint fully enforced:

```sql
alter table public.profiles validate constraint profiles_loyalty_points_nonnegative;
```

If it is not 0, those balances predate the compare-and-swap; set them to 0
with a `loyalty_ledger` row explaining the correction, then validate.
