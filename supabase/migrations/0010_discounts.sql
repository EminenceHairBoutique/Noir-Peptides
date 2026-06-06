-- ════════════════════════════════════════════════════════════════════════
-- Noir Peptides — 0010: discounts / promo-code engine (ADDITIVE / IDEMPOTENT)
--
-- Server-validated promo codes with redemption tracking. Bundles/kits are
-- excluded from stacking (mirrors the market). All copy is claim-safe.
-- ════════════════════════════════════════════════════════════════════════

-- Mark blend/kit products so the discount engine can exclude them.
alter table public.products add column if not exists is_bundle boolean not null default false;
update public.products set is_bundle = true
  where id in ('bpc-157-tb-500', 'selank-semax', 'cjc-1295-ipamorelin', 'glow', 'klow');

create table if not exists public.discounts (
  id               bigint generated always as identity primary key,
  code             text not null unique,
  description      text,
  kind             text not null check (kind in ('percent', 'fixed')),
  value            numeric(10,2) not null check (value >= 0),
  min_subtotal     numeric(10,2) not null default 0,
  max_redemptions  integer,            -- null = unlimited
  per_user_limit   integer default 1,  -- null = unlimited
  excludes_bundles boolean not null default true,
  is_public        boolean not null default false,  -- shown on the Deals page
  active           boolean not null default true,
  starts_at        timestamptz,
  ends_at          timestamptz,
  created_at       timestamptz not null default now()
);

create table if not exists public.discount_redemptions (
  id          bigint generated always as identity primary key,
  discount_id bigint references public.discounts (id) on delete cascade,
  code        text,
  user_id     uuid references auth.users (id) on delete set null,
  order_number text,
  amount      numeric(10,2),
  created_at  timestamptz not null default now()
);
create index if not exists idx_disc_redemptions_disc on public.discount_redemptions (discount_id);
create index if not exists idx_disc_redemptions_user on public.discount_redemptions (user_id);

-- Seed a couple of claim-safe example codes (operator can edit/disable).
insert into public.discounts (code, description, kind, value, min_subtotal, per_user_limit, excludes_bundles, is_public)
values
  ('WELCOME10', 'First-order: 10% off single research SKUs (bundles excluded).', 'percent', 10, 0, 1, true, true),
  ('NOIR15',    'Seasonal: 15% off single research SKUs (bundles excluded).',    'percent', 15, 100, null, true, true),
  ('CRYPTO5',   'Additional 5% when paying via crypto.',                          'percent', 5, 0, null, false, true)
on conflict (code) do update set
  description = excluded.description, kind = excluded.kind, value = excluded.value,
  min_subtotal = excluded.min_subtotal, per_user_limit = excluded.per_user_limit,
  excludes_bundles = excluded.excludes_bundles, is_public = excluded.is_public;

alter table public.discounts            enable row level security;
alter table public.discount_redemptions enable row level security;

do $$
begin
  -- Only public, active codes are client-readable (for the Deals page). Code
  -- validation/redemption happens server-side via the service role.
  if not exists (select 1 from pg_policies where schemaname='public' and tablename='discounts' and policyname='discounts_public_read') then
    create policy "discounts_public_read" on public.discounts
      for select using (is_public = true and active = true);
  end if;
  if not exists (select 1 from pg_policies where schemaname='public' and tablename='discount_redemptions' and policyname='disc_redemptions_select_own') then
    create policy "disc_redemptions_select_own" on public.discount_redemptions
      for select using (user_id = auth.uid() or public.is_admin());
  end if;
end $$;
