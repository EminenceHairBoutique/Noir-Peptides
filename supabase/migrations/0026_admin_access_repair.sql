-- ════════════════════════════════════════════════════════════════════════
-- Noir Peptides — 0026: repair admin access (profiles read path)
--
-- SYMPTOM: /admin and /admin/labels bounce the admin back to the main page.
-- The client derives admin access STRICTLY from reading its OWN
-- public.profiles row (role = 'admin') through RLS. Migration 0023 newly
-- ENFORCED RLS on profiles; if this database carries stale/missing profiles
-- policies, non-DEFINER helper functions, or a profile row without
-- role='admin', that read silently returns nothing and the UI downgrades to
-- "customer" (the same stale-policy failure mode that emptied the catalog).
--
-- This script (1) prints the current state so the cause is visible, then
-- (2) deterministically restores the canonical functions, the canonical
-- profiles policies, and the admin role for the owner account.
-- Idempotent; safe to run repeatedly.
-- ════════════════════════════════════════════════════════════════════════

-- ── 1. DIAGNOSIS (read these result sets before/after) ──────────────────
select 'rls_enabled' as check, rowsecurity::text as value
  from pg_tables where schemaname = 'public' and tablename = 'profiles';

select 'policy' as check, policyname as value, cmd, qual
  from pg_policies where schemaname = 'public' and tablename = 'profiles';

select 'function' as check, proname as value,
       case when prosecdef then 'SECURITY DEFINER' else 'NOT definer (BROKEN for RLS)' end as security
  from pg_proc
 where pronamespace = 'public'::regnamespace
   and proname in ('is_admin', 'is_attested');

select 'profile_row' as check, p.email as value, p.role,
       (p.role = 'admin')::text as has_admin_role
  from public.profiles p
 where lower(p.email) = lower('deadliftbrahh@gmail.com');

-- ── 2. REPAIR: canonical helper functions (SECURITY DEFINER is REQUIRED —
--     without it these recurse into the profiles policy and every gated
--     read on the site errors) ────────────────────────────────────────────
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

-- ── 3. REPAIR: canonical profiles policies (drop + recreate — name-guarded
--     creation cannot fix a stale definition) ────────────────────────────
alter table public.profiles enable row level security;

drop policy if exists "profiles_select_own" on public.profiles;
create policy "profiles_select_own" on public.profiles
  for select using (id = auth.uid() or public.is_admin());

drop policy if exists "profiles_update_own" on public.profiles;
create policy "profiles_update_own" on public.profiles
  for update using (id = auth.uid()) with check (id = auth.uid());

drop policy if exists "profiles_insert_own" on public.profiles;
create policy "profiles_insert_own" on public.profiles
  for insert with check (id = auth.uid());

-- Base table privileges (Supabase normally grants these by default; restored
-- here in case the table predates the defaults).
do $$
begin
  if exists (select 1 from pg_roles where rolname = 'authenticated') then
    grant select, insert, update on public.profiles to authenticated;
  end if;
end $$;

-- ── 4. REPAIR: ensure the owner's profile row exists and is admin ────────
-- Creates the row from auth.users if the signup trigger never ran, then
-- (re)grants the admin role to the owner account.
insert into public.profiles (id, email)
select u.id, u.email
  from auth.users u
 where lower(u.email) = lower('deadliftbrahh@gmail.com')
on conflict (id) do nothing;

update public.profiles
   set role = 'admin'
 where lower(email) = lower('deadliftbrahh@gmail.com');

-- ── 5. VERIFY ────────────────────────────────────────────────────────────
select 'after_repair' as check, p.email as value, p.role
  from public.profiles p
 where lower(p.email) = lower('deadliftbrahh@gmail.com');
