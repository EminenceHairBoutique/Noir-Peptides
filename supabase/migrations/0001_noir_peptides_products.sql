-- ════════════════════════════════════════════════════════════════════════
-- Noir Peptides — Research peptide catalog schema (ADDITIVE / NON-DESTRUCTIVE)
--
-- This migration is additive only. It does NOT drop any existing columns.
-- If legacy product columns exist (e.g. from a prior catalog), they are left
-- in place and nullable; mark them deprecated rather than dropping unless a
-- fully destructive migration is explicitly approved by the data owner.
--
-- Frontend currently sources the catalog from src/data/products.js. This
-- schema provides a database-compatible structure for a future Supabase-backed
-- catalog. Run in the Supabase SQL editor or via the Supabase CLI.
-- ════════════════════════════════════════════════════════════════════════

-- ── 1. Ensure products table exists (create if not present) ──────────────
create table if not exists public.products (
  id          text primary key,
  slug        text unique not null,
  name        text not null,
  price       numeric(10,2) not null default 0,
  created_at  timestamptz not null default now()
);

-- ── 2. Add peptide-specific columns (additive, IF NOT EXISTS) ────────────
alter table public.products add column if not exists subtitle          text;
alter table public.products add column if not exists category_slug     text;
alter table public.products add column if not exists compare_at_price  numeric(10,2);
alter table public.products add column if not exists peptide_sequence  text;
alter table public.products add column if not exists molecular_weight  text;
alter table public.products add column if not exists purity_percent    numeric(5,2);
alter table public.products add column if not exists form              text default 'lyophilized_powder';
alter table public.products add column if not exists storage_temp      text default '-20°C';
alter table public.products add column if not exists cas_number        text;
alter table public.products add column if not exists vial_size_mg      numeric(8,2);
alter table public.products add column if not exists batch_number      text;
alter table public.products add column if not exists research_use_only boolean default true;
alter table public.products add column if not exists coa_url           text;
alter table public.products add column if not exists stock_status      text default 'in_stock';
alter table public.products add column if not exists short_description text;
alter table public.products add column if not exists description       text;
alter table public.products add column if not exists image_url         text;
alter table public.products add column if not exists gallery           jsonb default '[]'::jsonb;
alter table public.products add column if not exists specs             jsonb default '{}'::jsonb;
alter table public.products add column if not exists featured          boolean default false;
alter table public.products add column if not exists is_new            boolean default false;
alter table public.products add column if not exists updated_at        timestamptz default now();

comment on column public.products.research_use_only is
  'Always TRUE. Materials are for in vitro laboratory research only — not for human or veterinary use.';
comment on column public.products.coa_url is
  'Batch-specific Certificate of Analysis URL. NULL means available to qualified researchers on request.';

-- ── 3. Research categories ───────────────────────────────────────────────
create table if not exists public.product_categories (
  slug        text primary key,
  name        text not null,
  description text,
  sort_order  int default 0
);

insert into public.product_categories (slug, name, description, sort_order) values
  ('tissue-research',        'Tissue Research',        'Peptide reference materials used in controlled laboratory research related to tissue-model pathways.', 1),
  ('gh-axis-research',       'GH-Axis Research',       'Research materials studied in relation to growth-hormone-axis signaling models.', 2),
  ('neuro-research',         'Neurochemical Research', 'Peptide materials used in laboratory models related to neurochemical signaling.', 3),
  ('metabolic-research',     'Metabolic Research',     'Research compounds studied in controlled models of metabolic signaling.', 4),
  ('cellular-aging-research','Cellular Aging Research','Materials used in laboratory models involving cellular maintenance and aging-related pathways.', 5),
  ('reference-materials',    'Reference Materials',    'Batch-documented peptide materials for qualified research use.', 6)
on conflict (slug) do update set
  name        = excluded.name,
  description = excluded.description,
  sort_order  = excluded.sort_order;

-- ── 4. Seed safe placeholder research materials (research-only copy) ──────
insert into public.products
  (id, slug, name, subtitle, category_slug, price, vial_size_mg, purity_percent,
   peptide_sequence, molecular_weight, form, storage_temp, cas_number,
   batch_number, research_use_only, stock_status, short_description, description,
   featured, is_new)
