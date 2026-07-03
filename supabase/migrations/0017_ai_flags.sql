-- ════════════════════════════════════════════════════════════════════════
-- Noir Peptides — 0017: AI safety flag log (refusals + flagged requests)
--
-- Every time an AI endpoint REFUSES (pre-call dosing/administration detector or
-- post-call output backstop), the server records a row here so admins can
-- review what users are asking and whether the guardrail behaved. Insert is
-- server-only (service role); admins read + mark reviewed.
--
-- Idempotent / additive.
-- ════════════════════════════════════════════════════════════════════════

create table if not exists public.ai_flags (
  id          bigint generated always as identity primary key,
  user_id     uuid references auth.users (id) on delete set null,
  feature     text,
  kind        text not null default 'refusal',   -- 'refusal' | 'flag'
  prompt      text,
  reply       text,
  reviewed    boolean not null default false,
  created_at  timestamptz not null default now()
);

create index if not exists idx_ai_flags_reviewed on public.ai_flags (reviewed, created_at desc);
create index if not exists idx_ai_flags_user on public.ai_flags (user_id);

alter table public.ai_flags enable row level security;

-- Admin-only read + update. No INSERT policy → only the service role (server)
-- can write flags; clients can never forge them.
do $$
begin
  if not exists (select 1 from pg_policies where schemaname='public' and tablename='ai_flags' and policyname='ai_flags_admin_read') then
    create policy "ai_flags_admin_read" on public.ai_flags for select using (public.is_admin());
  end if;
  if not exists (select 1 from pg_policies where schemaname='public' and tablename='ai_flags' and policyname='ai_flags_admin_update') then
    create policy "ai_flags_admin_update" on public.ai_flags for update using (public.is_admin()) with check (public.is_admin());
  end if;
end $$;
