-- ════════════════════════════════════════════════════════════════════════
-- Noir Peptides — 0012: back-in-stock / preorder notifications (ADDITIVE)
--
-- Email capture for out-of-stock or preorder variants. Writes go through the
-- server (service role); clients read only their own subscriptions.
-- ════════════════════════════════════════════════════════════════════════

create table if not exists public.back_in_stock_subscriptions (
  id         bigint generated always as identity primary key,
  product_id text references public.products (id) on delete cascade,
  variant_id text references public.product_variants (id) on delete set null,
  email      text not null,
  user_id    uuid references auth.users (id) on delete set null,
  notified   boolean not null default false,
  created_at timestamptz not null default now(),
  unique (email, variant_id)
);
create index if not exists idx_bis_variant on public.back_in_stock_subscriptions (variant_id) where notified = false;

alter table public.back_in_stock_subscriptions enable row level security;

do $$
begin
  if not exists (select 1 from pg_policies where schemaname='public' and tablename='back_in_stock_subscriptions' and policyname='bis_select_own') then
    create policy "bis_select_own" on public.back_in_stock_subscriptions
      for select using (user_id = auth.uid() or public.is_admin());
  end if;
  -- No client insert policy: subscriptions are created by api/back-in-stock.js
  -- (service role) after validation + rate limiting.
end $$;
