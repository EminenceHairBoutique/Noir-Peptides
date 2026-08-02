-- ════════════════════════════════════════════════════════════════════════
-- Noir Peptides — 0013: Public catalog READS (indexability)
--
-- WHY: migration 0003 put the entire catalog behind the attestation wall
-- (products / variants / price_tiers / categories / COAs were selectable only
-- by an attested user). That made every product page un-indexable — crawlers
-- and AI assistants saw an empty shell. To make the catalog discoverable we
-- expose READ-ONLY catalog data to anonymous visitors.
--
-- WHAT STAYS GATED (unchanged): identity + commerce.
--   * orders            — user reads only their own (0003 policy retained)
--   * profiles          — own row only
--   * attestation_audit — own row only
--   * checkout          — still requires a CURRENT attestation, enforced
--                         server-side in api/create-checkout-session.js and
--                         api/btcpay/create-invoice.js (403 without it)
--
-- So: anyone may BROWSE the catalog + COAs; only an attested, authenticated
-- user may PURCHASE. This intentionally relaxes ONLY the read-wall from 0003.
--
-- PERMISSIVE policies are OR-ed together, so adding a `using (true)` SELECT
-- policy alongside the existing attested-read policy makes the table publicly
-- readable without dropping anything. Idempotent / additive.
-- ════════════════════════════════════════════════════════════════════════

-- products
do $$
begin
  if not exists (select 1 from pg_policies where schemaname='public' and tablename='products' and policyname='products_public_read') then
    create policy "products_public_read" on public.products for select using (true);
  end if;
end $$;

-- product_variants
do $$
begin
  if exists (select 1 from information_schema.tables where table_schema='public' and table_name='product_variants') then
    if not exists (select 1 from pg_policies where schemaname='public' and tablename='product_variants' and policyname='variants_public_read') then
      execute 'create policy "variants_public_read" on public.product_variants for select using (true)';
    end if;
  end if;
end $$;

-- price_tiers
do $$
begin
  if exists (select 1 from information_schema.tables where table_schema='public' and table_name='price_tiers') then
    if not exists (select 1 from pg_policies where schemaname='public' and tablename='price_tiers' and policyname='tiers_public_read') then
      execute 'create policy "tiers_public_read" on public.price_tiers for select using (true)';
    end if;
  end if;
end $$;

-- product_categories
do $$
begin
  if not exists (select 1 from pg_policies where schemaname='public' and tablename='product_categories' and policyname='categories_public_read') then
    create policy "categories_public_read" on public.product_categories for select using (true);
  end if;
end $$;

-- coas (Certificates of Analysis) — public, verifiable trust signal (Task 3).
do $$
begin
  if exists (select 1 from information_schema.tables where table_schema='public' and table_name='coas') then
    if not exists (select 1 from pg_policies where schemaname='public' and tablename='coas' and policyname='coas_public_read') then
      execute 'create policy "coas_public_read" on public.coas for select using (true)';
    end if;
  end if;
end $$;
