-- 0040_loyalty_nonnegative.sql   (opt cycle 12 — scorecard 4.5 / 4.2)
-- A loyalty balance can never go below zero. lib/rewards.js deducts with a
-- compare-and-swap since opt cycle 12; this constraint is the database's own
-- guarantee behind it. NOT VALID: existing rows are not re-checked on apply
-- (validate once balances are confirmed non-negative, see
-- docs/MIGRATIONS_0040.md). Idempotent; adds nothing else.

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'profiles_loyalty_points_nonnegative'
      and conrelid = 'public.profiles'::regclass
  ) then
    alter table public.profiles
      add constraint profiles_loyalty_points_nonnegative check (loyalty_points >= 0) not valid;
  end if;
end $$;
