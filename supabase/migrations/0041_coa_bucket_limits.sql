-- 0041_coa_bucket_limits.sql   (opt cycle 12 — scorecard 4.3)
-- The private coa-files bucket (0037) accepts PDF / JPEG up to 4 MB through
-- api/admin/coa-upload.js (content-sniffed, size-capped before buffering).
-- This puts the same limits on the bucket itself so no other path can store
-- anything else. Guarded like 0037 (no-op where the storage schema is absent,
-- e.g. bare Postgres). Idempotent; changes no object.

do $$
begin
  if to_regclass('storage.buckets') is not null then
    update storage.buckets
      set file_size_limit = 4194304,
          allowed_mime_types = array['application/pdf', 'image/jpeg']
      where id = 'coa-files';
  end if;
end $$;
