-- ════════════════════════════════════════════════════════════════════════
-- Noir Peptides — 0007: partner applications (ADDITIVE / IDEMPOTENT)
--
-- Versions the partner_applications table the api/partners/** and api/admin/**
-- endpoints already read/write (it had no migration). The profile partner
-- columns (account_tier, partner_status, partner_tier) are added in 0004.
-- ════════════════════════════════════════════════════════════════════════

create table if not exists public.partner_applications (
  id                   uuid primary key default gen_random_uuid(),
  user_id              uuid references auth.users (id) on delete set null,
  email                text not null unique,
  full_name            text,
  phone                text,
  business_name        text,
  website_or_instagram text,
  country              text,
  monthly_volume       text,
  interested_in        text,
  message              text,
  status               text not null default 'pending',
  reviewed_by          uuid references auth.users (id) on delete set null,
  reviewed_at          timestamptz,
  partner_tier         text,
  notes                text,
  -- Directory settings (managed by api/partners/directory-settings.js).
  city                 text,
  booking_url          text,
  specialties          jsonb,
  avatar_url           text,
  directory_opt_in     boolean default false,
  created_at           timestamptz not null default now(),
  updated_at           timestamptz not null default now()
);
create index if not exists idx_partner_apps_user   on public.partner_applications (user_id);
create index if not exists idx_partner_apps_status on public.partner_applications (status);

alter table public.partner_applications enable row level security;

do $$
begin
  -- An applicant reads their own row; admins read all. Writes go through the
  -- service role (apply / admin-update endpoints verify identity server-side).
  if not exists (select 1 from pg_policies where schemaname='public' and tablename='partner_applications' and policyname='partner_apps_select_own') then
    create policy "partner_apps_select_own" on public.partner_applications
      for select using (user_id = auth.uid() or public.is_admin());
  end if;
end $$;
