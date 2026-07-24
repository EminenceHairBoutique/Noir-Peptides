-- supabase/migrations/0023_full_schema_reconcile.sql
-- GENERATED from the golden schema (all migrations 0001-0022 applied to a
-- fresh Postgres 16) by introspecting the live catalog - one migration that
-- guarantees EVERY public table, column, index, function, RLS flag, and
-- policy exists, regardless of which historical migrations (or versions of
-- them) a database ran. Fixes schema drift in one pass.
--
-- Fully idempotent:
--   * create table if not exists  (full definition, for missing tables)
--   * add column if not exists    (per column, for tables in older shapes;
--     added columns are nullable - NOT NULL can't be retrofitted onto
--     existing rows safely)
--   * create index if not exists  / create or replace function
--   * policies + RLS guarded via pg_policies checks
--   * pgvector objects (embeddings / match_embeddings) verbatim from 0008
--
-- NOT covered (cannot be reconciled safely/automatically): column TYPE
-- changes on existing columns, and adding FK/unique constraints to tables
-- that already exist without them. Neither affects app behavior today.
--
-- After running this, re-run the idempotent seeds if their data is missing:
-- 0009 (catalog), 0019 (COAs), 0020 (label drafts), 0021 (label batch data).

set check_function_bodies = off;


-- ══ 1. Tables (full definitions for missing; per-column backfill for drifted) ══

create table if not exists public.ai_conversations (
  id uuid default gen_random_uuid() not null,
  user_id uuid,
  feature text not null,
  messages jsonb default '[]'::jsonb not null,
  created_at timestamp with time zone default now() not null,
  updated_at timestamp with time zone default now() not null,
  constraint ai_conversations_pkey PRIMARY KEY (id),
  constraint ai_conversations_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE SET NULL
);

alter table public.ai_conversations add column if not exists id uuid default gen_random_uuid();
alter table public.ai_conversations add column if not exists user_id uuid;
alter table public.ai_conversations add column if not exists feature text;
alter table public.ai_conversations add column if not exists messages jsonb default '[]'::jsonb;
alter table public.ai_conversations add column if not exists created_at timestamp with time zone default now();
alter table public.ai_conversations add column if not exists updated_at timestamp with time zone default now();

create table if not exists public.ai_feedback (
  id bigint generated always as identity not null,
  conversation_id uuid,
  user_id uuid,
  rating smallint,
  comment text,
  created_at timestamp with time zone default now() not null,
  constraint ai_feedback_pkey PRIMARY KEY (id),
  constraint ai_feedback_conversation_id_fkey FOREIGN KEY (conversation_id) REFERENCES ai_conversations(id) ON DELETE CASCADE,
  constraint ai_feedback_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE SET NULL,
  constraint ai_feedback_rating_check CHECK (((rating >= '-1'::integer) AND (rating <= 1)))
);

alter table public.ai_feedback add column if not exists conversation_id uuid;
alter table public.ai_feedback add column if not exists user_id uuid;
alter table public.ai_feedback add column if not exists rating smallint;
alter table public.ai_feedback add column if not exists comment text;
alter table public.ai_feedback add column if not exists created_at timestamp with time zone default now();

create table if not exists public.ai_flags (
  id bigint generated always as identity not null,
  user_id uuid,
  feature text,
  kind text default 'refusal'::text not null,
  prompt text,
  reply text,
  reviewed boolean default false not null,
  created_at timestamp with time zone default now() not null,
  constraint ai_flags_pkey PRIMARY KEY (id),
  constraint ai_flags_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE SET NULL
);

alter table public.ai_flags add column if not exists user_id uuid;
alter table public.ai_flags add column if not exists feature text;
alter table public.ai_flags add column if not exists kind text default 'refusal'::text;
alter table public.ai_flags add column if not exists prompt text;
alter table public.ai_flags add column if not exists reply text;
alter table public.ai_flags add column if not exists reviewed boolean default false;
alter table public.ai_flags add column if not exists created_at timestamp with time zone default now();

create table if not exists public.api_usage (
  id bigint generated always as identity not null,
  user_id uuid,
  endpoint text,
  tokens_in integer,
  tokens_out integer,
  cost_cents integer,
  created_at timestamp with time zone default now() not null,
  constraint api_usage_pkey PRIMARY KEY (id),
  constraint api_usage_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE SET NULL
);

alter table public.api_usage add column if not exists user_id uuid;
alter table public.api_usage add column if not exists endpoint text;
alter table public.api_usage add column if not exists tokens_in integer;
alter table public.api_usage add column if not exists tokens_out integer;
alter table public.api_usage add column if not exists cost_cents integer;
alter table public.api_usage add column if not exists created_at timestamp with time zone default now();

create table if not exists public.attestation_audit (
  id bigint generated always as identity not null,
  user_id uuid not null,
  version text not null,
  statements jsonb not null,
  legal_name text not null,
  ip_address text,
  user_agent text,
  created_at timestamp with time zone default now() not null,
  order_id text,
  context text,
  constraint attestation_audit_pkey PRIMARY KEY (id),
  constraint attestation_audit_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE
);

alter table public.attestation_audit add column if not exists user_id uuid;
alter table public.attestation_audit add column if not exists version text;
alter table public.attestation_audit add column if not exists statements jsonb;
alter table public.attestation_audit add column if not exists legal_name text;
alter table public.attestation_audit add column if not exists ip_address text;
alter table public.attestation_audit add column if not exists user_agent text;
alter table public.attestation_audit add column if not exists created_at timestamp with time zone default now();
alter table public.attestation_audit add column if not exists order_id text;
alter table public.attestation_audit add column if not exists context text;

create table if not exists public.audit_logs (
  id bigint generated always as identity not null,
  actor_id uuid,
  action text not null,
  entity text,
  entity_id text,
  metadata jsonb,
  ip text,
  created_at timestamp with time zone default now() not null,
  constraint audit_logs_pkey PRIMARY KEY (id)
);

alter table public.audit_logs add column if not exists actor_id uuid;
alter table public.audit_logs add column if not exists action text;
alter table public.audit_logs add column if not exists entity text;
alter table public.audit_logs add column if not exists entity_id text;
alter table public.audit_logs add column if not exists metadata jsonb;
alter table public.audit_logs add column if not exists ip text;
alter table public.audit_logs add column if not exists created_at timestamp with time zone default now();

create table if not exists public.products (
  id text not null,
  slug text not null,
  name text not null,
  price numeric(10,2) default 0 not null,
  created_at timestamp with time zone default now() not null,
  subtitle text,
  category_slug text,
  compare_at_price numeric(10,2),
  peptide_sequence text,
  molecular_weight text,
  purity_percent numeric(5,2),
  form text default 'lyophilized_powder'::text,
  storage_temp text default '-20°C'::text,
  cas_number text,
  vial_size_mg numeric(8,2),
  batch_number text,
  research_use_only boolean default true,
  coa_url text,
  stock_status text default 'in_stock'::text,
  short_description text,
  description text,
  image_url text,
  gallery jsonb default '[]'::jsonb,
  specs jsonb default '{}'::jsonb,
  featured boolean default false,
  is_new boolean default false,
  updated_at timestamp with time zone default now(),
  is_bundle boolean default false not null,
  constraint products_slug_key UNIQUE (slug),
  constraint products_pkey PRIMARY KEY (id)
);

