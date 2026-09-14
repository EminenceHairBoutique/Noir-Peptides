-- 0039_null_seeded_purity.sql   (opt cycle 12 — scorecard 4.4 / 4.1)
-- The catalog seed (0001, 0009) wrote a blanket purity_percent = 99.0 on every
-- product. That is a specification nobody measured, and the site's own
-- published certificates contradict it (KPV 98.54 %, Semax 98.80 %,
-- Tesamorelin 98.49 %). Since opt cycle 12 no public surface reads
-- products.purity_percent — purity is shown only from the latest PUBLISHED
-- certificate — so the seeded constant is cleared here. UPDATE only, guarded
-- to the seeded value: a purity an owner entered deliberately (anything other
-- than exactly 99.0) is kept. Idempotent. No column, no row created or removed.

update public.products set purity_percent = null where purity_percent = 99.0;
