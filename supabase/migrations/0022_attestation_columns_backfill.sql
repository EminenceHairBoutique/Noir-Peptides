-- supabase/migrations/0022_attestation_columns_backfill.sql
-- Fix "Failed to record attestation": on databases where an older 0003 was
-- applied before the legal-name columns were added, attestation_audit and
-- profiles are missing the columns /api/attestation writes. `create table if
-- not exists` never backfills columns into an existing table, so add them here.
-- Idempotent and additive; no-op where 0003 was applied in full.

-- Audit table (append-only consent record).
alter table public.attestation_audit add column if not exists legal_name text;
alter table public.attestation_audit add column if not exists ip_address text;
alter table public.attestation_audit add column if not exists user_agent text;
alter table public.attestation_audit add column if not exists statements jsonb;
alter table public.attestation_audit add column if not exists version    text;

-- Profile snapshot the auth wall reads.
alter table public.profiles add column if not exists attestation_legal_name  text;
alter table public.profiles add column if not exists attestation_completed_at timestamptz;
alter table public.profiles add column if not exists attestation_version      text;
alter table public.profiles add column if not exists attestation_statements   jsonb;
alter table public.profiles add column if not exists attestation_ip           text;
alter table public.profiles add column if not exists attestation_user_agent   text;