alter table public.products add column if not exists id text;
alter table public.products add column if not exists slug text;
alter table public.products add column if not exists name text;
alter table public.products add column if not exists price numeric(10,2) default 0;
alter table public.products add column if not exists created_at timestamp with time zone default now();
alter table public.products add column if not exists subtitle text;
alter table public.products add column if not exists category_slug text;
alter table public.products add column if not exists compare_at_price numeric(10,2);
alter table public.products add column if not exists peptide_sequence text;
alter table public.products add column if not exists molecular_weight text;
alter table public.products add column if not exists purity_percent numeric(5,2);
alter table public.products add column if not exists form text default 'lyophilized_powder'::text;
alter table public.products add column if not exists storage_temp text default '-20°C'::text;
alter table public.products add column if not exists cas_number text;
alter table public.products add column if not exists vial_size_mg numeric(8,2);
alter table public.products add column if not exists batch_number text;
alter table public.products add column if not exists research_use_only boolean default true;
alter table public.products add column if not exists coa_url text;
alter table public.products add column if not exists stock_status text default 'in_stock'::text;
alter table public.products add column if not exists short_description text;
alter table public.products add column if not exists description text;
alter table public.products add column if not exists image_url text;
alter table public.products add column if not exists gallery jsonb default '[]'::jsonb;
alter table public.products add column if not exists specs jsonb default '{}'::jsonb;
alter table public.products add column if not exists featured boolean default false;
alter table public.products add column if not exists is_new boolean default false;
alter table public.products add column if not exists updated_at timestamp with time zone default now();
alter table public.products add column if not exists is_bundle boolean default false;

create table if not exists public.product_variants (
  id text not null,
  product_id text not null,
  sku text,
  vial_size_mg numeric(8,2),
  price numeric(10,2),
  stock_status text default 'in_stock'::text,
  created_at timestamp with time zone default now() not null,
  size_label text,
  sort_order integer default 0,
  constraint product_variants_sku_key UNIQUE (sku),
  constraint product_variants_pkey PRIMARY KEY (id),
  constraint product_variants_product_id_fkey FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE CASCADE
);

alter table public.product_variants add column if not exists id text;
alter table public.product_variants add column if not exists product_id text;
alter table public.product_variants add column if not exists sku text;
alter table public.product_variants add column if not exists vial_size_mg numeric(8,2);
alter table public.product_variants add column if not exists price numeric(10,2);
alter table public.product_variants add column if not exists stock_status text default 'in_stock'::text;
alter table public.product_variants add column if not exists created_at timestamp with time zone default now();
alter table public.product_variants add column if not exists size_label text;
alter table public.product_variants add column if not exists sort_order integer default 0;

create table if not exists public.back_in_stock_subscriptions (
  id bigint generated always as identity not null,
  product_id text,
  variant_id text,
  email text not null,
  user_id uuid,
  notified boolean default false not null,
  created_at timestamp with time zone default now() not null,
  constraint back_in_stock_subscriptions_email_variant_id_key UNIQUE (email, variant_id),
  constraint back_in_stock_subscriptions_pkey PRIMARY KEY (id),
  constraint back_in_stock_subscriptions_product_id_fkey FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE CASCADE,
  constraint back_in_stock_subscriptions_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE SET NULL,
  constraint back_in_stock_subscriptions_variant_id_fkey FOREIGN KEY (variant_id) REFERENCES product_variants(id) ON DELETE SET NULL
);

alter table public.back_in_stock_subscriptions add column if not exists product_id text;
alter table public.back_in_stock_subscriptions add column if not exists variant_id text;
alter table public.back_in_stock_subscriptions add column if not exists email text;
alter table public.back_in_stock_subscriptions add column if not exists user_id uuid;
alter table public.back_in_stock_subscriptions add column if not exists notified boolean default false;
alter table public.back_in_stock_subscriptions add column if not exists created_at timestamp with time zone default now();

create table if not exists public.coas (
  id bigint generated always as identity not null,
  product_id text,
  batch_number text,
  file_url text,
  purity_percent numeric(5,2),
  hplc text,
  mass_spec text,
  endotoxin text,
  tested_at date,
  created_at timestamp with time zone default now() not null,
  lab_name text,
  lot_number text,
  ms_confirmed boolean,
  is_published boolean default true not null,
  constraint coas_pkey PRIMARY KEY (id),
  constraint coas_product_id_fkey FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE CASCADE
);

alter table public.coas add column if not exists product_id text;
alter table public.coas add column if not exists batch_number text;
alter table public.coas add column if not exists file_url text;
alter table public.coas add column if not exists purity_percent numeric(5,2);
alter table public.coas add column if not exists hplc text;
alter table public.coas add column if not exists mass_spec text;
alter table public.coas add column if not exists endotoxin text;
alter table public.coas add column if not exists tested_at date;
alter table public.coas add column if not exists created_at timestamp with time zone default now();
alter table public.coas add column if not exists lab_name text;
alter table public.coas add column if not exists lot_number text;
alter table public.coas add column if not exists ms_confirmed boolean;
alter table public.coas add column if not exists is_published boolean default true;

create table if not exists public.contact_requests (
  id bigint generated always as identity not null,
  user_id uuid,
  type text,
  email text,
  full_name text,
  message text,
  payload jsonb,
  created_at timestamp with time zone default now() not null,
  constraint contact_requests_pkey PRIMARY KEY (id),
  constraint contact_requests_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE SET NULL
);

alter table public.contact_requests add column if not exists user_id uuid;
alter table public.contact_requests add column if not exists type text;
alter table public.contact_requests add column if not exists email text;
alter table public.contact_requests add column if not exists full_name text;
alter table public.contact_requests add column if not exists message text;
alter table public.contact_requests add column if not exists payload jsonb;
alter table public.contact_requests add column if not exists created_at timestamp with time zone default now();

create table if not exists public.discounts (
  id bigint generated always as identity not null,
  code text not null,
  description text,
  kind text not null,
  value numeric(10,2) not null,
  min_subtotal numeric(10,2) default 0 not null,
  max_redemptions integer,
  per_user_limit integer default 1,
  excludes_bundles boolean default true not null,
  is_public boolean default false not null,
  active boolean default true not null,
  starts_at timestamp with time zone,
  ends_at timestamp with time zone,
  created_at timestamp with time zone default now() not null,
  constraint discounts_code_key UNIQUE (code),
  constraint discounts_pkey PRIMARY KEY (id),
  constraint discounts_kind_check CHECK ((kind = ANY (ARRAY['percent'::text, 'fixed'::text]))),
  constraint discounts_value_check CHECK ((value >= (0)::numeric))
);

alter table public.discounts add column if not exists code text;
alter table public.discounts add column if not exists description text;
alter table public.discounts add column if not exists kind text;
alter table public.discounts add column if not exists value numeric(10,2);
alter table public.discounts add column if not exists min_subtotal numeric(10,2) default 0;
alter table public.discounts add column if not exists max_redemptions integer;
alter table public.discounts add column if not exists per_user_limit integer default 1;
alter table public.discounts add column if not exists excludes_bundles boolean default true;
alter table public.discounts add column if not exists is_public boolean default false;
alter table public.discounts add column if not exists active boolean default true;
alter table public.discounts add column if not exists starts_at timestamp with time zone;
alter table public.discounts add column if not exists ends_at timestamp with time zone;
alter table public.discounts add column if not exists created_at timestamp with time zone default now();

create table if not exists public.discount_redemptions (
  id bigint generated always as identity not null,
  discount_id bigint,
  code text,
  user_id uuid,
  order_number text,
  amount numeric(10,2),
  created_at timestamp with time zone default now() not null,
  constraint discount_redemptions_pkey PRIMARY KEY (id),
  constraint discount_redemptions_discount_id_fkey FOREIGN KEY (discount_id) REFERENCES discounts(id) ON DELETE CASCADE,
  constraint discount_redemptions_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE SET NULL
);

