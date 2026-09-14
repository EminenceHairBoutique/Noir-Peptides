# Applying migration 0041

Follows `docs/MIGRATIONS_0040.md`. Migration **0041** sets the storage limits of
the private `coa-files` bucket (created by 0037) to what the upload route already
enforces: **4 MB**, **PDF or JPEG only**. It changes no existing object and is a
no-op where the storage schema does not exist. Idempotent.

## Step 1 — apply

**SQL Editor → New query**, paste `supabase/migrations/0041_coa_bucket_limits.sql`,
run. Expected: `Success. No rows returned.`

## Step 2 — verify

```sql
select id, file_size_limit, allowed_mime_types from storage.buckets where id = 'coa-files';
```

Expected: `4194304` and `{application/pdf,image/jpeg}`.