values
  ('np-bpc157-5mg','bpc-157-5mg','BPC-157 5mg','Tissue-model research peptide','tissue-research',49,5,99.0,
   'GEPPPGKPADDAGLV','1419.53 g/mol','lyophilized_powder','-20°C','137525-51-0','NP-B157-0260',true,'in_stock',
   'Lyophilized pentadecapeptide reference material for in vitro tissue-model research.',
   'BPC-157 5mg is a lyophilized peptide reference material supplied for in vitro laboratory research. Each batch is third-party tested and accompanied by available analytical documentation.',
   true,true),
  ('np-tb500-5mg','tb-500-5mg','TB-500 5mg','Thymosin β4 fragment — tissue-model research','tissue-research',54,5,98.5,
   'Ac-SDKPDMAEIEKFDKSKLKKTETQ (Tβ4 1–24)','4963.49 g/mol (Tβ4)','lyophilized_powder','-20°C','77591-33-4','NP-TB5-0260',true,'in_stock',
   'Lyophilized Thymosin β4-derived reference material for in vitro tissue-pathway research.',
   'TB-500 5mg is a lyophilized peptide reference material supplied for in vitro laboratory research relating to tissue-model pathways. Each batch is third-party tested and accompanied by available analytical documentation.',
   true,true),
  ('np-cjc1295-2mg','cjc-1295-2mg','CJC-1295 2mg','GH-axis signaling research peptide','gh-axis-research',39,2,98.0,
   'Tyr-D-Ala-Asp-Ala-Ile-Phe-Thr-Gln-Ser-Tyr-Arg-Lys-Val-Leu-Ala-Gln-Leu-Ser-Ala-Arg-Lys-Leu-Leu-Gln-Asp-Ile-Leu-Ser-Arg-NH2',
   '3367.97 g/mol','lyophilized_powder','-20°C','863288-34-0','NP-CJC-0260',true,'in_stock',
   'Lyophilized GHRH-analog reference material for in vitro GH-axis signaling research.',
   'CJC-1295 2mg is a lyophilized peptide reference material supplied for in vitro laboratory research studied in relation to growth-hormone-axis signaling models. Each batch is third-party tested and accompanied by available analytical documentation.',
   true,true),
  ('np-ipamorelin-5mg','ipamorelin-5mg','Ipamorelin 5mg','GH-axis signaling research peptide','gh-axis-research',44,5,99.0,
   'Aib-His-D-2-Nal-D-Phe-Lys-NH2','711.85 g/mol','lyophilized_powder','-20°C','170851-70-4','NP-IPA-0260',true,'in_stock',
   'Lyophilized pentapeptide reference material for in vitro GH-axis signaling research.',
   'Ipamorelin 5mg is a lyophilized peptide reference material supplied for in vitro laboratory research studied in relation to growth-hormone-axis signaling models. Each batch is third-party tested and accompanied by available analytical documentation.',
   false,false),
  ('np-semax-5mg','semax-5mg','Semax 5mg','Neurochemical signaling research peptide','neuro-research',47,5,99.0,
   'MEHFPGP','813.92 g/mol','lyophilized_powder','-20°C','80714-61-0','NP-SMX-0260',true,'in_stock',
   'Lyophilized heptapeptide reference material for in vitro neurochemical-signaling research.',
   'Semax 5mg is a lyophilized peptide reference material supplied for in vitro laboratory research used in models related to neurochemical signaling. Each batch is third-party tested and accompanied by available analytical documentation.',
   false,true),
  ('np-selank-5mg','selank-5mg','Selank 5mg','Neurochemical signaling research peptide','neuro-research',47,5,98.5,
   'TKPRPGP','751.91 g/mol','lyophilized_powder','-20°C','129954-34-3','NP-SEL-0260',true,'low_stock',
   'Lyophilized heptapeptide reference material for in vitro neurochemical-signaling research.',
   'Selank 5mg is a lyophilized peptide reference material supplied for in vitro laboratory research used in models related to neurochemical signaling. Each batch is third-party tested and accompanied by available analytical documentation.',
   false,false),
  ('np-nad-500mg','nad-500mg','NAD+ 500mg','Coenzyme — metabolic signaling research','metabolic-research',64,500,99.0,
   'N/A (dinucleotide coenzyme)','663.43 g/mol','lyophilized_powder','-20°C','53-84-9','NP-NAD-0260',true,'in_stock',
   'Lyophilized coenzyme reference material for in vitro metabolic-signaling research.',
   'NAD+ 500mg is a lyophilized coenzyme reference material supplied for in vitro laboratory research studied in controlled models of metabolic signaling. Each batch is third-party tested and accompanied by available analytical documentation.',
   true,false),
  ('np-motsc-10mg','mots-c-10mg','MOTS-c 10mg','Mitochondrial-derived peptide — metabolic research','metabolic-research',58,10,98.5,
   'MRWQEMGYIFYPRKLR','2174.62 g/mol','lyophilized_powder','-20°C','1627580-64-6','NP-MTS-0260',true,'in_stock',
   'Lyophilized mitochondrial-derived peptide reference material for in vitro metabolic research.',
   'MOTS-c 10mg is a lyophilized peptide reference material supplied for in vitro laboratory research studied in controlled models of metabolic signaling. Each batch is third-party tested and accompanied by available analytical documentation.',
   false,true),
  ('np-ghkcu-50mg','ghk-cu-50mg','GHK-Cu 50mg','Copper tripeptide — cellular-maintenance research','cellular-aging-research',42,50,99.0,
   'GHK · Cu(II)','403.93 g/mol','lyophilized_powder','-20°C','89030-95-5','NP-GHK-0260',true,'in_stock',
   'Lyophilized copper-tripeptide reference material for in vitro cellular-maintenance research.',
   'GHK-Cu 50mg is a lyophilized copper-peptide reference material supplied for in vitro laboratory research involving cellular maintenance and aging-related pathways. Each batch is third-party tested and accompanied by available analytical documentation.',
   true,false),
  ('np-epithalon-10mg','epithalon-10mg','Epithalon 10mg','Tetrapeptide — cellular aging research','cellular-aging-research',46,10,99.0,
   'AEDG','390.35 g/mol','lyophilized_powder','-20°C','307297-39-8','NP-EPI-0260',true,'in_stock',
   'Lyophilized tetrapeptide reference material for in vitro cellular-aging research.',
   'Epithalon 10mg is a lyophilized tetrapeptide reference material supplied for in vitro laboratory research involving cellular maintenance and aging-related pathways. Each batch is third-party tested and accompanied by available analytical documentation.',
   false,false),
  ('np-thymosin-a1-5mg','thymosin-alpha-1-5mg','Thymosin Alpha-1 5mg','Batch-documented reference peptide','reference-materials',56,5,98.0,
   'Ac-SDAAVDTSSEITTKDLKEKKEVVEEAEN','3108.30 g/mol','lyophilized_powder','-20°C','62304-98-7','NP-TA1-0260',true,'in_stock',
   'Lyophilized 28-residue peptide supplied as a batch-documented reference material.',
   'Thymosin Alpha-1 5mg is a lyophilized peptide supplied as a batch-documented reference material for qualified in vitro laboratory research. Each batch is third-party tested and accompanied by available analytical documentation.',
   false,false),
  ('np-glutathione-600mg','glutathione-600mg','Glutathione 600mg','Tripeptide — batch-documented reference material','reference-materials',38,600,99.0,
   'γ-ECG (γ-Glu-Cys-Gly)','307.32 g/mol','lyophilized_powder','-20°C','70-18-8','NP-GSH-0260',true,'in_stock',
   'Lyophilized tripeptide supplied as a batch-documented reference material.',
   'Glutathione 600mg is a lyophilized tripeptide supplied as a batch-documented reference material for qualified in vitro laboratory research. Each batch is third-party tested and accompanied by available analytical documentation.',
   false,false)