alter table public.discount_redemptions add column if not exists discount_id bigint;
alter table public.discount_redemptions add column if not exists code text;
alter table public.discount_redemptions add column if not exists user_id uuid;
alter table public.discount_redemptions add column if not exists order_number text;
alter table public.discount_redemptions add column if not exists amount numeric(10,2);
alter table public.discount_redemptions add column if not exists created_at timestamp with time zone default now();

create table if not exists public.email_subscribers (
  id bigint generated always as identity not null,
  email text not null,
  first_name text,
  source text,
  path text,
  utm jsonb,
  consent jsonb,
  created_at timestamp with time zone default now() not null,
  constraint email_subscribers_email_key UNIQUE (email),
  constraint email_subscribers_pkey PRIMARY KEY (id)
);

alter table public.email_subscribers add column if not exists email text;
alter table public.email_subscribers add column if not exists first_name text;
alter table public.email_subscribers add column if not exists source text;
alter table public.email_subscribers add column if not exists path text;
alter table public.email_subscribers add column if not exists utm jsonb;
alter table public.email_subscribers add column if not exists consent jsonb;
alter table public.email_subscribers add column if not exists created_at timestamp with time zone default now();

create table if not exists public.label_configs (
  id uuid default gen_random_uuid() not null,
  product_id text not null,
  variant_id text,
  template_id text default 'noir-clinical-core'::text not null,
  default_preset text default 'full_wrap'::text not null,
  accent_family text,
  label_version integer default 1 not null,
  status text default 'draft'::text not null,
  revision_notes text,
  approved_at timestamp with time zone,
  approved_by uuid,
  display_name text not null,
  quantity_label text not null,
  material_type text,
  composition jsonb,
  net_contents text,
  fill_note text,
  sku text not null,
  lot_number text,
  batch_number text,
  packaged_date date,
  expiration_date date,
  retest_date date,
  barcode_value text,
  verification_code text,
  storage_short text,
  storage_full text,
  storage_source_verified boolean default false not null,
  manufacturer text,
  distributed_by text,
  country_of_origin text,
  recalled boolean default false not null,
  print_asset_url text,
  flat_preview_url text,
  wrapped_texture_url text,
  static_vial_render_url text,
  created_by uuid,
  created_at timestamp with time zone default now() not null,
  updated_at timestamp with time zone default now() not null,
  constraint label_configs_verification_code_key UNIQUE (verification_code),
  constraint label_configs_pkey PRIMARY KEY (id),
  constraint label_configs_product_id_fkey FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE CASCADE,
  constraint label_configs_variant_id_fkey FOREIGN KEY (variant_id) REFERENCES product_variants(id) ON DELETE SET NULL,
  constraint label_configs_default_preset_check CHECK ((default_preset = ANY (ARRAY['full_wrap'::text, 'partial'::text, 'front'::text, 'neck'::text, 'cap'::text]))),
  constraint label_configs_status_check CHECK ((status = ANY (ARRAY['draft'::text, 'in_review'::text, 'changes_requested'::text, 'approved'::text, 'production_ready'::text, 'archived'::text]))),
  constraint label_configs_template_id_check CHECK ((template_id = ANY (ARRAY['noir-clinical-core'::text, 'spectral-biotech'::text, 'cryogenic-white'::text, 'neural-grid'::text])))
);

alter table public.label_configs add column if not exists id uuid default gen_random_uuid();
alter table public.label_configs add column if not exists product_id text;
alter table public.label_configs add column if not exists variant_id text;
alter table public.label_configs add column if not exists template_id text default 'noir-clinical-core'::text;
alter table public.label_configs add column if not exists default_preset text default 'full_wrap'::text;
alter table public.label_configs add column if not exists accent_family text;
alter table public.label_configs add column if not exists label_version integer default 1;
alter table public.label_configs add column if not exists status text default 'draft'::text;
alter table public.label_configs add column if not exists revision_notes text;
alter table public.label_configs add column if not exists approved_at timestamp with time zone;
alter table public.label_configs add column if not exists approved_by uuid;
alter table public.label_configs add column if not exists display_name text;
alter table public.label_configs add column if not exists quantity_label text;
alter table public.label_configs add column if not exists material_type text;
alter table public.label_configs add column if not exists composition jsonb;
alter table public.label_configs add column if not exists net_contents text;
alter table public.label_configs add column if not exists fill_note text;
alter table public.label_configs add column if not exists sku text;
alter table public.label_configs add column if not exists lot_number text;
alter table public.label_configs add column if not exists batch_number text;
alter table public.label_configs add column if not exists packaged_date date;
alter table public.label_configs add column if not exists expiration_date date;
alter table public.label_configs add column if not exists retest_date date;
alter table public.label_configs add column if not exists barcode_value text;
alter table public.label_configs add column if not exists verification_code text;
alter table public.label_configs add column if not exists storage_short text;
alter table public.label_configs add column if not exists storage_full text;
alter table public.label_configs add column if not exists storage_source_verified boolean default false;
alter table public.label_configs add column if not exists manufacturer text;
alter table public.label_configs add column if not exists distributed_by text;
alter table public.label_configs add column if not exists country_of_origin text;
alter table public.label_configs add column if not exists recalled boolean default false;
alter table public.label_configs add column if not exists print_asset_url text;
alter table public.label_configs add column if not exists flat_preview_url text;
alter table public.label_configs add column if not exists wrapped_texture_url text;
alter table public.label_configs add column if not exists static_vial_render_url text;
alter table public.label_configs add column if not exists created_by uuid;
alter table public.label_configs add column if not exists created_at timestamp with time zone default now();
alter table public.label_configs add column if not exists updated_at timestamp with time zone default now();

create table if not exists public.label_config_history (
  id bigint generated always as identity not null,
  config_id uuid not null,
  action text not null,
  snapshot jsonb not null,
  actor_id uuid,
  created_at timestamp with time zone default now() not null,
  constraint label_config_history_pkey PRIMARY KEY (id),
  constraint label_config_history_config_id_fkey FOREIGN KEY (config_id) REFERENCES label_configs(id) ON DELETE CASCADE
);

alter table public.label_config_history add column if not exists config_id uuid;
alter table public.label_config_history add column if not exists action text;
alter table public.label_config_history add column if not exists snapshot jsonb;
alter table public.label_config_history add column if not exists actor_id uuid;
alter table public.label_config_history add column if not exists created_at timestamp with time zone default now();

create table if not exists public.loyalty_ledger (
  id bigint generated always as identity not null,
  user_id uuid not null,
  delta integer not null,
  reason text,
  order_number text,
  stripe_session_id text,
  created_at timestamp with time zone default now() not null,
  constraint loyalty_ledger_pkey PRIMARY KEY (id),
  constraint loyalty_ledger_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE
);

alter table public.loyalty_ledger add column if not exists user_id uuid;
alter table public.loyalty_ledger add column if not exists delta integer;
alter table public.loyalty_ledger add column if not exists reason text;
alter table public.loyalty_ledger add column if not exists order_number text;
alter table public.loyalty_ledger add column if not exists stripe_session_id text;
alter table public.loyalty_ledger add column if not exists created_at timestamp with time zone default now();

create table if not exists public.orders (
  id uuid default gen_random_uuid() not null,
  order_number text not null,
  stripe_session_id text,
  stripe_payment_intent text,
  user_id uuid,
  email text,
  customer_name text,
  amount_total bigint,
  currency text,
  items jsonb default '[]'::jsonb,
  shipping_address jsonb,
  consent jsonb default '{}'::jsonb,
  status text default 'paid'::text not null,
  created_at timestamp with time zone default now() not null,
  updated_at timestamp with time zone default now() not null,
  payment_provider text default 'stripe'::text,
  provider_ref text,
  constraint orders_order_number_key UNIQUE (order_number),
  constraint orders_stripe_session_id_key UNIQUE (stripe_session_id),
  constraint orders_pkey PRIMARY KEY (id),
  constraint orders_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE SET NULL
);

