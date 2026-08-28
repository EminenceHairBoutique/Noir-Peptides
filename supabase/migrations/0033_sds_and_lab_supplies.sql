-- ════════════════════════════════════════════════════════════════════════
-- 0033 — Safety Data Sheets + lab-supply product type
--
-- Task 2: every product needs a downloadable GHS 16-section SDS. It is also a
-- required item in high-risk merchant underwriting packets, which is why this
-- is a launch dependency rather than a nicety.
--
-- Task 8: `lab_supply` marks consumables (bacteriostatic water, syringes,
-- alcohol prep pads) so they can be surfaced as attach items WITHOUT any
-- usage or reconstitution guidance — they are sold as laboratory consumables.
--
-- STRICTLY ADDITIVE: two nullable columns and one defaulted column. No column
-- is dropped, renamed or retyped; no row is written or deleted. NO SDS FILE
-- IS REFERENCED — authoring SDS documents is owner work, and every render
-- path treats a null URL as "no SDS published" rather than a dead link.
--
-- Idempotent. Rollback (comment only):
--   alter table public.products drop column if exists sds_file_url;
--   alter table public.products drop column if exists sds_updated_at;
--   alter table public.products drop column if exists product_type;
-- ════════════════════════════════════════════════════════════════════════

alter table public.products add column if not exists sds_file_url   text;
alter table public.products add column if not exists sds_updated_at date;

-- 'peptide' is the existing catalogue; 'lab_supply' is a consumable.
alter table public.products add column if not exists product_type text default 'peptide';

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'products_product_type_check') then
    alter table public.products
      add constraint products_product_type_check
      check (product_type is null or product_type in ('peptide', 'lab_supply'));
  end if;
end $$;

-- Supports the /documents index, which lists products that actually have a
-- published SDS.
create index if not exists idx_products_sds
  on public.products (id)
  where sds_file_url is not null;

create index if not exists idx_products_product_type
  on public.products (product_type)
  where product_type is not null;
