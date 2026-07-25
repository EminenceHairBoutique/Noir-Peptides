-- ════════════════════════════════════════════════════════════════════════
-- Noir Peptides — MANUAL RLS (companion to scripts/manual-seed.sql)
--
-- RUN THIS SECOND, after manual-seed.sql. Scoped to EXACTLY the 7 tables that
-- file seeds — NOT the full 32-table set in 0024_policy_reconcile.sql, most
-- of which don't exist on a hand-made database with no migration ledger and
-- would error out immediately if pasted as-is.
--
-- WHY THIS MUST BE RUN, NOT SKIPPED: the Supabase anon key is public — it
-- ships in the browser bundle. Supabase grants anon/authenticated broad
-- table privileges by default; RLS is the ONLY thing that turns "SELECT
-- allowed" into "SELECT only the rows this policy permits." A table with
-- data and RLS OFF is readable AND writable by anyone holding that key
-- (rewrite prices, delete products, forge label configs). Never leave RLS
-- off on a table your seed just populated.
--
-- SAFE / NON-DESTRUCTIVE:
--   * profiles: CREATE TABLE IF NOT EXISTS + ADD COLUMN IF NOT EXISTS only.
--   * is_admin()/is_attested(): CREATE OR REPLACE — pure logic, no data.
--   * Policies: DROP POLICY IF EXISTS + CREATE POLICY — policies are access
--     rules, not rows; dropping and recreating one touches zero data.
--   * RLS enable is a boolean flag on the table, not a data operation.
--   * No table's ROWS are read, altered, or removed by this file.
--
-- Canonical policy definitions copied verbatim from 0024_policy_reconcile.sql
-- (the golden, introspected schema) — same end state, just scoped down.
-- ════════════════════════════════════════════════════════════════════════

set check_function_bodies = off;

-- ── DIAGNOSIS: current state before this script touches anything ─────────
select 'rls_before' as check, tablename, rowsecurity
  from pg_tables
 where schemaname = 'public'
   and tablename in ('products','product_categories','product_variants',
                      'price_tiers','coas','label_configs','label_config_history','profiles')
 order by tablename;

-- ════════════════════════════════════════════════════════════════════════
-- 1. profiles (backs is_admin() / is_attested() — required for the catalog
--    and label policies below to even evaluate without erroring).
-- ════════════════════════════════════════════════════════════════════════
create table if not exists public.profiles (
  id          uuid primary key references auth.users (id) on delete cascade,
  email       text,
  full_name   text,
  role        text not null default 'customer',
  created_at  timestamptz not null default now()
);
alter table public.profiles add column if not exists attestation_completed_at timestamptz;
alter table public.profiles add column if not exists attestation_version      text;
alter table public.profiles add column if not exists attestation_statements   jsonb;
alter table public.profiles add column if not exists attestation_ip           text;
alter table public.profiles add column if not exists attestation_user_agent   text;
alter table public.profiles add column if not exists attestation_legal_name   text;

-- ════════════════════════════════════════════════════════════════════════
-- 2. Helper functions — MUST exist before any policy below (a policy's
--    USING clause is resolved at CREATE POLICY time, unlike a function
--    body, which check_function_bodies=off only defers). SECURITY DEFINER
--    is REQUIRED — without it these recurse into the profiles policy and
--    every gated read on the whole site errors.
-- ════════════════════════════════════════════════════════════════════════
create or replace function public.is_admin()
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'admin');
$$;

create or replace function public.is_attested()
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.profiles p where p.id = auth.uid() and p.attestation_completed_at is not null);
$$;

-- ── profiles RLS (now that is_admin() exists) ─────────────────────────────
alter table public.profiles enable row level security;
drop policy if exists "profiles_select_own" on public.profiles;
create policy "profiles_select_own" on public.profiles for select using ((id = auth.uid()) OR is_admin());
drop policy if exists "profiles_update_own" on public.profiles;
create policy "profiles_update_own" on public.profiles for update using (id = auth.uid()) with check (id = auth.uid());
drop policy if exists "profiles_insert_own" on public.profiles;
create policy "profiles_insert_own" on public.profiles for insert with check (id = auth.uid());

