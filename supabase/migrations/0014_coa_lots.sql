-- ════════════════════════════════════════════════════════════════════════
-- Noir Peptides — 0014: COA lots, lab name, and publish flag
--
-- Extends the existing `coas` table (0004) to support the public, batch-
-- specific COA library + lot/QR verification lookup (Task 3):
--   * lab_name     — the testing lab (e.g. Janoshik, MZ Biolabs, Colmaric),
--                    displayed prominently as a trust signal
--   * lot_number   — the lot printed on the vial; the QR/lookup key
--   * ms_confirmed — boolean identity-by-MS confirmation (in addition to the
--                    free-text mass_spec detail)
--   * is_published — only published COAs are visible publicly
--
-- The existing columns already cover the rest: product_id, batch_number,
-- file_url (PDF link), purity_percent + hplc (HPLC purity), mass_spec (MS
-- identity detail), tested_at (test date).
--
-- COMPLIANCE: this migration adds STRUCTURE only. It seeds NO analytical
-- values — purity / MS / lab results are real lab data and are entered by the
-- owner per batch. Nothing is fabricated here.
--
-- Idempotent / additive.
-- ════════════════════════════════════════════════════════════════════════

alter table public.coas add column if not exists lab_name     text;
alter table public.coas add column if not exists lot_number   text;
alter table public.coas add column if not exists ms_confirmed boolean;
alter table public.coas add column if not exists is_published boolean not null default true;

-- Backfill lot_number from batch_number where a lot wasn't supplied separately.
update public.coas set lot_number = batch_number where lot_number is null and batch_number is not null;

create index if not exists idx_coas_lot on public.coas (lot_number);
-- Case-insensitive lot lookup (buyers may type the lot in any case).
create index if not exists idx_coas_lot_lower on public.coas (lower(lot_number));

-- ── Public read = PUBLISHED rows only ────────────────────────────────────
-- 0013 added a blanket `coas_public_read using (true)`. Tighten it so anon
-- visitors see only published COAs; admins still see everything via the
-- `coas_attested_read` (is_admin) policy from 0003.
drop policy if exists "coas_public_read" on public.coas;
do $$
begin
  if not exists (select 1 from pg_policies where schemaname='public' and tablename='coas' and policyname='coas_public_read') then
    create policy "coas_public_read" on public.coas
      for select using (is_published is not false);
  end if;
end $$;
