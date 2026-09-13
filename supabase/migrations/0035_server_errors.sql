-- ════════════════════════════════════════════════════════════════════════
-- 0035 — Server error ledger
--
-- Opt c6 (scorecard 4.12). Every API failure that goes through
-- lib/apiError.js failSafely() already logs a scrubbed line to the function
-- log; nothing reached the Control Room. This table is that ledger: one row
-- per failure, written best-effort with the service role (a failed insert
-- never fails the request), read in the "Errors" tab beside the client-side
-- telemetry (0025). Messages are scrubbed of key shapes before they are
-- written; no request bodies, no PII.
--
-- Idempotent / additive. Admin-only RLS; no client writers.
-- ════════════════════════════════════════════════════════════════════════
create table if not exists public.server_errors (
  id            bigint generated always as identity primary key,
  request_id    text not null,
  code          text,
  context       text,
  status        integer not null default 500,
  message       text not null,
  resolved      boolean not null default false,
  created_at    timestamptz not null default now()
);
create index if not exists idx_server_errors_open
  on public.server_errors (resolved, created_at desc);

alter table public.server_errors enable row level security;

do $$
begin
  if not exists (select 1 from pg_policies where schemaname='public' and tablename='server_errors' and policyname='server_errors_admin_read') then
    create policy "server_errors_admin_read" on public.server_errors
      for select using (public.is_admin());
  end if;
end $$;
-- No insert/update policy: the server writes with the service role.
