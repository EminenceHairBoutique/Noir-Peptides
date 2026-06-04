-- ════════════════════════════════════════════════════════════════════════
-- Noir Peptides — 0006: engagement tables (ADDITIVE / IDEMPOTENT)
--
-- loyalty_ledger matches the entries api/stripe-webhook.js writes. wishlist_items
-- consolidates the overlapping "saved products" / "wishlist" idea into ONE
-- table. research_articles backs the public, indexable (non-commerce)
-- education pages built in Checkpoint 3.
-- ════════════════════════════════════════════════════════════════════════

-- ── 1. loyalty_ledger (append-only points history) ───────────────────────
create table if not exists public.loyalty_ledger (
  id                bigint generated always as identity primary key,
  user_id           uuid not null references auth.users (id) on delete cascade,
  delta             integer not null,
  reason            text,
  order_number      text,
  stripe_session_id text,
  created_at        timestamptz not null default now()
);
create index if not exists idx_loyalty_ledger_user on public.loyalty_ledger (user_id);

-- ── 2. wishlist_items (consolidated saved products / wishlist) ───────────
create table if not exists public.wishlist_items (
  id         bigint generated always as identity primary key,
  user_id    uuid not null references auth.users (id) on delete cascade,
  product_id text not null references public.products (id) on delete cascade,
  created_at timestamptz not null default now(),
  unique (user_id, product_id)
);
create index if not exists idx_wishlist_user on public.wishlist_items (user_id);

-- ── 3. referral_codes (one code per researcher) ──────────────────────────
create table if not exists public.referral_codes (
  id         bigint generated always as identity primary key,
  user_id    uuid not null unique references auth.users (id) on delete cascade,
  code       text not null unique,
  created_at timestamptz not null default now()
);

-- ── 4. referral_rewards ──────────────────────────────────────────────────
create table if not exists public.referral_rewards (
  id               bigint generated always as identity primary key,
  referrer_id      uuid not null references auth.users (id) on delete cascade,
  referred_user_id uuid references auth.users (id) on delete set null,
  order_number     text,
  reward_points    integer not null default 0,
  status           text not null default 'pending',
  created_at       timestamptz not null default now()
);
create index if not exists idx_referral_rewards_referrer on public.referral_rewards (referrer_id);

-- ── 5. research_articles (PUBLIC, indexable education content) ────────────
-- No price, no buy button — the only SEO surface compatible with the wall.
create table if not exists public.research_articles (
  id            bigint generated always as identity primary key,
  slug          text not null unique,
  title         text not null,
  summary       text,
  body          text,
  compound_refs jsonb default '[]'::jsonb,
  published     boolean not null default false,
  published_at  timestamptz,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);
create index if not exists idx_research_articles_published on public.research_articles (published);

-- ── 6. RLS ───────────────────────────────────────────────────────────────
alter table public.loyalty_ledger    enable row level security;
alter table public.wishlist_items    enable row level security;
alter table public.referral_codes    enable row level security;
alter table public.referral_rewards  enable row level security;
alter table public.research_articles enable row level security;

do $$
begin
  -- loyalty_ledger: owner read only (writes are service-role).
  if not exists (select 1 from pg_policies where schemaname='public' and tablename='loyalty_ledger' and policyname='loyalty_select_own') then
    create policy "loyalty_select_own" on public.loyalty_ledger
      for select using (user_id = auth.uid() or public.is_admin());
  end if;

  -- wishlist_items: full owner CRUD.
  if not exists (select 1 from pg_policies where schemaname='public' and tablename='wishlist_items' and policyname='wishlist_select_own') then
    create policy "wishlist_select_own" on public.wishlist_items
      for select using (user_id = auth.uid());
  end if;
  if not exists (select 1 from pg_policies where schemaname='public' and tablename='wishlist_items' and policyname='wishlist_insert_own') then
    create policy "wishlist_insert_own" on public.wishlist_items
      for insert with check (user_id = auth.uid());
  end if;
  if not exists (select 1 from pg_policies where schemaname='public' and tablename='wishlist_items' and policyname='wishlist_delete_own') then
    create policy "wishlist_delete_own" on public.wishlist_items
      for delete using (user_id = auth.uid());
  end if;

  -- referral_codes / referral_rewards: owner read; writes are service-role.
  if not exists (select 1 from pg_policies where schemaname='public' and tablename='referral_codes' and policyname='referral_codes_select_own') then
    create policy "referral_codes_select_own" on public.referral_codes
      for select using (user_id = auth.uid() or public.is_admin());
  end if;
  if not exists (select 1 from pg_policies where schemaname='public' and tablename='referral_rewards' and policyname='referral_rewards_select_own') then
    create policy "referral_rewards_select_own" on public.referral_rewards
      for select using (referrer_id = auth.uid() or public.is_admin());
  end if;

  -- research_articles: PUBLIC read of published rows; admin writes/reads all.
  if not exists (select 1 from pg_policies where schemaname='public' and tablename='research_articles' and policyname='research_articles_public_read') then
    create policy "research_articles_public_read" on public.research_articles
      for select using (published = true or public.is_admin());
  end if;
  if not exists (select 1 from pg_policies where schemaname='public' and tablename='research_articles' and policyname='research_articles_admin_write') then
    create policy "research_articles_admin_write" on public.research_articles
      for all using (public.is_admin()) with check (public.is_admin());
  end if;
end $$;
