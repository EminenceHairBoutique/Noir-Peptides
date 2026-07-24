-- supabase/migrations/0022_attestation_columns_backfill.sql
-- Fix "Failed to record attestation". On this database, migration 0003's
-- attestation setup did not fully apply — the attestation_audit table is
-- missing entirely, and profiles is missing the legal-name column — so
-- /api/attestation's writes fail. This migration is SELF-SUFFICIENT: it
-- creates the table if absent, backfills columns if the table exists in an
-- older shape, and (re)applies the RLS. Idempotent and additive; safe on a
-- database where 0003 already ran in full.
--
-- The endpoint writes via the service role (bypasses RLS), so the table +
-- columns are what actually unblock it; RLS is restored to match 0003.

-- Append-only consent record.
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

-- Backfill columns if an older/partial attestation_audit already existed
-- (create-table-if-not-exists never adds columns to an existing table).
alter table public.attestation_audit add column if not exists version    text;
alter table public.attestation_audit add column if not exists statements jsonb;
alter table public.attestation_audit add column if not exists legal_name text;
alter table public.attestation_audit add column if not exists ip_address text;
alter table public.attestation_audit add column if not exists user_agent text;
-- 0015 additions (checkout consent linkage) — ensure present too.
alter table public.attestation_audit add column if not exists order_id   text;
alter table public.attestation_audit add column if not exists context    text;

create index if not exists idx_attestation_audit_user on public.attestation_audit (user_id);

-- RLS: locked to the row owner (admins via is_admin() when it exists). The app
-- writes through /api/attestation with the service role, which bypasses RLS.
alter table public.attestation_audit enable row level security;
do $$
begin
  if not exists (select 1 from pg_policies where schemaname='public' and tablename='attestation_audit' and policyname='audit_insert_own') then
    create policy "audit_insert_own" on public.attestation_audit
      for insert with check (user_id = auth.uid());
  end if;
  if not exists (select 1 from pg_policies where schemaname='public' and tablename='attestation_audit' and policyname='audit_select_own') then
    if exists (select 1 from pg_proc where proname = 'is_admin' and pronamespace = 'public'::regnamespace) then
      create policy "audit_select_own" on public.attestation_audit
        for select using (user_id = auth.uid() or public.is_admin());
    else
      create policy "audit_select_own" on public.attestation_audit
        for select using (user_id = auth.uid());
    end if;
  end if;
end $$;

-- Profile snapshot the auth wall reads.
alter table public.profiles add column if not exists attestation_legal_name   text;
alter table public.profiles add column if not exists attestation_completed_at timestamptz;
alter table public.profiles add column if not exists attestation_version      text;
alter table public.profiles add column if not exists attestation_statements   jsonb;
alter table public.profiles add column if not exists attestation_ip           text;
alter table public.profiles add column if not exists attestation_user_agent   text;
