# Catalog Rollout Matrix — Phase 4

_Label coverage for the full catalog (37 products / 66 variants), managed from
the studio: `/admin/labels` → **Catalog matrix**._

## How it works

- The matrix lists every product/variant with its label status (or "no
  label"), template, and version; coverage stats sit in the header
  (`covered / total · approved`). Filter by product/SKU; "Missing only" shows
  the gap list. Clicking a covered row opens that config in the editor.
- **Seed N missing drafts** creates a draft for every uncovered variant in one
  explicit admin action (never automatic). Each draft gets its own crypto
  verification code, history snapshot, and audit-log entry.
- Seeding rules (`lib/labelSeed.js`, shared by server + studio + tests, and
  unit-tested):
  - Name / quantity / SKU / barcode come from the live catalog; barcode
    defaults to the SKU.
  - **Blends** seed their component NAMES from catalog data ("A + B Blend"
    names parse directly; GLOW/KLOW component lists come from the catalog
    descriptions) with **empty quantities** — labels render "pending
    administrative input" until the owner enters real values.
  - Storage seeds **unverified** (safe placeholder prints until per-product
    documentation is confirmed); lot/dates stay blank fill-in fields.
  - Default direction: **Core Black** (owner-approved evergreen) —
    switchable per config in the editor.

## Owner workflow to production

1. Seed the catalog (one click) → 66 drafts.
2. Per product: enter verified storage, real lot (`NP<YYMM>-BBB`), MFG/EXP
   dates, and blend quantities; pick a non-default template where desired.
3. Draft → In Review → Approved (per label). Only Approved / Production-Ready
   labels can ever render outside the studio — Phase 5 (PDP/shop integration)
   consumes exclusively those.

## Notes

- Retatrutide / Tirzepatide (and the rest of the Metabolic & Incretin category)
  were added 2026-07-23; seed the catalog matrix to generate their label drafts.
- Re-running the seed never duplicates or overwrites: covered variants are
  skipped.