alter table public.orders add column if not exists id uuid default gen_random_uuid();
alter table public.orders add column if not exists order_number text;
alter table public.orders add column if not exists stripe_session_id text;
alter table public.orders add column if not exists stripe_payment_intent text;
alter table public.orders add column if not exists user_id uuid;
alter table public.orders add column if not exists email text;
alter table public.orders add column if not exists customer_name text;
alter table public.orders add column if not exists amount_total bigint;
alter table public.orders add column if not exists currency text;
alter table public.orders add column if not exists items jsonb default '[]'::jsonb;
alter table public.orders add column if not exists shipping_address jsonb;
alter table public.orders add column if not exists consent jsonb default '{}'::jsonb;
alter table public.orders add column if not exists status text default 'paid'::text;
alter table public.orders add column if not exists created_at timestamp with time zone default now();
alter table public.orders add column if not exists updated_at timestamp with time zone default now();
alter table public.orders add column if not exists payment_provider text default 'stripe'::text;
alter table public.orders add column if not exists provider_ref text;

create table if not exists public.order_items (
  id bigint generated always as identity not null,
  order_id uuid not null,
  product_id text,
  product_name text,
  quantity integer default 1 not null,
  unit_amount bigint,
  amount_total bigint,
  created_at timestamp with time zone default now() not null,
  constraint order_items_pkey PRIMARY KEY (id),
  constraint order_items_order_id_fkey FOREIGN KEY (order_id) REFERENCES orders(id) ON DELETE CASCADE
);

alter table public.order_items add column if not exists order_id uuid;
alter table public.order_items add column if not exists product_id text;
alter table public.order_items add column if not exists product_name text;
alter table public.order_items add column if not exists quantity integer default 1;
alter table public.order_items add column if not exists unit_amount bigint;
alter table public.order_items add column if not exists amount_total bigint;
alter table public.order_items add column if not exists created_at timestamp with time zone default now();

create table if not exists public.partner_applications (
  id uuid default gen_random_uuid() not null,
  user_id uuid,
  email text not null,
  full_name text,
  phone text,
  business_name text,
  website_or_instagram text,
  country text,
  monthly_volume text,
  interested_in text,
  message text,
  status text default 'pending'::text not null,
  reviewed_by uuid,
  reviewed_at timestamp with time zone,
  partner_tier text,
  notes text,
  city text,
  booking_url text,
  specialties jsonb,
  avatar_url text,
  directory_opt_in boolean default false,
  created_at timestamp with time zone default now() not null,
  updated_at timestamp with time zone default now() not null,
  constraint partner_applications_email_key UNIQUE (email),
  constraint partner_applications_pkey PRIMARY KEY (id),
  constraint partner_applications_reviewed_by_fkey FOREIGN KEY (reviewed_by) REFERENCES auth.users(id) ON DELETE SET NULL,
  constraint partner_applications_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE SET NULL
);

alter table public.partner_applications add column if not exists id uuid default gen_random_uuid();
alter table public.partner_applications add column if not exists user_id uuid;
alter table public.partner_applications add column if not exists email text;
alter table public.partner_applications add column if not exists full_name text;
alter table public.partner_applications add column if not exists phone text;
alter table public.partner_applications add column if not exists business_name text;
alter table public.partner_applications add column if not exists website_or_instagram text;
alter table public.partner_applications add column if not exists country text;
alter table public.partner_applications add column if not exists monthly_volume text;
alter table public.partner_applications add column if not exists interested_in text;
alter table public.partner_applications add column if not exists message text;
alter table public.partner_applications add column if not exists status text default 'pending'::text;
alter table public.partner_applications add column if not exists reviewed_by uuid;
alter table public.partner_applications add column if not exists reviewed_at timestamp with time zone;
alter table public.partner_applications add column if not exists partner_tier text;
alter table public.partner_applications add column if not exists notes text;
alter table public.partner_applications add column if not exists city text;
alter table public.partner_applications add column if not exists booking_url text;
alter table public.partner_applications add column if not exists specialties jsonb;
alter table public.partner_applications add column if not exists avatar_url text;
alter table public.partner_applications add column if not exists directory_opt_in boolean default false;
alter table public.partner_applications add column if not exists created_at timestamp with time zone default now();
alter table public.partner_applications add column if not exists updated_at timestamp with time zone default now();

create table if not exists public.price_tiers (
  id bigint generated always as identity not null,
  product_id text not null,
  min_quantity integer not null,
  unit_price numeric(10,2) not null,
  label text,
  created_at timestamp with time zone default now() not null,
  variant_id text,
  savings_pct integer,
  constraint price_tiers_pkey PRIMARY KEY (id),
  constraint price_tiers_product_id_fkey FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE CASCADE,
  constraint price_tiers_variant_id_fkey FOREIGN KEY (variant_id) REFERENCES product_variants(id) ON DELETE CASCADE,
  constraint price_tiers_min_quantity_check CHECK ((min_quantity >= 1)),
  constraint price_tiers_unit_price_check CHECK ((unit_price >= (0)::numeric))
);

alter table public.price_tiers add column if not exists product_id text;
alter table public.price_tiers add column if not exists min_quantity integer;
alter table public.price_tiers add column if not exists unit_price numeric(10,2);
alter table public.price_tiers add column if not exists label text;
alter table public.price_tiers add column if not exists created_at timestamp with time zone default now();
alter table public.price_tiers add column if not exists variant_id text;
alter table public.price_tiers add column if not exists savings_pct integer;

create table if not exists public.product_categories (
  slug text not null,
  name text not null,
  description text,
  sort_order integer default 0,
  constraint product_categories_pkey PRIMARY KEY (slug)
);

alter table public.product_categories add column if not exists slug text;
alter table public.product_categories add column if not exists name text;
alter table public.product_categories add column if not exists description text;
alter table public.product_categories add column if not exists sort_order integer default 0;

create table if not exists public.product_reviews (
  id bigint generated always as identity not null,
  product_id text not null,
  user_id uuid not null,
  rating smallint not null,
  aspect text,
  title text,
  body text,
  verified_purchase boolean default false not null,
  status text default 'published'::text not null,
  created_at timestamp with time zone default now() not null,
  constraint product_reviews_product_id_user_id_key UNIQUE (product_id, user_id),
  constraint product_reviews_pkey PRIMARY KEY (id),
  constraint product_reviews_product_id_fkey FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE CASCADE,
  constraint product_reviews_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE,
  constraint product_reviews_rating_check CHECK (((rating >= 1) AND (rating <= 5)))
);

alter table public.product_reviews add column if not exists product_id text;
alter table public.product_reviews add column if not exists user_id uuid;
alter table public.product_reviews add column if not exists rating smallint;
alter table public.product_reviews add column if not exists aspect text;
alter table public.product_reviews add column if not exists title text;
alter table public.product_reviews add column if not exists body text;
alter table public.product_reviews add column if not exists verified_purchase boolean default false;
alter table public.product_reviews add column if not exists status text default 'published'::text;
alter table public.product_reviews add column if not exists created_at timestamp with time zone default now();

create table if not exists public.profiles (
  id uuid not null,
  email text,
  full_name text,
  role text default 'customer'::text not null,
  created_at timestamp with time zone default now() not null,
  attestation_completed_at timestamp with time zone,
  attestation_version text,
  attestation_statements jsonb,
  attestation_ip text,
  attestation_user_agent text,
  attestation_legal_name text,
  account_tier text default 'customer'::text,
  partner_status text default 'none'::text,
  partner_tier text,
  loyalty_points integer default 0,
  lifetime_spend_cents bigint default 0,
  first_purchase_bonus_awarded boolean default false,
  constraint profiles_pkey PRIMARY KEY (id),
  constraint profiles_id_fkey FOREIGN KEY (id) REFERENCES auth.users(id) ON DELETE CASCADE
);

