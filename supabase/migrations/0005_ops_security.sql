-- ════════════════════════════════════════════════════════════════════════
-- Noir Peptides — 0005: operational + security tables (ADDITIVE / IDEMPOTENT)
--
-- rate_limits makes the distributed limiter stop failing open. The remaining
-- tables capture inbound messages, audit trails, and API usage. None are
-- readable by anon/authenticated clients — RLS is enabled with admin-only read
-- where useful; the service role (server) bypasses RLS for writes.
-- ════════════════════════════════════════════════════════════════════════

-- ── 1. rate_limits (backs api/_utils/rateLimit.js) ───────────────────────
create table if not exists public.rate_limits (
  key           text primary key,
  request_count integer not null default 0,
  window_start  timestamptz not null default now()
);
create index if not exists idx_rate_limits_window on public.rate_limits (window_start);

-- ── 2. email_subscribers (reconciles the legacy `email_signups`) ─────────
-- Canonical newsletter table. A backfill from any pre-existing email_signups
-- table is performed once, guarded so it is a no-op when that table is absent.
create table if not exists public.email_subscribers (
  id         bigint generated always as identity primary key,
  email      text unique not null,
  first_name text,
  source     text,
  path       text,
  utm        jsonb,
  consent    jsonb,
  created_at timestamptz not null default now()
);

do $$
begin
  if exists (select 1 from information_schema.tables where table_schema='public' and table_name='email_signups') then
    execute $mig$
      insert into public.email_subscribers (email, first_name, source, path, utm, consent, created_at)
      select email, first_name, source, path, utm, consent, coalesce(created_at, now())
      from public.email_signups
      on conflict (email) do nothing
    $mig$;
  end if;
end $$;

-- ── 3. contact_requests (inbound contact / concierge messages) ───────────
create table if not exists public.contact_requests (
  id         bigint generated always as identity primary key,
  user_id    uuid references auth.users (id) on delete set null,
  type       text,
  email      text,
  full_name  text,
  message    text,
  payload    jsonb,
  created_at timestamptz not null default now()
);
create index if not exists idx_contact_requests_created on public.contact_requests (created_at desc);

-- ── 4. support_tickets ───────────────────────────────────────────────────
create table if not exists public.support_tickets (
  id         bigint generated always as identity primary key,
  user_id    uuid references auth.users (id) on delete set null,
  subject    text,
  body       text,
  status     text not null default 'open',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists idx_support_tickets_user on public.support_tickets (user_id);

-- ── 5. audit_logs (security-relevant actions) ────────────────────────────
create table if not exists public.audit_logs (
  id         bigint generated always as identity primary key,
  actor_id   uuid,
  action     text not null,
  entity     text,
  entity_id  text,
  metadata   jsonb,
  ip         text,
  created_at timestamptz not null default now()
);
create index if not exists idx_audit_logs_created on public.audit_logs (created_at desc);

-- ── 6. api_usage (AI / external API cost + rate accounting) ──────────────
create table if not exists public.api_usage (
  id         bigint generated always as identity primary key,
  user_id    uuid references auth.users (id) on delete set null,
  endpoint   text,
  tokens_in  integer,
  tokens_out integer,
  cost_cents integer,
  created_at timestamptz not null default now()
);
create index if not exists idx_api_usage_created on public.api_usage (created_at desc);

-- ── 7. RLS ───────────────────────────────────────────────────────────────
-- Enabled everywhere. Where no client policy is defined the effect is
-- "deny all" for anon/authenticated; the service role bypasses RLS for writes.
alter table public.rate_limits      enable row level security;
alter table public.email_subscribers enable row level security;
alter table public.contact_requests enable row level security;
alter table public.support_tickets  enable row level security;
alter table public.audit_logs       enable row level security;
alter table public.api_usage        enable row level security;

do $$
begin
  -- Admin-only read for operational tables (service role still writes).
  if not exists (select 1 from pg_policies where schemaname='public' and tablename='contact_requests' and policyname='contact_admin_read') then
    create policy "contact_admin_read" on public.contact_requests
      for select using (public.is_admin());
  end if;
  if not exists (select 1 from pg_policies where schemaname='public' and tablename='audit_logs' and policyname='audit_logs_admin_read') then
    create policy "audit_logs_admin_read" on public.audit_logs
      for select using (public.is_admin());
  end if;
  if not exists (select 1 from pg_policies where schemaname='public' and tablename='api_usage' and policyname='api_usage_admin_read') then
    create policy "api_usage_admin_read" on public.api_usage
      for select using (public.is_admin());
  end if;
  if not exists (select 1 from pg_policies where schemaname='public' and tablename='email_subscribers' and policyname='email_subscribers_admin_read') then
    create policy "email_subscribers_admin_read" on public.email_subscribers
      for select using (public.is_admin());
  end if;

  -- support_tickets: owner reads/creates own; admins read all.
  if not exists (select 1 from pg_policies where schemaname='public' and tablename='support_tickets' and policyname='support_select_own') then
    create policy "support_select_own" on public.support_tickets
      for select using (user_id = auth.uid() or public.is_admin());
  end if;
  if not exists (select 1 from pg_policies where schemaname='public' and tablename='support_tickets' and policyname='support_insert_own') then
    create policy "support_insert_own" on public.support_tickets
      for insert with check (user_id = auth.uid());
  end if;
end $$;
