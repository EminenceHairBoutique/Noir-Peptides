-- ════════════════════════════════════════════════════════════════════════
-- Noir Peptides — 0018: vial label configs + approval workflow + history
--
-- Backs the RUO label system (Label Studio at /admin/labels). Each row is a
-- label configuration for a product (optionally a specific variant): visual
-- template, physical preset, batch identification (lot / dates / barcode /
-- verification code), storage wording, and an explicit approval status.
--
-- COMPLIANCE:
--   * RUO warnings are NOT stored per-row — they render from shared constants
--     (lib/labelConstants.js) so wording can never drift or be edited away.
--   * storage_source_verified defaults FALSE: unverified storage renders a
--     safe placeholder, never fabricated temperatures.
--   * composition (blends) is entered by the owner; the renderer shows
--     "pending admin input" when quantities are absent — never invented.
--   * Only status approved/production_ready may render outside the studio.
--
-- SECURITY: RLS admin-only (is_admin()); NO public policies. Public
-- verification reads go exclusively through /api/verify (service role,
-- whitelisted fields, rate-limited). verification_code is a non-sequential
-- random Crockford-base32 string (UNIQUE, stored uppercase).
--
-- Idempotent / additive.
-- ════════════════════════════════════════════════════════════════════════

create table if not exists public.label_configs (
  id                       uuid primary key default gen_random_uuid(),
  product_id               text not null references public.products (id) on delete cascade,
  variant_id               text references public.product_variants (id) on delete set null,

  -- Visual design + physical die
  template_id              text not null default 'noir-clinical-core'
                           check (template_id in ('noir-clinical-core','spectral-biotech','cryogenic-white','neural-grid')),
  default_preset           text not null default 'full_wrap'
                           check (default_preset in ('full_wrap','partial','front','neck','cap')),
  accent_family            text,

  -- Workflow
  label_version            integer not null default 1,
  status                   text not null default 'draft'
                           check (status in ('draft','in_review','changes_requested','approved','production_ready','archived')),
  revision_notes           text,
  approved_at              timestamptz,
  approved_by              uuid,

  -- Display fields (denormalized snapshot so an approved label never shifts
  -- under catalog edits; seeded from products/variants at creation)
  display_name             text not null,
  quantity_label           text not null,
  material_type            text,
  composition              jsonb,          -- [{name, quantity}] — owner-entered only
  net_contents             text,           -- free text; NOT derived
  fill_note                text,

  -- Identification
  sku                      text not null,
  lot_number               text,
  batch_number             text,
  packaged_date            date,
  expiration_date          date,
  retest_date              date,
  barcode_value            text,
  verification_code        text unique,    -- uppercase Crockford base32

  -- Storage wording (verified-only; placeholder otherwise)
  storage_short            text,
  storage_full             text,
  storage_source_verified  boolean not null default false,

  -- Optional legal/origin lines (owner-supplied, never fabricated)
  manufacturer             text,
  distributed_by           text,
  country_of_origin        text,

  -- State flags + assets
  recalled                 boolean not null default false,
  print_asset_url          text,
  flat_preview_url         text,
  wrapped_texture_url      text,
  static_vial_render_url   text,

  created_by               uuid,
  created_at               timestamptz not null default now(),
  updated_at               timestamptz not null default now()
);

create index if not exists idx_label_configs_product on public.label_configs (product_id, variant_id);
create index if not exists idx_label_configs_status  on public.label_configs (status);
create unique index if not exists idx_label_configs_code_upper on public.label_configs (upper(verification_code));

-- Append-only version history (snapshot on every mutation; supports restore).
create table if not exists public.label_config_history (
  id          bigint generated always as identity primary key,
  config_id   uuid not null references public.label_configs (id) on delete cascade,
  action      text not null,             -- created | updated | status:<to> | restored
  snapshot    jsonb not null,
  actor_id    uuid,
  created_at  timestamptz not null default now()
);

create index if not exists idx_label_history_config on public.label_config_history (config_id, created_at desc);

-- ── RLS: admin-only; NO public policies ──────────────────────────────────
alter table public.label_configs enable row level security;
alter table public.label_config_history enable row level security;

do $$
begin
  if not exists (select 1 from pg_policies where schemaname='public' and tablename='label_configs' and policyname='label_configs_admin_all') then
    create policy "label_configs_admin_all" on public.label_configs
      for all using (public.is_admin()) with check (public.is_admin());
  end if;
  if not exists (select 1 from pg_policies where schemaname='public' and tablename='label_config_history' and policyname='label_history_admin_read') then
    create policy "label_history_admin_read" on public.label_config_history
      for select using (public.is_admin());
  end if;
end $$;