alter table public.profiles add column if not exists id uuid;
alter table public.profiles add column if not exists email text;
alter table public.profiles add column if not exists full_name text;
alter table public.profiles add column if not exists role text default 'customer'::text;
alter table public.profiles add column if not exists created_at timestamp with time zone default now();
alter table public.profiles add column if not exists attestation_completed_at timestamp with time zone;
alter table public.profiles add column if not exists attestation_version text;
alter table public.profiles add column if not exists attestation_statements jsonb;
alter table public.profiles add column if not exists attestation_ip text;
alter table public.profiles add column if not exists attestation_user_agent text;
alter table public.profiles add column if not exists attestation_legal_name text;
alter table public.profiles add column if not exists account_tier text default 'customer'::text;
alter table public.profiles add column if not exists partner_status text default 'none'::text;
alter table public.profiles add column if not exists partner_tier text;
alter table public.profiles add column if not exists loyalty_points integer default 0;
alter table public.profiles add column if not exists lifetime_spend_cents bigint default 0;
alter table public.profiles add column if not exists first_purchase_bonus_awarded boolean default false;

create table if not exists public.rate_limits (
  key text not null,
  request_count integer default 0 not null,
  window_start timestamp with time zone default now() not null,
  constraint rate_limits_pkey PRIMARY KEY (key)
);

alter table public.rate_limits add column if not exists key text;
alter table public.rate_limits add column if not exists request_count integer default 0;
alter table public.rate_limits add column if not exists window_start timestamp with time zone default now();

create table if not exists public.referral_codes (
  id bigint generated always as identity not null,
  user_id uuid not null,
  code text not null,
  created_at timestamp with time zone default now() not null,
  constraint referral_codes_code_key UNIQUE (code),
  constraint referral_codes_user_id_key UNIQUE (user_id),
  constraint referral_codes_pkey PRIMARY KEY (id),
  constraint referral_codes_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE
);

alter table public.referral_codes add column if not exists user_id uuid;
alter table public.referral_codes add column if not exists code text;
alter table public.referral_codes add column if not exists created_at timestamp with time zone default now();

create table if not exists public.referral_rewards (
  id bigint generated always as identity not null,
  referrer_id uuid not null,
  referred_user_id uuid,
  order_number text,
  reward_points integer default 0 not null,
  status text default 'pending'::text not null,
  created_at timestamp with time zone default now() not null,
  constraint referral_rewards_pkey PRIMARY KEY (id),
  constraint referral_rewards_referred_user_id_fkey FOREIGN KEY (referred_user_id) REFERENCES auth.users(id) ON DELETE SET NULL,
  constraint referral_rewards_referrer_id_fkey FOREIGN KEY (referrer_id) REFERENCES auth.users(id) ON DELETE CASCADE
);

alter table public.referral_rewards add column if not exists referrer_id uuid;
alter table public.referral_rewards add column if not exists referred_user_id uuid;
alter table public.referral_rewards add column if not exists order_number text;
alter table public.referral_rewards add column if not exists reward_points integer default 0;
alter table public.referral_rewards add column if not exists status text default 'pending'::text;
alter table public.referral_rewards add column if not exists created_at timestamp with time zone default now();

create table if not exists public.research_articles (
  id bigint generated always as identity not null,
  slug text not null,
  title text not null,
  summary text,
  body text,
  compound_refs jsonb default '[]'::jsonb,
  published boolean default false not null,
  published_at timestamp with time zone,
  created_at timestamp with time zone default now() not null,
  updated_at timestamp with time zone default now() not null,
  constraint research_articles_slug_key UNIQUE (slug),
  constraint research_articles_pkey PRIMARY KEY (id)
);

alter table public.research_articles add column if not exists slug text;
alter table public.research_articles add column if not exists title text;
alter table public.research_articles add column if not exists summary text;
alter table public.research_articles add column if not exists body text;
alter table public.research_articles add column if not exists compound_refs jsonb default '[]'::jsonb;
alter table public.research_articles add column if not exists published boolean default false;
alter table public.research_articles add column if not exists published_at timestamp with time zone;
alter table public.research_articles add column if not exists created_at timestamp with time zone default now();
alter table public.research_articles add column if not exists updated_at timestamp with time zone default now();

create table if not exists public.shipping_addresses (
  id bigint generated always as identity not null,
  user_id uuid not null,
  name text,
  line1 text,
  line2 text,
  city text,
  state text,
  postal_code text,
  country text default 'US'::text not null,
  is_default boolean default false not null,
  created_at timestamp with time zone default now() not null,
  constraint shipping_addresses_pkey PRIMARY KEY (id),
  constraint shipping_addresses_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE
);

alter table public.shipping_addresses add column if not exists user_id uuid;
alter table public.shipping_addresses add column if not exists name text;
alter table public.shipping_addresses add column if not exists line1 text;
alter table public.shipping_addresses add column if not exists line2 text;
alter table public.shipping_addresses add column if not exists city text;
alter table public.shipping_addresses add column if not exists state text;
alter table public.shipping_addresses add column if not exists postal_code text;
alter table public.shipping_addresses add column if not exists country text default 'US'::text;
alter table public.shipping_addresses add column if not exists is_default boolean default false;
alter table public.shipping_addresses add column if not exists created_at timestamp with time zone default now();

create table if not exists public.support_tickets (
  id bigint generated always as identity not null,
  user_id uuid,
  subject text,
  body text,
  status text default 'open'::text not null,
  created_at timestamp with time zone default now() not null,
  updated_at timestamp with time zone default now() not null,
  constraint support_tickets_pkey PRIMARY KEY (id),
  constraint support_tickets_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE SET NULL
);

alter table public.support_tickets add column if not exists user_id uuid;
alter table public.support_tickets add column if not exists subject text;
alter table public.support_tickets add column if not exists body text;
alter table public.support_tickets add column if not exists status text default 'open'::text;
alter table public.support_tickets add column if not exists created_at timestamp with time zone default now();
alter table public.support_tickets add column if not exists updated_at timestamp with time zone default now();

create table if not exists public.wishlist_items (
  id bigint generated always as identity not null,
  user_id uuid not null,
  product_id text not null,
  created_at timestamp with time zone default now() not null,
  constraint wishlist_items_user_id_product_id_key UNIQUE (user_id, product_id),
  constraint wishlist_items_pkey PRIMARY KEY (id),
  constraint wishlist_items_product_id_fkey FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE CASCADE,
  constraint wishlist_items_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE
);

alter table public.wishlist_items add column if not exists user_id uuid;
alter table public.wishlist_items add column if not exists product_id text;
alter table public.wishlist_items add column if not exists created_at timestamp with time zone default now();


-- ══ 2. Indexes (excluding constraint-backed ones) ══

