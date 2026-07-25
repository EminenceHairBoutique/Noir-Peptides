-- ════════════════════════════════════════════════════════════════════════
-- Noir Peptides — 0025: first-party client error telemetry
--
-- Production JS errors (window.onerror, unhandled promise rejections, React
-- ErrorBoundary catches) are reported to /api/client-error, which writes here
-- with the service role. Rows with the same fingerprint within a day are
-- collapsed by incrementing `hits` instead of appending, so one hot bug can't
-- flood the table. Admins review + resolve in the Control Room "Errors" tab.
--
-- Idempotent / additive. Self-sufficient (no dependency on other drift).
-- ════════════════════════════════════════════════════════════════════════

create table if not exists public.client_errors (
  id            bigint generated always as identity primary key,
  fingerprint   text not null,                       -- server-computed hash of message+stack head+source
  message       text not null,
  stack         text,
  source        text not null default 'window',      -- 'window' | 'promise' | 'boundary'
  path          text,                                -- pathname where it happened
  user_agent    text,
  user_id       uuid references auth.users (id) on delete set null,
  hits          integer not null default 1,
  resolved      boolean not null default false,
  first_seen_at timestamptz not null default now(),
  last_seen_at  timestamptz not null default now()
);

create index if not exists idx_client_errors_fingerprint
  on public.client_errors (fingerprint, last_seen_at desc);
create index if not exists idx_client_errors_open
  on public.client_errors (resolved, last_seen_at desc);

alter table public.client_errors enable row level security;

-- Admin-only read + update (resolve). No INSERT policy → only the service
-- role (the /api/client-error endpoint) can write; clients can never insert
-- or read telemetry directly.
do $$
begin
  if not exists (select 1 from pg_policies where schemaname='public' and tablename='client_errors' and policyname='client_errors_admin_read') then
    create policy "client_errors_admin_read" on public.client_errors for select using (public.is_admin());
  end if;
  if not exists (select 1 from pg_policies where schemaname='public' and tablename='client_errors' and policyname='client_errors_admin_update') then
    create policy "client_errors_admin_update" on public.client_errors for update using (public.is_admin()) with check (public.is_admin());
  end if;
end $$;
