-- ════════════════════════════════════════════════════════════════════════
-- Noir Peptides — 0028: tracked inventory per dosage variant
--
-- Until now stock_status was a hand-flipped label: nothing decremented when
-- an order was paid, nothing prevented overselling a batch. This adds real
-- counting at the VARIANT level (the unit that is actually stocked):
--
--   * inventory_count    — NULL means UNTRACKED: the variant keeps today's
--                          manual stock_status behavior exactly (so this
--                          migration changes nothing until the owner enters
--                          a count in the Control Room Catalog tab).
--                          A number means TRACKED: paid orders decrement it
--                          (floor 0) and stock_status is DERIVED from it.
--   * low_stock_threshold — count at/below which a tracked variant shows
--                          low_stock (0 always means out_of_stock).
--
-- Derivation + decrement live server-side in lib/inventory.js /
-- lib/payments/fulfillment.js (service role); the oversell guard lives in
-- lib/pricing.js so BOTH payment rails inherit it.
--
-- Idempotent / additive. No data changed; no defaults backfilled into
-- inventory_count (every variant starts untracked by design).
-- ════════════════════════════════════════════════════════════════════════

alter table public.product_variants add column if not exists inventory_count     integer;
alter table public.product_variants add column if not exists low_stock_threshold integer not null default 5;

-- Counts can never go negative; the floor is enforced in code too, but the
-- constraint makes the invariant durable against any future writer.
do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'product_variants_inventory_nonneg'
  ) then
    alter table public.product_variants
      add constraint product_variants_inventory_nonneg
      check (inventory_count is null or inventory_count >= 0);
  end if;
end $$;

comment on column public.product_variants.inventory_count is
  'NULL = untracked (manual stock_status). Number = tracked: decremented by paid orders; stock_status derived (0=out, <=threshold=low, else in stock).';