CREATE INDEX IF NOT EXISTS idx_ai_conversations_user ON public.ai_conversations USING btree (user_id);
CREATE INDEX IF NOT EXISTS idx_ai_feedback_conversation ON public.ai_feedback USING btree (conversation_id);
CREATE INDEX IF NOT EXISTS idx_ai_flags_reviewed ON public.ai_flags USING btree (reviewed, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_ai_flags_user ON public.ai_flags USING btree (user_id);
CREATE INDEX IF NOT EXISTS idx_api_usage_created ON public.api_usage USING btree (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_attestation_audit_order ON public.attestation_audit USING btree (order_id);
CREATE INDEX IF NOT EXISTS idx_attestation_audit_user ON public.attestation_audit USING btree (user_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_created ON public.audit_logs USING btree (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_bis_variant ON public.back_in_stock_subscriptions USING btree (variant_id) WHERE (notified = false);
CREATE INDEX IF NOT EXISTS idx_coas_batch ON public.coas USING btree (batch_number);
CREATE INDEX IF NOT EXISTS idx_coas_lot ON public.coas USING btree (lot_number);
CREATE INDEX IF NOT EXISTS idx_coas_lot_lower ON public.coas USING btree (lower(lot_number));
CREATE INDEX IF NOT EXISTS idx_coas_product ON public.coas USING btree (product_id);
CREATE INDEX IF NOT EXISTS idx_contact_requests_created ON public.contact_requests USING btree (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_disc_redemptions_disc ON public.discount_redemptions USING btree (discount_id);
CREATE INDEX IF NOT EXISTS idx_disc_redemptions_user ON public.discount_redemptions USING btree (user_id);
CREATE INDEX IF NOT EXISTS idx_label_history_config ON public.label_config_history USING btree (config_id, created_at DESC);
CREATE UNIQUE INDEX IF NOT EXISTS idx_label_configs_code_upper ON public.label_configs USING btree (upper(verification_code));
CREATE INDEX IF NOT EXISTS idx_label_configs_product ON public.label_configs USING btree (product_id, variant_id);
CREATE INDEX IF NOT EXISTS idx_label_configs_status ON public.label_configs USING btree (status);
CREATE INDEX IF NOT EXISTS idx_loyalty_ledger_user ON public.loyalty_ledger USING btree (user_id);
CREATE INDEX IF NOT EXISTS idx_order_items_order ON public.order_items USING btree (order_id);
CREATE INDEX IF NOT EXISTS idx_orders_email ON public.orders USING btree (email);
CREATE INDEX IF NOT EXISTS idx_orders_session ON public.orders USING btree (stripe_session_id);
CREATE INDEX IF NOT EXISTS idx_orders_user ON public.orders USING btree (user_id);
CREATE UNIQUE INDEX IF NOT EXISTS orders_provider_ref_key ON public.orders USING btree (provider_ref) WHERE (provider_ref IS NOT NULL);
CREATE INDEX IF NOT EXISTS idx_partner_apps_status ON public.partner_applications USING btree (status);
CREATE INDEX IF NOT EXISTS idx_partner_apps_user ON public.partner_applications USING btree (user_id);
CREATE INDEX IF NOT EXISTS idx_price_tiers_product ON public.price_tiers USING btree (product_id);
CREATE INDEX IF NOT EXISTS idx_price_tiers_variant ON public.price_tiers USING btree (variant_id);
CREATE UNIQUE INDEX IF NOT EXISTS price_tiers_variant_qty_key ON public.price_tiers USING btree (variant_id, min_quantity);
CREATE INDEX IF NOT EXISTS idx_reviews_product ON public.product_reviews USING btree (product_id, status);
CREATE INDEX IF NOT EXISTS idx_variants_product ON public.product_variants USING btree (product_id);
CREATE INDEX IF NOT EXISTS idx_variants_sort ON public.product_variants USING btree (product_id, sort_order);
CREATE INDEX IF NOT EXISTS idx_products_category_slug ON public.products USING btree (category_slug);
CREATE INDEX IF NOT EXISTS idx_products_slug ON public.products USING btree (slug);
CREATE INDEX IF NOT EXISTS idx_products_stock_status ON public.products USING btree (stock_status);
CREATE INDEX IF NOT EXISTS idx_rate_limits_window ON public.rate_limits USING btree (window_start);
CREATE INDEX IF NOT EXISTS idx_referral_rewards_referrer ON public.referral_rewards USING btree (referrer_id);
CREATE INDEX IF NOT EXISTS idx_research_articles_published ON public.research_articles USING btree (published);
CREATE INDEX IF NOT EXISTS idx_ship_addr_user ON public.shipping_addresses USING btree (user_id);
CREATE INDEX IF NOT EXISTS idx_support_tickets_user ON public.support_tickets USING btree (user_id);
CREATE INDEX IF NOT EXISTS idx_wishlist_user ON public.wishlist_items USING btree (user_id);

-- ══ 3. Functions ══

CREATE OR REPLACE FUNCTION public.handle_new_user()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
begin
  insert into public.profiles (id, email, full_name)
  values (new.id, new.email, coalesce(new.raw_user_meta_data->>'full_name', ''))
  on conflict (id) do nothing;
  return new;
end;
$function$;

CREATE OR REPLACE FUNCTION public.is_admin()
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  select exists (
    select 1 from public.profiles p
    where p.id = auth.uid() and p.role = 'admin'
  );
$function$;

CREATE OR REPLACE FUNCTION public.is_attested()
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  select exists (
    select 1 from public.profiles p
    where p.id = auth.uid()
      and p.attestation_completed_at is not null
  );
$function$;

-- ══ 4. Trigger: auto-create profile on signup (auth.users) ══

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ══ 5. Row-level security ══

alter table public.ai_conversations enable row level security;
alter table public.ai_feedback enable row level security;
alter table public.ai_flags enable row level security;
alter table public.api_usage enable row level security;
alter table public.attestation_audit enable row level security;
alter table public.audit_logs enable row level security;
alter table public.back_in_stock_subscriptions enable row level security;
alter table public.coas enable row level security;
alter table public.contact_requests enable row level security;
alter table public.discount_redemptions enable row level security;
alter table public.discounts enable row level security;
alter table public.email_subscribers enable row level security;
alter table public.label_config_history enable row level security;
alter table public.label_configs enable row level security;
alter table public.loyalty_ledger enable row level security;
alter table public.order_items enable row level security;
alter table public.orders enable row level security;
alter table public.partner_applications enable row level security;
alter table public.price_tiers enable row level security;
alter table public.product_categories enable row level security;
alter table public.product_reviews enable row level security;
alter table public.product_variants enable row level security;
alter table public.products enable row level security;
alter table public.profiles enable row level security;
alter table public.rate_limits enable row level security;
alter table public.referral_codes enable row level security;
alter table public.referral_rewards enable row level security;
alter table public.research_articles enable row level security;
alter table public.shipping_addresses enable row level security;
alter table public.support_tickets enable row level security;
alter table public.wishlist_items enable row level security;

-- ══ 6. Policies ══

do $$ begin
  if not exists (select 1 from pg_policies where schemaname='public' and tablename='ai_conversations' and policyname='ai_conv_insert_own') then
    create policy "ai_conv_insert_own" on public.ai_conversations
      for insert
      with check ((user_id = auth.uid()));
  end if;
end $$;
do $$ begin
  if not exists (select 1 from pg_policies where schemaname='public' and tablename='ai_conversations' and policyname='ai_conv_select_own') then
    create policy "ai_conv_select_own" on public.ai_conversations
      for select
      using (((user_id = auth.uid()) OR is_admin()));
  end if;
end $$;
do $$ begin
  if not exists (select 1 from pg_policies where schemaname='public' and tablename='ai_conversations' and policyname='ai_conv_update_own') then
    create policy "ai_conv_update_own" on public.ai_conversations
      for update
      using ((user_id = auth.uid()))
      with check ((user_id = auth.uid()));
  end if;
end $$;
do $$ begin
  if not exists (select 1 from pg_policies where schemaname='public' and tablename='ai_feedback' and policyname='ai_feedback_insert_own') then
    create policy "ai_feedback_insert_own" on public.ai_feedback
      for insert
      with check ((user_id = auth.uid()));
  end if;
end $$;
do $$ begin
  if not exists (select 1 from pg_policies where schemaname='public' and tablename='ai_feedback' and policyname='ai_feedback_select_own') then
    create policy "ai_feedback_select_own" on public.ai_feedback
      for select
      using (((user_id = auth.uid()) OR is_admin()));
  end if;
end $$;
do $$ begin
  if not exists (select 1 from pg_policies where schemaname='public' and tablename='ai_flags' and policyname='ai_flags_admin_read') then
    create policy "ai_flags_admin_read" on public.ai_flags
      for select
      using (is_admin());
  end if;
end $$;
do $$ begin
  if not exists (select 1 from pg_policies where schemaname='public' and tablename='ai_flags' and policyname='ai_flags_admin_update') then
    create policy "ai_flags_admin_update" on public.ai_flags
      for update
      using (is_admin())
      with check (is_admin());
  end if;
end $$;
do $$ begin
  if not exists (select 1 from pg_policies where schemaname='public' and tablename='api_usage' and policyname='api_usage_admin_read') then
    create policy "api_usage_admin_read" on public.api_usage
      for select
      using (is_admin());
  end if;
end $$;
do $$ begin
  if not exists (select 1 from pg_policies where schemaname='public' and tablename='attestation_audit' and policyname='audit_insert_own') then
    create policy "audit_insert_own" on public.attestation_audit
      for insert
      with check ((user_id = auth.uid()));
  end if;
end $$;
do $$ begin
  if not exists (select 1 from pg_policies where schemaname='public' and tablename='attestation_audit' and policyname='audit_select_own') then
    create policy "audit_select_own" on public.attestation_audit
      for select
      using (((user_id = auth.uid()) OR is_admin()));
  end if;
end $$;
do $$ begin
  if not exists (select 1 from pg_policies where schemaname='public' and tablename='audit_logs' and policyname='audit_logs_admin_read') then
    create policy "audit_logs_admin_read" on public.audit_logs
      for select
      using (is_admin());
  end if;
end $$;
do $$ begin
  if not exists (select 1 from pg_policies where schemaname='public' and tablename='back_in_stock_subscriptions' and policyname='bis_select_own') then
    create policy "bis_select_own" on public.back_in_stock_subscriptions
      for select
      using (((user_id = auth.uid()) OR is_admin()));
  end if;
end $$;
do $$ begin
  if not exists (select 1 from pg_policies where schemaname='public' and tablename='coas' and policyname='coas_admin_write') then
    create policy "coas_admin_write" on public.coas
      for all
      using (is_admin())
      with check (is_admin());
  end if;
end $$;
do $$ begin
  if not exists (select 1 from pg_policies where schemaname='public' and tablename='coas' and policyname='coas_attested_read') then
    create policy "coas_attested_read" on public.coas
      for select
      using ((is_attested() OR is_admin()));
  end if;
end $$;
do $$ begin
  if not exists (select 1 from pg_policies where schemaname='public' and tablename='coas' and policyname='coas_public_read') then
    create policy "coas_public_read" on public.coas
      for select
      using ((is_published IS NOT FALSE));
  end if;
end $$;
do $$ begin
  if not exists (select 1 from pg_policies where schemaname='public' and tablename='contact_requests' and policyname='contact_admin_read') then
    create policy "contact_admin_read" on public.contact_requests
      for select
      using (is_admin());
  end if;
end $$;
do $$ begin
  if not exists (select 1 from pg_policies where schemaname='public' and tablename='discount_redemptions' and policyname='disc_redemptions_select_own') then
    create policy "disc_redemptions_select_own" on public.discount_redemptions
      for select
      using (((user_id = auth.uid()) OR is_admin()));
  end if;
end $$;
do $$ begin
  if not exists (select 1 from pg_policies where schemaname='public' and tablename='discounts' and policyname='discounts_public_read') then
    create policy "discounts_public_read" on public.discounts
      for select
      using (((is_public = true) AND (active = true)));
  end if;
end $$;
do $$ begin
  if not exists (select 1 from pg_policies where schemaname='public' and tablename='email_subscribers' and policyname='email_subscribers_admin_read') then
    create policy "email_subscribers_admin_read" on public.email_subscribers
      for select
      using (is_admin());
  end if;
end $$;
do $$ begin
  if not exists (select 1 from pg_policies where schemaname='public' and tablename='label_config_history' and policyname='label_history_admin_read') then
    create policy "label_history_admin_read" on public.label_config_history
      for select
      using (is_admin());
  end if;
end $$;
do $$ begin
  if not exists (select 1 from pg_policies where schemaname='public' and tablename='label_configs' and policyname='label_configs_admin_all') then
    create policy "label_configs_admin_all" on public.label_configs
      for all
      using (is_admin())
      with check (is_admin());
  end if;
end $$;
do $$ begin
  if not exists (select 1 from pg_policies where schemaname='public' and tablename='loyalty_ledger' and policyname='loyalty_select_own') then
    create policy "loyalty_select_own" on public.loyalty_ledger
      for select
      using (((user_id = auth.uid()) OR is_admin()));
  end if;
end $$;
do $$ begin
  if not exists (select 1 from pg_policies where schemaname='public' and tablename='order_items' and policyname='order_items_select_via_order') then
    create policy "order_items_select_via_order" on public.order_items
      for select
      using ((EXISTS ( SELECT 1
   FROM orders o
  WHERE ((o.id = order_items.order_id) AND ((o.user_id = auth.uid()) OR is_admin())))));
  end if;
end $$;
do $$ begin
  if not exists (select 1 from pg_policies where schemaname='public' and tablename='orders' and policyname='orders_select_own') then
    create policy "orders_select_own" on public.orders
      for select
      using (((user_id = auth.uid()) OR is_admin()));
  end if;
end $$;
do $$ begin
  if not exists (select 1 from pg_policies where schemaname='public' and tablename='partner_applications' and policyname='partner_apps_select_own') then
    create policy "partner_apps_select_own" on public.partner_applications
      for select
      using (((user_id = auth.uid()) OR is_admin()));
  end if;
end $$;
do $$ begin
  if not exists (select 1 from pg_policies where schemaname='public' and tablename='price_tiers' and policyname='tiers_admin_write') then
    create policy "tiers_admin_write" on public.price_tiers
      for all
      using (is_admin())
      with check (is_admin());
  end if;
end $$;
do $$ begin
  if not exists (select 1 from pg_policies where schemaname='public' and tablename='price_tiers' and policyname='tiers_attested_read') then
    create policy "tiers_attested_read" on public.price_tiers
      for select
      using ((is_attested() OR is_admin()));
  end if;
end $$;
do $$ begin
  if not exists (select 1 from pg_policies where schemaname='public' and tablename='price_tiers' and policyname='tiers_public_read') then
    create policy "tiers_public_read" on public.price_tiers
      for select
      using (true);
  end if;
end $$;
do $$ begin
  if not exists (select 1 from pg_policies where schemaname='public' and tablename='product_categories' and policyname='categories_attested_read') then
    create policy "categories_attested_read" on public.product_categories
      for select
      using ((is_attested() OR is_admin()));
  end if;
end $$;
do $$ begin
  if not exists (select 1 from pg_policies where schemaname='public' and tablename='product_categories' and policyname='categories_public_read') then
    create policy "categories_public_read" on public.product_categories
      for select
      using (true);
  end if;
end $$;
do $$ begin
  if not exists (select 1 from pg_policies where schemaname='public' and tablename='product_reviews' and policyname='reviews_read') then
    create policy "reviews_read" on public.product_reviews
      for select
      using ((((status = 'published'::text) AND is_attested()) OR (user_id = auth.uid()) OR is_admin()));
  end if;
end $$;
do $$ begin
  if not exists (select 1 from pg_policies where schemaname='public' and tablename='product_variants' and policyname='variants_admin_write') then
    create policy "variants_admin_write" on public.product_variants
      for all
      using (is_admin())
      with check (is_admin());
  end if;
end $$;
do $$ begin
  if not exists (select 1 from pg_policies where schemaname='public' and tablename='product_variants' and policyname='variants_attested_read') then
    create policy "variants_attested_read" on public.product_variants
      for select
      using ((is_attested() OR is_admin()));
  end if;
end $$;
do $$ begin
  if not exists (select 1 from pg_policies where schemaname='public' and tablename='product_variants' and policyname='variants_public_read') then
    create policy "variants_public_read" on public.product_variants
      for select
      using (true);
  end if;
end $$;
do $$ begin
  if not exists (select 1 from pg_policies where schemaname='public' and tablename='products' and policyname='products_admin_write') then
    create policy "products_admin_write" on public.products
      for all
      using (is_admin())
      with check (is_admin());
  end if;
end $$;
do $$ begin
  if not exists (select 1 from pg_policies where schemaname='public' and tablename='products' and policyname='products_attested_read') then
    create policy "products_attested_read" on public.products
      for select
      using ((is_attested() OR is_admin()));
  end if;
end $$;
do $$ begin
  if not exists (select 1 from pg_policies where schemaname='public' and tablename='products' and policyname='products_public_read') then
    create policy "products_public_read" on public.products
      for select
      using (true);
  end if;
end $$;
do $$ begin
  if not exists (select 1 from pg_policies where schemaname='public' and tablename='profiles' and policyname='profiles_insert_own') then
    create policy "profiles_insert_own" on public.profiles
      for insert
      with check ((id = auth.uid()));
  end if;
end $$;
do $$ begin
  if not exists (select 1 from pg_policies where schemaname='public' and tablename='profiles' and policyname='profiles_select_own') then
    create policy "profiles_select_own" on public.profiles
      for select
      using (((id = auth.uid()) OR is_admin()));
  end if;
end $$;
do $$ begin
  if not exists (select 1 from pg_policies where schemaname='public' and tablename='profiles' and policyname='profiles_update_own') then
    create policy "profiles_update_own" on public.profiles
      for update
      using ((id = auth.uid()))
      with check ((id = auth.uid()));
  end if;
end $$;
do $$ begin
  if not exists (select 1 from pg_policies where schemaname='public' and tablename='referral_codes' and policyname='referral_codes_select_own') then
    create policy "referral_codes_select_own" on public.referral_codes
      for select
      using (((user_id = auth.uid()) OR is_admin()));
  end if;
end $$;
do $$ begin
  if not exists (select 1 from pg_policies where schemaname='public' and tablename='referral_rewards' and policyname='referral_rewards_select_own') then
    create policy "referral_rewards_select_own" on public.referral_rewards
      for select
      using (((referrer_id = auth.uid()) OR is_admin()));
  end if;
end $$;
do $$ begin
  if not exists (select 1 from pg_policies where schemaname='public' and tablename='research_articles' and policyname='research_articles_admin_write') then
    create policy "research_articles_admin_write" on public.research_articles
      for all
      using (is_admin())
      with check (is_admin());
  end if;
end $$;
do $$ begin
  if not exists (select 1 from pg_policies where schemaname='public' and tablename='research_articles' and policyname='research_articles_public_read') then
    create policy "research_articles_public_read" on public.research_articles
      for select
      using (((published = true) OR is_admin()));
  end if;
end $$;
do $$ begin
  if not exists (select 1 from pg_policies where schemaname='public' and tablename='shipping_addresses' and policyname='ship_addr_delete_own') then
    create policy "ship_addr_delete_own" on public.shipping_addresses
      for delete
      using ((user_id = auth.uid()));
  end if;
end $$;
do $$ begin
  if not exists (select 1 from pg_policies where schemaname='public' and tablename='shipping_addresses' and policyname='ship_addr_insert_own') then
    create policy "ship_addr_insert_own" on public.shipping_addresses
      for insert
      with check ((user_id = auth.uid()));
  end if;
end $$;
do $$ begin
  if not exists (select 1 from pg_policies where schemaname='public' and tablename='shipping_addresses' and policyname='ship_addr_select_own') then
    create policy "ship_addr_select_own" on public.shipping_addresses
      for select
      using (((user_id = auth.uid()) OR is_admin()));
  end if;
end $$;
do $$ begin
  if not exists (select 1 from pg_policies where schemaname='public' and tablename='shipping_addresses' and policyname='ship_addr_update_own') then
    create policy "ship_addr_update_own" on public.shipping_addresses
      for update
      using ((user_id = auth.uid()))
      with check ((user_id = auth.uid()));
  end if;
end $$;
do $$ begin
  if not exists (select 1 from pg_policies where schemaname='public' and tablename='support_tickets' and policyname='support_insert_own') then
    create policy "support_insert_own" on public.support_tickets
      for insert
      with check ((user_id = auth.uid()));
  end if;
end $$;
do $$ begin
  if not exists (select 1 from pg_policies where schemaname='public' and tablename='support_tickets' and policyname='support_select_own') then
    create policy "support_select_own" on public.support_tickets
      for select
      using (((user_id = auth.uid()) OR is_admin()));
  end if;
end $$;
do $$ begin
  if not exists (select 1 from pg_policies where schemaname='public' and tablename='wishlist_items' and policyname='wishlist_delete_own') then
    create policy "wishlist_delete_own" on public.wishlist_items
      for delete
      using ((user_id = auth.uid()));
  end if;
end $$;
do $$ begin
  if not exists (select 1 from pg_policies where schemaname='public' and tablename='wishlist_items' and policyname='wishlist_insert_own') then
    create policy "wishlist_insert_own" on public.wishlist_items
      for insert
      with check ((user_id = auth.uid()));
  end if;
end $$;
do $$ begin
  if not exists (select 1 from pg_policies where schemaname='public' and tablename='wishlist_items' and policyname='wishlist_select_own') then
    create policy "wishlist_select_own" on public.wishlist_items
      for select
      using ((user_id = auth.uid()));
  end if;
end $$;

-- ══ 7. pgvector objects (verbatim from 0008 — native on Supabase) ══

create extension if not exists vector;
-- ── 4. embeddings (semantic search store) ────────────────────────────────
create table if not exists public.embeddings (
  id           bigint generated always as identity primary key,
  content_type text not null,          -- compound | article | coa | faq
  ref_id       text not null,          -- source row id / slug
  content      text not null,          -- the chunk that was embedded
  embedding    vector(1024),
  metadata     jsonb default '{}'::jsonb,
  created_at   timestamptz not null default now(),
  unique (content_type, ref_id)
);
-- Approximate-nearest-neighbour index for cosine distance.
create index if not exists idx_embeddings_vector
  on public.embeddings using ivfflat (embedding vector_cosine_ops) with (lists = 100);
create index if not exists idx_embeddings_type on public.embeddings (content_type);

-- Cosine-similarity match function used by api/ai/semantic-search.js. Called
-- via the service role (bypasses RLS); returns the closest chunks.
create or replace function public.match_embeddings(
  query_embedding vector(1024),
  match_count int default 8
)
returns table (content_type text, ref_id text, content text, similarity float)
language sql
stable
as $$
  select e.content_type, e.ref_id, e.content,
         1 - (e.embedding <=> query_embedding) as similarity
  from public.embeddings e
  where e.embedding is not null
  order by e.embedding <=> query_embedding
  limit match_count;
$$;
alter table public.embeddings enable row level security;
