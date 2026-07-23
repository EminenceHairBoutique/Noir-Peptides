-- supabase/migrations/0019_janoshik_coas.sql
-- Seed the owner-supplied Janoshik third-party Certificates of Analysis for
-- every catalog product that was tested. Data is transcribed VERBATIM from the
-- certificate images (public/coas/janoshik/<product>.jpg): purity by HPLC,
-- identity by mass-spec, the manufacturing batch, the analysis date, and the
-- Janoshik task number (the certificate's own unique reference, used as the
-- lot key so /verify-lot resolves to the exact report).
--
-- COMPLIANCE: nothing is invented. Products absent from the catalog
-- (Tirzepatide, Retatrutide) and bacteriostatic water — 6 certificates in the
-- package — are intentionally NOT seeded; they have no listing to attach to.
-- Blend certificates report per-component content (no single purity %), so
-- purity_percent is left null and identity confirmation carries the result.
--
-- Idempotent: re-running replaces the Janoshik rows only.

begin;

delete from public.coas where lab_name = 'Janoshik Analytical';

insert into public.coas
  (product_id, batch_number, lot_number, file_url, purity_percent, hplc, mass_spec, ms_confirmed, is_published, tested_at, lab_name)
values
  -- Single-compound peptides (HPLC purity + mass-spec identity confirmed)
  ('bpc-157',      '2026-05', 'JAN-169304', '/coas/janoshik/bpc-157.jpg',      99.68, '99.680%', 'BPC-157 identity confirmed (10.87 mg)',            true, true, '2026-06-16', 'Janoshik Analytical'),
  ('tb-500',       '2026-05', 'JAN-169288', '/coas/janoshik/tb-500.jpg',       99.21, '99.209%', 'TB-500 (TB-4) identity confirmed (11.06 mg)',      true, true, '2026-06-09', 'Janoshik Analytical'),
  ('kpv',          '2026-05', 'JAN-169316', '/coas/janoshik/kpv.jpg',          98.54, '98.537%', 'KPV identity confirmed (11.28 mg)',                true, true, '2026-06-09', 'Janoshik Analytical'),
  ('mots-c',       '2026-05', 'JAN-169314', '/coas/janoshik/mots-c.jpg',       99.06, '99.061%', 'MOTS-c identity confirmed (10.92 mg)',             true, true, '2026-06-09', 'Janoshik Analytical'),
  ('ghk-cu',       '2026-05', 'JAN-169290', '/coas/janoshik/ghk-cu.jpg',       99.79, '99.790%', 'GHK-Cu identity confirmed (52.50 mg total)',       true, true, '2026-06-10', 'Janoshik Analytical'),
  ('semax',        '2026-05', 'JAN-169317', '/coas/janoshik/semax.jpg',        98.80, '98.799%', 'Semax identity confirmed (11.12 mg)',              true, true, '2026-06-09', 'Janoshik Analytical'),
  ('selank',       '2026-05', 'JAN-169303', '/coas/janoshik/selank.jpg',       99.78, '99.778%', 'Selank identity confirmed (10.14 mg)',             true, true, '2026-06-16', 'Janoshik Analytical'),
  ('tesamorelin',  '2026-05', 'JAN-169289', '/coas/janoshik/tesamorelin.jpg',  98.49, '98.494%', 'Tesamorelin identity confirmed (9.91 mg)',         true, true, '2026-06-08', 'Janoshik Analytical'),
  -- Content-quantified reference material (no single purity %)
  ('nad-plus',     '2026-05', 'JAN-169315', '/coas/janoshik/nad-plus.jpg',     null,  null,      'NAD+ content confirmed (560.92 mg)',               true, true, '2026-06-05', 'Janoshik Analytical'),
  -- Blends: per-component content confirmed by Janoshik
  ('cjc-1295-ipamorelin', '2026-05', 'JAN-169310', '/coas/janoshik/cjc-1295-ipamorelin.jpg', null, null, 'Ipamorelin 4.93 mg + CJC-1295 (mod GRF 1-29) 4.95 mg confirmed', true, true, '2026-06-08', 'Janoshik Analytical'),
  ('bpc-157-tb-500',      '2026-05', 'JAN-169282', '/coas/janoshik/bpc-157-tb-500.jpg',      null, null, 'BPC-157 6.25 mg + TB-500 (TB-4) 5.70 mg confirmed',              true, true, '2026-06-11', 'Janoshik Analytical'),
  ('glow',                '2026-05', 'JAN-169284', '/coas/janoshik/glow.jpg',                null, null, 'GHK-Cu 50.07 mg + TB-500 11.43 mg + BPC-157 11.65 mg confirmed', true, true, '2026-06-11', 'Janoshik Analytical'),
  ('klow',                '2026-05', 'JAN-169283', '/coas/janoshik/klow.jpg',                null, null, 'GHK-Cu 49.69 mg + TB-500 11.15 mg + BPC-157 11.38 mg + KPV 10.32 mg confirmed', true, true, '2026-06-11', 'Janoshik Analytical');

commit;
