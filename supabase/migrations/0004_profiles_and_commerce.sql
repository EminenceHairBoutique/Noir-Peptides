-- ════════════════════════════════════════════════════════════════════════
-- Noir Peptides — 0004: profile extensions + commerce tables
-- (ADDITIVE / IDEMPOTENT). Safe on a fresh DB and on top of 0001–0003.
--
-- Adds the profile columns the app already writes (account tier, partner,
-- loyalty) and the core commerce tables. The `orders` table is shaped to match
-- exactly what api/stripe-webhook.js inserts, so the safeInsertOrder()
-- user_id fallback can be retired.
-- ════════════════════════════════════════════════════════════════════════

-- ── 1. profiles: columns the app already references ──────────────────────
alter table public.profiles add column if not exists account_tier              text    default 'customer';
alter table public.profiles add column if not exists partner_status            text    default 'none';
alter table public.profiles add column if not exists partner_tier              text;
alter table public.profiles add column if not exists loyalty_points            integer default 0;
alter table public.profiles add column if not exists lifetime_spend_cents      bigint  default 0;
alter table public.profiles add column if not exists first_purchase_bonus_awarded boolean default false;

-- ── 2. orders (matches the Stripe webhook insert exactly) ────────────────
create table if not exists public.orders (
  id                    uuid primary key default gen_random_uuid(),
  order_number          text unique not null,
  stripe_session_id     text unique,
  stripe_payment_intent text,
  user_id               uuid references auth.users (id) on delete set null,
  email                 text,
  customer_name         text,
  amount_total          bigint,
  currency              text,
  items                 jsonb default '[]'::jsonb,
  shipping_address      jsonb,
  consent               jsonb default '{}'::jsonb,
  status                text not null default 'paid',
  created_at            timestamptz not null default now(),
  updated_at            timestamptz not null default now()
);
-- Columns added defensively in case an older orders table already exists.
alter table public.orders add column if not exists shipping_address jsonb;
alter table public.orders add column if not exists consent          jsonb default '{}'::jsonb;
alter table public.orders add column if not exists user_id          uuid references auth.users (id) on delete set null;

create index if not exists idx_orders_user    on public.orders (user_id);
create index if not exists idx_orders_email   on public.orders (email);
create index if not exists idx_orders_session on public.orders (stripe_session_id);

-- ── 3. order_items (normalized line items for reporting) ─────────────────
create table if not exists public.order_items (
  id           bigint generated always as identity primary key,
  order_id     uuid not null references public.orders (id) on delete cascade,
  product_id   text,
  product_name text,
  quantity     integer not null default 1,
  unit_amount  bigint,
  amount_total bigint,
  created_at   timestamptz not null default now()
);
create index if not exists idx_order_items_order on public.order_items (order_id);

-- ── 4. product_variants (catalog extension) ──────────────────────────────
create table if not exists public.product_variants (
  id           text primary key,
  product_id   text not null references public.products (id) on delete cascade,
  sku          text unique,
  vial_size_mg numeric(8,2),
  price        numeric(10,2),
  stock_status text default 'in_stock',
  created_at   timestamptz not null default now()
);
create index if not exists idx_variants_product on public.product_variants (product_id);

-- ── 5. price_tiers (volume / bundle pricing — server-trusted) ────────────
create table if not exists public.price_tiers (
  id           bigint generated always as identity primary key,
  product_id   text not null references public.products (id) on delete cascade,
  min_quantity integer not null check (min_quantity >= 1),
  unit_price   numeric(10,2) not null check (unit_price >= 0),
  label        text,
  created_at   timestamptz not null default now(),
  unique (product_id, min_quantity)
);
create index if not exists idx_price_tiers_product on public.price_tiers (product_id);

-- ── 6. coas (Certificates of Analysis) ───────────────────────────────────
create table if not exists public.coas (
  id             bigint generated always as identity primary key,
  product_id     text references public.products (id) on delete cascade,
  batch_number   text,
  file_url       text,
  purity_percent numeric(5,2),
  hplc           text,
  mass_spec      text,
  endotoxin      text,
  tested_at      date,
  created_at     timestamptz not null default now()
);
create index if not exists idx_coas_product on public.coas (product_id);
create index if not exists idx_coas_batch   on public.coas (batch_number);

