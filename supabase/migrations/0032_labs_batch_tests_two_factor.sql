-- ════════════════════════════════════════════════════════════════════════
-- 0032 — two-factor COA verification: labs, batch_tests, and the coas
--        columns that make a certificate resolvable against the ISSUING
--        LABORATORY'S OWN public record.
--
-- WHY: third-party vendor-audit sites score a certificate highest when its
-- lot resolves on the lab's public lookup AND the returned client name
-- matches the vendor ("two-factor confirmed"). Self-hosted PDFs alone score
-- materially lower, and an unnamed lab is penalised outright. Everything
-- here exists to make that second factor possible.
--
-- SHAPE DECISION (owner-approved): the audit brief proposed a NEW `batches`
-- table, but public.coas already stores lot_number, purity_percent,
-- cas_number, tested_at, lab_name and file_url, and is read by ten modules
-- (/test-results, /verify-lot, /v/:code, the PDP, product cards, the static
-- prerenderer, admin, db-verify). A parallel table would create two sources
-- of truth for one entity — the schema drift this project's RUNBOOK calls
-- its house failure mode. So `coas` IS the batch record and is extended
-- additively; `labs` and `batch_tests` are genuinely new.
--
-- STRICTLY ADDITIVE. No column is dropped, renamed, or retyped; no row is
-- written, updated, or deleted. Existing consumers are unaffected — every
-- new column is nullable and every new table is empty.
--
-- NO DATA IS SEEDED. Labs, accreditation numbers, lookup codes, net peptide
-- content and test-panel rows are all owner-entered. Nothing here invents a
-- lab, an accreditation number, or a result.
--
-- Idempotent; safe to re-run. Rollback (comment only):
--   drop table if exists public.batch_tests;
--   alter table public.coas drop column if exists lab_id;  -- (etc.)
--   drop table if exists public.labs;
-- ════════════════════════════════════════════════════════════════════════

-- ── 1. labs — the issuing laboratory, named and accredited ───────────────
create table if not exists public.labs (
  id                       bigint generated always as identity primary key,
  name                     text not null,
  accreditation_body       text,          -- e.g. an ISO/IEC 17025 accreditation body
  accreditation_number     text,
  -- Template for the lab's OWN public record, with {code} substituted from
  -- coas.lab_lookup_code. This field is what enables the second factor.
  public_lookup_url_template text,
  verified_at              date,          -- when the owner last confirmed the lab record
  notes                    text,
  created_at               timestamptz not null default now()
);

comment on column public.labs.public_lookup_url_template is
  'Absolute https URL containing the literal {code} placeholder, e.g. https://lab.example/verify?code={code}. Rendered only when a certificate also carries lab_lookup_code.';

-- ── 2. coas gains the batch/verification columns (additive) ──────────────
alter table public.coas add column if not exists lab_id                 bigint;
alter table public.coas add column if not exists lab_lookup_code        text;
-- Purity is frequently reported as ">= 99%" rather than an exact figure;
-- storing the operator separately keeps the displayed claim faithful.
alter table public.coas add column if not exists purity_operator        text;
alter table public.coas add column if not exists net_peptide_content_mg numeric(10,3);
alter table public.coas add column if not exists label_claim_mg         numeric(10,3);
alter table public.coas add column if not exists published_on           date;
alter table public.coas add column if not exists status                 text;

do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'coas_lab_id_fkey'
  ) then
    alter table public.coas
      add constraint coas_lab_id_fkey foreign key (lab_id)
      references public.labs(id) on delete set null;
  end if;
  if not exists (
    select 1 from pg_constraint where conname = 'coas_purity_operator_check'
  ) then
    alter table public.coas
      add constraint coas_purity_operator_check
      check (purity_operator is null or purity_operator in ('=', '>', '>='));
  end if;
  if not exists (
    select 1 from pg_constraint where conname = 'coas_status_check'
  ) then
    alter table public.coas
      add constraint coas_status_check
      check (status is null or status in ('published', 'archived'));
  end if;
end $$;

-- Fast lot lookup for the QR/verification path.
create index if not exists idx_coas_lot_number on public.coas (lot_number) where lot_number is not null;
create index if not exists idx_coas_lab_id     on public.coas (lab_id)     where lab_id is not null;

-- A lot number must be unique WITHIN a product (the same lot string may
-- legitimately recur across different materials). Partial so legacy rows
-- with a null lot are unaffected.
create unique index if not exists uq_coas_product_lot
  on public.coas (product_id, lot_number)
  where product_id is not null and lot_number is not null;

-- ── 3. batch_tests — the analytical panel behind a certificate ───────────
create table if not exists public.batch_tests (
  id               bigint generated always as identity primary key,
  coa_id           bigint not null references public.coas(id) on delete cascade,
  panel_category   text not null,
  test_name        text not null,
  method_reference text,          -- e.g. a compendial method identifier, as recorded
  result_value     text,
  result_unit      text,
  passed           boolean,
  sort_order       integer not null default 0,
  created_at       timestamptz not null default now(),
  constraint batch_tests_panel_category_check
    check (panel_category in ('identity_potency', 'contamination', 'integrity_stability'))
);

create index if not exists idx_batch_tests_coa_id on public.batch_tests (coa_id);

-- ── 4. RLS — following the EXISTING pattern from 0014/0003 ───────────────
-- Public read of labs (a named lab is the point) and of test rows belonging
-- to a PUBLISHED certificate. Writes stay with the service role, which
-- bypasses RLS, exactly as the admin COA endpoints already work.
alter table public.labs        enable row level security;
alter table public.batch_tests enable row level security;

do $$
begin
  if not exists (select 1 from pg_policies where schemaname='public' and tablename='labs' and policyname='labs_public_read') then
    create policy "labs_public_read" on public.labs for select using (true);
  end if;

  -- A test row is visible exactly when its parent certificate is visible.
  if not exists (select 1 from pg_policies where schemaname='public' and tablename='batch_tests' and policyname='batch_tests_public_read') then
    create policy "batch_tests_public_read" on public.batch_tests
      for select using (
        exists (
          select 1 from public.coas c
          where c.id = batch_tests.coa_id
            and c.is_published is not false
        )
      );
  end if;
end $$;

-- Base grants, role-guarded so this also applies on a vanilla Postgres
-- (the CI fresh-PG16 check has no Supabase roles). SELECT only — no write
-- grant to the public roles, matching how coas is handled.
do $$
begin
  if exists (select 1 from pg_roles where rolname = 'anon') then
    grant select on public.labs, public.batch_tests to anon;
  end if;
  if exists (select 1 from pg_roles where rolname = 'authenticated') then
    grant select on public.labs, public.batch_tests to authenticated;
  end if;
end $$;
