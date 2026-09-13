-- 0037_coa_files.sql   (opt cycle 10 — addendum C8: COA file upload)
-- A PRIVATE storage bucket for certificate files and the object path on the
-- certificate row. No storage policy grants public reads: files are served
-- only through /api/coa-file/<id>.<ext>, which signs a 10-minute URL for
-- PUBLISHED certificates. Additive and idempotent. Writes no rows.

insert into storage.buckets (id, name, public)
values ('coa-files', 'coa-files', false)
on conflict (id) do nothing;

alter table public.coas add column if not exists file_path text;

comment on column public.coas.file_path is
  'Object path inside the private coa-files bucket (set by the Control Room upload). file_url then points at /api/coa-file/<id>.<ext>.';
