# Database reconciliation (migration 0023)

Production's database was set up from early versions of the schema and
drifted: newer migrations ran, but several foundational objects were missing
or in older shapes (0014's COA columns, 0003's attestation table/columns —
each surfaced as a production bug). `create table if not exists` never
backfills columns into an existing table, so re-running old migrations cannot
fix drift.

**`0023_full_schema_reconcile.sql`** ends the whack-a-mole. It was GENERATED
by introspecting the golden schema (all migrations 0001–0022 applied to a
fresh Postgres 16) and guarantees, in one idempotent pass:

- every public **table** (full definition where missing),
- every **column** (`add column if not exists` per column; added columns are
  nullable — NOT NULL can't be retrofitted onto existing rows),
- every **index**, **function** (`is_admin`, `is_attested`,
  `handle_new_user`), the signup **trigger**, **RLS** flags, and every
  **policy** (guarded),
- pgvector objects (`embeddings`, `match_embeddings`) verbatim from 0008.

Not covered (can't be reconciled automatically/safely): column TYPE changes on
existing columns, and adding FK/unique constraints to pre-existing tables.

## Runbook

1. Supabase → SQL Editor → paste the full contents of
   `supabase/migrations/0023_full_schema_reconcile.sql` → Run.
2. Re-run the idempotent seeds **if** their data is missing (safe either way):
   `0009` (catalog), `0019` (COAs), `0020` (label drafts), `0021` (label batch
   data).
3. Verify with the marker query in the repo history / ask the assistant — or
   simply retry whatever failed (e.g. the attestation form).

Validated on three scenarios: EMPTY database (full schema materializes and
the attestation + label writes succeed), a DRIFTED database matching
production's state (all markers green; existing rows untouched), and a
FULLY-MIGRATED database (no-ops, idempotent across re-runs).

## Going forward

Run new migrations in numeric order as they land. If drift is ever suspected
again, re-running 0023 (or a regenerated successor) is always safe.