-- ── 7. shipping_addresses (US-only research addresses) ───────────────────
create table if not exists public.shipping_addresses (
  id          bigint generated always as identity primary key,
  user_id     uuid not null references auth.users (id) on delete cascade,
  name        text,
  line1       text,
  line2       text,
  city        text,
  state       text,
  postal_code text,
  country     text not null default 'US',
  is_default  boolean not null default false,
  created_at  timestamptz not null default now()
);
create index if not exists idx_ship_addr_user on public.shipping_addresses (user_id);

-- ── 8. RLS ───────────────────────────────────────────────────────────────
alter table public.orders             enable row level security;
alter table public.order_items        enable row level security;
alter table public.product_variants   enable row level security;
alter table public.price_tiers        enable row level security;
alter table public.coas               enable row level security;
alter table public.shipping_addresses enable row level security;

do $$
begin
  -- orders: a user reads only their own; admins read all. No anon writes
  -- (the service role bypasses RLS for the webhook insert).
  if not exists (select 1 from pg_policies where schemaname='public' and tablename='orders' and policyname='orders_select_own') then
    create policy "orders_select_own" on public.orders
      for select using (user_id = auth.uid() or public.is_admin());
  end if;

  -- order_items: visible if the parent order is visible to the caller.
  if not exists (select 1 from pg_policies where schemaname='public' and tablename='order_items' and policyname='order_items_select_via_order') then
    create policy "order_items_select_via_order" on public.order_items
      for select using (
        exists (
          select 1 from public.orders o
          where o.id = order_items.order_id
            and (o.user_id = auth.uid() or public.is_admin())
        )
      );
  end if;

  -- catalog-extension tables: attested read (mirrors products), admin write.
  if not exists (select 1 from pg_policies where schemaname='public' and tablename='product_variants' and policyname='variants_attested_read') then
    create policy "variants_attested_read" on public.product_variants
      for select using (public.is_attested() or public.is_admin());
  end if;
  if not exists (select 1 from pg_policies where schemaname='public' and tablename='product_variants' and policyname='variants_admin_write') then
    create policy "variants_admin_write" on public.product_variants
      for all using (public.is_admin()) with check (public.is_admin());
  end if;

  if not exists (select 1 from pg_policies where schemaname='public' and tablename='price_tiers' and policyname='tiers_attested_read') then
    create policy "tiers_attested_read" on public.price_tiers
      for select using (public.is_attested() or public.is_admin());
  end if;
  if not exists (select 1 from pg_policies where schemaname='public' and tablename='price_tiers' and policyname='tiers_admin_write') then
    create policy "tiers_admin_write" on public.price_tiers
      for all using (public.is_admin()) with check (public.is_admin());
  end if;

  if not exists (select 1 from pg_policies where schemaname='public' and tablename='coas' and policyname='coas_attested_read') then
    create policy "coas_attested_read" on public.coas
      for select using (public.is_attested() or public.is_admin());
  end if;
  if not exists (select 1 from pg_policies where schemaname='public' and tablename='coas' and policyname='coas_admin_write') then
    create policy "coas_admin_write" on public.coas
      for all using (public.is_admin()) with check (public.is_admin());
  end if;

  -- shipping_addresses: full owner CRUD; admins may read.
  if not exists (select 1 from pg_policies where schemaname='public' and tablename='shipping_addresses' and policyname='ship_addr_select_own') then
    create policy "ship_addr_select_own" on public.shipping_addresses
      for select using (user_id = auth.uid() or public.is_admin());
  end if;
  if not exists (select 1 from pg_policies where schemaname='public' and tablename='shipping_addresses' and policyname='ship_addr_insert_own') then
    create policy "ship_addr_insert_own" on public.shipping_addresses
      for insert with check (user_id = auth.uid());
  end if;
  if not exists (select 1 from pg_policies where schemaname='public' and tablename='shipping_addresses' and policyname='ship_addr_update_own') then
    create policy "ship_addr_update_own" on public.shipping_addresses
      for update using (user_id = auth.uid()) with check (user_id = auth.uid());
  end if;
  if not exists (select 1 from pg_policies where schemaname='public' and tablename='shipping_addresses' and policyname='ship_addr_delete_own') then
    create policy "ship_addr_delete_own" on public.shipping_addresses
      for delete using (user_id = auth.uid());
  end if;
end $$;
