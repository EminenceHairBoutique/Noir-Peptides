# Applying migration 0037

Paste-ready SQL for the Supabase SQL editor, following `docs/MIGRATIONS_0036.md`.

Migration **0037** is **strictly additive** and **idempotent**: a private
storage bucket `coa-files` and one nullable column `coas.file_path`. It
writes **no rows**. Existing certificates keep their external `file_url`
links; nothing changes until you upload a file from the Control Room.

## Step 1 — apply

**SQL Editor → New query**, paste `supabase/migrations/0037_coa_files.sql`,
run. Expected: `Success. No rows returned.`

## Step 2 — verify

```sql
select id, public from storage.buckets where id = 'coa-files';   -- coa-files | false
select column_name from information_schema.columns
 where table_schema = 'public' and table_name = 'coas' and column_name = 'file_path';
```

## Step 3 — what changes

- **Control Room → COA Manager**: each certificate row gains an "Upload
  PDF / JPG" control. The file is checked by content (not by name), capped
  at 4 MB, stored privately, and the row's link becomes
  `/api/coa-file/<id>.pdf` (or `.jpg`).
- **Storefront**: that link redirects to a 10-minute signed URL for
  PUBLISHED certificates only; unpublished ones answer 404. The four
  certificate renderers and the prerender need no change.
- Files are never public and never cached by the CDN.

## Rollback

`alter table public.coas drop column file_path;` and delete the bucket in
Storage. Uploaded links then 404; re-enter external URLs if needed.