-- ════════════════════════════════════════════════════════════════════════
-- 3. RLS + canonical policies for the 7 seeded tables
--    Catalog tables (products/categories/variants/tiers/coas): PUBLIC read
--    (migration 0013 — the storefront is deliberately public + indexable),
--    plus an attested-or-admin read for symmetry with the rest of the app,
--    plus admin-only write. label_configs / label_config_history: ADMIN
--    ONLY, no public policy at all (public verification goes through
--    /api/verify with the service role instead — never direct table reads).
-- ════════════════════════════════════════════════════════════════════════

alter table public.products enable row level security;
drop policy if exists "products_public_read" on public.products;
create policy "products_public_read" on public.products for select using (true);
drop policy if exists "products_attested_read" on public.products;
create policy "products_attested_read" on public.products for select using ((is_attested() OR is_admin()));
drop policy if exists "products_admin_write" on public.products;
create policy "products_admin_write" on public.products for all using (is_admin()) with check (is_admin());

alter table public.product_categories enable row level security;
drop policy if exists "categories_public_read" on public.product_categories;
create policy "categories_public_read" on public.product_categories for select using (true);
drop policy if exists "categories_attested_read" on public.product_categories;
create policy "categories_attested_read" on public.product_categories for select using ((is_attested() OR is_admin()));

alter table public.product_variants enable row level security;
drop policy if exists "variants_public_read" on public.product_variants;
create policy "variants_public_read" on public.product_variants for select using (true);
drop policy if exists "variants_attested_read" on public.product_variants;
create policy "variants_attested_read" on public.product_variants for select using ((is_attested() OR is_admin()));
drop policy if exists "variants_admin_write" on public.product_variants;
create policy "variants_admin_write" on public.product_variants for all using (is_admin()) with check (is_admin());

alter table public.price_tiers enable row level security;
drop policy if exists "tiers_public_read" on public.price_tiers;
create policy "tiers_public_read" on public.price_tiers for select using (true);
drop policy if exists "tiers_attested_read" on public.price_tiers;
create policy "tiers_attested_read" on public.price_tiers for select using ((is_attested() OR is_admin()));
drop policy if exists "tiers_admin_write" on public.price_tiers;
create policy "tiers_admin_write" on public.price_tiers for all using (is_admin()) with check (is_admin());

alter table public.coas enable row level security;
drop policy if exists "coas_public_read" on public.coas;
create policy "coas_public_read" on public.coas for select using ((is_published IS NOT FALSE));
drop policy if exists "coas_attested_read" on public.coas;
create policy "coas_attested_read" on public.coas for select using ((is_attested() OR is_admin()));
drop policy if exists "coas_admin_write" on public.coas;
create policy "coas_admin_write" on public.coas for all using (is_admin()) with check (is_admin());

alter table public.label_configs enable row level security;
drop policy if exists "label_configs_admin_all" on public.label_configs;
create policy "label_configs_admin_all" on public.label_configs for all using (is_admin()) with check (is_admin());

alter table public.label_config_history enable row level security;
drop policy if exists "label_history_admin_read" on public.label_config_history;
create policy "label_history_admin_read" on public.label_config_history for select using (is_admin());

-- ── VERIFY ────────────────────────────────────────────────────────────────
select 'rls_after' as check, tablename, rowsecurity
  from pg_tables
 where schemaname = 'public'
   and tablename in ('products','product_categories','product_variants',
                      'price_tiers','coas','label_configs','label_config_history','profiles')
 order by tablename;

select 'policy' as check, tablename, policyname, cmd
  from pg_policies
 where schemaname = 'public'
   and tablename in ('products','product_categories','product_variants',
                      'price_tiers','coas','label_configs','label_config_history','profiles')
 order by tablename, policyname;