on conflict (id) do update set
  name              = excluded.name,
  subtitle          = excluded.subtitle,
  category_slug     = excluded.category_slug,
  price             = excluded.price,
  vial_size_mg      = excluded.vial_size_mg,
  purity_percent    = excluded.purity_percent,
  peptide_sequence  = excluded.peptide_sequence,
  molecular_weight  = excluded.molecular_weight,
  form              = excluded.form,
  storage_temp      = excluded.storage_temp,
  cas_number        = excluded.cas_number,
  batch_number      = excluded.batch_number,
  research_use_only = true,
  stock_status      = excluded.stock_status,
  short_description = excluded.short_description,
  description       = excluded.description,
  featured          = excluded.featured,
  is_new            = excluded.is_new,
  updated_at        = now();

-- NOTE: GLP-1 analogs (Semaglutide/Tirzepatide) are intentionally NOT seeded.
-- They require an explicit regulatory + payment-processing plan confirmed by
-- the business owner before being added.

-- ── 5. Indexes ───────────────────────────────────────────────────────────
create index if not exists idx_products_slug          on public.products (slug);
create index if not exists idx_products_category_slug  on public.products (category_slug);
create index if not exists idx_products_stock_status   on public.products (stock_status);

-- ── 6. Row Level Security ────────────────────────────────────────────────
-- Preserve/establish RLS. Public read of the catalog; writes are restricted
-- to the service role only (server-side). Existing policies are not dropped.
alter table public.products          enable row level security;
alter table public.product_categories enable row level security;

do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'products'
      and policyname = 'Public read products'
  ) then
    create policy "Public read products"
      on public.products for select
      using (true);
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'product_categories'
      and policyname = 'Public read product_categories'
  ) then
    create policy "Public read product_categories"
      on public.product_categories for select
      using (true);
  end if;
end $$;

-- Service role bypasses RLS for inserts/updates; no anon write policy is
-- created here by design. Do not add anon write access.
