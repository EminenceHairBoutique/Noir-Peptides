-- supabase/migrations/0021_label_coa_batch_data.sql
-- Backfill the seeded label drafts with the REAL batch data from the Janoshik
-- COAs (migration 0019), for the variant whose size matches each certificate's
-- tested sample. Nothing is invented:
--   * lot_number   = the COA's lot key (JAN-<task>) so /v/<code> resolves the
--                    exact certificate (verify links label.lot_number →
--                    coas.lot_number)
--   * batch_number = the COA's manufacturing batch (verbatim)
--   * packaged_date = the COA analysis date MINUS 2 days (owner rule)
--   * expiration_date = 2028-08-31 (owner rule)
--
-- Only touches DRAFT labels (never overwrites owner-approved work); idempotent.
-- Storage stays UNVERIFIED (separate owner confirmation). Variants with no
-- certificate keep their blank fill-in fields. Requires 0018 + 0020 (and 0019
-- for the linked COA rows to exist).

update public.label_configs lc set
  lot_number      = d.lot,
  batch_number    = d.batch,
  packaged_date   = d.packaged::date,
  expiration_date = date '2028-08-31',
  updated_at      = now()
from (values
  -- product              variant                        lot (JAN task)  batch         packaged (test − 2d)
  ('bpc-157',             'bpc-157-10mg',                'JAN-169304',   '2026-05',    '2026-06-14'),
  ('tb-500',              'tb-500-10mg',                 'JAN-169288',   '2026-05',    '2026-06-07'),
  ('kpv',                 'kpv-10mg',                    'JAN-169316',   '2026-05',    '2026-06-07'),
  ('mots-c',              'mots-c-10mg',                 'JAN-169314',   '2026-05',    '2026-06-07'),
  ('ghk-cu',              'ghk-cu-50mg',                 'JAN-169290',   '2026-05',    '2026-06-08'),
  ('semax',               'semax-10mg',                  'JAN-169317',   '2026-05',    '2026-06-07'),
  ('selank',              'selank-10mg',                 'JAN-169303',   '2026-05',    '2026-06-14'),
  ('tesamorelin',         'tesamorelin-10mg',            'JAN-169289',   '2026-05',    '2026-06-06'),
  ('nad-plus',            'nad-plus-500mg',              'JAN-169315',   '2026-05',    '2026-06-03'),
  ('cjc-1295-ipamorelin', 'cjc-1295-ipamorelin-10mg',   'JAN-169310',   '2026-05',    '2026-06-06'),
  ('bpc-157-tb-500',      'bpc-157-tb-500-10mg',         'JAN-169282',   '2026-05',    '2026-06-09'),
  ('glow',                'glow-70mg',                   'JAN-169284',   '2026-05',    '2026-06-09'),
  ('klow',                'klow-80mg',                   'JAN-169283',   '2026-05',    '2026-06-09'),
  ('tirzepatide',         'tirzepatide-10mg',            'JAN-169300',   '2026-06-20', '2026-06-27'),
  ('tirzepatide',         'tirzepatide-60mg',            'JAN-169301',   '2026-06-20', '2026-06-27'),
  ('retatrutide',         'retatrutide-10mg',            'JAN-169296',   '2026-06-20', '2026-06-27'),
  ('retatrutide',         'retatrutide-20mg',            'JAN-169297',   '2026-06-20', '2026-06-27'),
  ('retatrutide',         'retatrutide-40mg',            'JAN-169298',   '2026-06-20', '2026-06-27'),
  ('retatrutide',         'retatrutide-60mg',            'JAN-169299',   '2026-06-20', '2026-06-27')
) as d(product_id, variant_id, lot, batch, packaged)
where lc.product_id = d.product_id
  and lc.variant_id = d.variant_id
  and lc.status = 'draft';
