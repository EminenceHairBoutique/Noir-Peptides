-- ════════════════════════════════════════════════════════════════════════
-- 0031 — lot-level CAS number on COA rows  (trust-surface W1 / gap G6)
--
-- Adds a NULLABLE cas_number to public.coas. A CAS Registry Number is an
-- identity assertion about the substance a specific certificate covers, so it
-- lives at LOT level on the certificate row — it is deliberately NOT copied
-- from any product-level value (none exists in this schema today, and product-
-- vs lot-level CAS are different assertions in any case).
--
-- Format is validated at the ingest layer (api/admin/coa.js via lib/cas.js):
-- 2–7 digits, hyphen, 2 digits, hyphen, 1 check digit, with the standard CAS
-- checksum verified. Malformed input is rejected with a 400, never stored.
--
-- NO DATA IS POPULATED HERE. Entering real CAS values is owner data entry;
-- every render path treats NULL as "omit the field entirely" (no "N/A").
--
-- The index supports the /test-results CAS search (W3), which filters on
-- exact normalized values.
--
-- Idempotent; safe to re-run. Rollback (comment only):
--   drop index if exists idx_coas_cas_number;
--   alter table public.coas drop column if exists cas_number;
-- ════════════════════════════════════════════════════════════════════════

alter table public.coas add column if not exists cas_number text;

create index if not exists idx_coas_cas_number
  on public.coas (cas_number)
  where cas_number is not null;
