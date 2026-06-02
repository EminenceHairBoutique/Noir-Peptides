-- ════════════════════════════════════════════════════════════════════════
-- Noir Peptides — Phase 1: Authentication Wall + Research-Use Attestation
--
-- This migration makes the storefront wall REAL at the data layer. The
-- client-side route guard is UX; these RLS policies are the actual lock:
-- products, variants, COAs, and orders are only selectable by an
-- authenticated user whose profile has a completed research-use attestation.
--
-- Idempotent / additive where practical. Safe to run after 0001 and 0002.
-- ════════════════════════════════════════════════════════════════════════

-- ── 1. profiles table (create if absent; backs auth + attestation audit) ──
create table if not exists public.profiles (
  id          uuid primary key references auth.users (id) on delete cascade,
  email       text,
  full_name   text,
  role        text not null default 'customer',   -- 'customer' | 'admin'
  created_at  timestamptz not null default now()
);

-- Attestation audit fields (additive).
alter table public.profiles add column if not exists attestation_completed_at timestamptz;
alter table public.profiles add column if not exists attestation_version      text;
alter table public.profiles add column if not exists attestation_statements   jsonb;
alter table public.profiles add column if not exists attestation_ip           text;
alter table public.profiles add column if not exists attestation_user_agent   text;
alter table public.profiles add column if not exists attestation_legal_name   text;

comment on column public.profiles.attestation_completed_at is
  'NULL until the research-use attestation is completed. The auth wall gates on this.';
comment on column public.profiles.attestation_version is
  'Version of the attestation the user agreed to (e.g. v1.0). A newer site version forces re-attestation.';

-- ── 2. Append-only attestation audit log (defensible consent record) ─────
create table if not exists public.attestation_audit (
  id            bigint generated always as identity primary key,
  user_id       uuid not null references auth.users (id) on delete cascade,
  version       text not null,
  statements    jsonb not null,
  legal_name    text not null,
  ip_address    text,
  user_agent    text,
  created_at    timestamptz not null default now()
);

create index if not exists idx_attestation_audit_user on public.attestation_audit (user_id);

-- ── 3. Auto-create a profile row when a new auth user is created ─────────
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, email, full_name)
  values (new.id, new.email, coalesce(new.raw_user_meta_data->>'full_name', ''))
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ── 4. Attestation gate helper — the heart of the data-layer wall ────────
create or replace function public.is_attested()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.profiles p
    where p.id = auth.uid()
      and p.attestation_completed_at is not null
  );
$$;

create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.profiles p
    where p.id = auth.uid() and p.role = 'admin'
  );
$$;

-- ── 5. RLS: profiles ─────────────────────────────────────────────────────
alter table public.profiles enable row level security;

do $$
begin
  if not exists (select 1 from pg_policies where schemaname='public' and tablename='profiles' and policyname='profiles_select_own') then
    create policy "profiles_select_own" on public.profiles
      for select using (id = auth.uid() or public.is_admin());
  end if;
  if not exists (select 1 from pg_policies where schemaname='public' and tablename='profiles' and policyname='profiles_update_own') then
    create policy "profiles_update_own" on public.profiles
      for update using (id = auth.uid()) with check (id = auth.uid());
  end if;
  if not exists (select 1 from pg_policies where schemaname='public' and tablename='profiles' and policyname='profiles_insert_own') then
    create policy "profiles_insert_own" on public.profiles
      for insert with check (id = auth.uid());
  end if;
end $$;

-- ── 6. RLS: attestation_audit (insert own; read own or admin) ────────────
alter table public.attestation_audit enable row level security;

do $$
begin
  if not exists (select 1 from pg_policies where schemaname='public' and tablename='attestation_audit' and policyname='audit_insert_own') then
    create policy "audit_insert_own" on public.attestation_audit
      for insert with check (user_id = auth.uid());
  end if;
  if not exists (select 1 from pg_policies where schemaname='public' and tablename='attestation_audit' and policyname='audit_select_own') then
    create policy "audit_select_own" on public.attestation_audit
      for select using (user_id = auth.uid() or public.is_admin());
  end if;
end $$;

-- ── 7. THE WALL: gate catalog + COAs + orders behind attestation ─────────
-- Replace the prior "public read" policies from migration 0001 with
-- attestation-gated read policies. Admins always retain access.
alter table public.products enable row level security;
drop policy if exists "Public read products" on public.products;
do $$
begin
  if not exists (select 1 from pg_policies where schemaname='public' and tablename='products' and policyname='products_attested_read') then
    create policy "products_attested_read" on public.products
      for select using (public.is_attested() or public.is_admin());
  end if;
end $$;

-- product_variants (create-safe guard: only if table exists)
do $$
begin
  if exists (select 1 from information_schema.tables where table_schema='public' and table_name='product_variants') then
    execute 'alter table public.product_variants enable row level security';
    if not exists (select 1 from pg_policies where schemaname='public' and tablename='product_variants' and policyname='variants_attested_read') then
      execute 'create policy "variants_attested_read" on public.product_variants for select using (public.is_attested() or public.is_admin())';
    end if;
  end if;
end $$;

-- price_tiers
do $$
begin
  if exists (select 1 from information_schema.tables where table_schema='public' and table_name='price_tiers') then
    execute 'alter table public.price_tiers enable row level security';
    if not exists (select 1 from pg_policies where schemaname='public' and tablename='price_tiers' and policyname='tiers_attested_read') then
      execute 'create policy "tiers_attested_read" on public.price_tiers for select using (public.is_attested() or public.is_admin())';
    end if;
  end if;
end $$;

-- coas
do $$
begin
  if exists (select 1 from information_schema.tables where table_schema='public' and table_name='coas') then
    execute 'alter table public.coas enable row level security';
    if not exists (select 1 from pg_policies where schemaname='public' and tablename='coas' and policyname='coas_attested_read') then
      execute 'create policy "coas_attested_read" on public.coas for select using (public.is_attested() or public.is_admin())';
    end if;
  end if;
end $$;

-- product_categories may remain readable so filters render; still require auth.
alter table public.product_categories enable row level security;
drop policy if exists "Public read product_categories" on public.product_categories;
do $$
begin
  if not exists (select 1 from pg_policies where schemaname='public' and tablename='product_categories' and policyname='categories_attested_read') then
    create policy "categories_attested_read" on public.product_categories
      for select using (public.is_attested() or public.is_admin());
  end if;
end $$;

-- orders: a user reads only their own; attestation required to create.
do $$
begin
  if exists (select 1 from information_schema.tables where table_schema='public' and table_name='orders') then
    execute 'alter table public.orders enable row level security';
    if not exists (select 1 from pg_policies where schemaname='public' and tablename='orders' and policyname='orders_select_own') then
      execute 'create policy "orders_select_own" on public.orders for select using (user_id = auth.uid() or public.is_admin())';
    end if;
  end if;
end $$;

-- ── 8. Admin write access to catalog (service role bypasses RLS anyway; ──
--      this allows an authenticated admin UI to manage catalog directly).
do $$
begin
  if not exists (select 1 from pg_policies where schemaname='public' and tablename='products' and policyname='products_admin_write') then
    create policy "products_admin_write" on public.products
      for all using (public.is_admin()) with check (public.is_admin());
  end if;
end $$;
