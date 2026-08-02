# Phase 5 — Customer-facing label integration (PDP 3D vial)

_Approved product labels surface on the storefront as an interactive 3D vial;
verification stays a first-class trust signal._

## What renders where

- **Product detail page (PDP):** when the selected variant has an **approved /
  production-ready** label, the media column shows the interactive 3D vial
  textured with that exact label (same `renderLabelSvg` output as the studio,
  print, and 3D — one source, no drift). Otherwise the existing placeholder
  shows. A caption notes every vial ships with a scannable batch-verification
  QR; the COA card below already links the certificate + verify QR.
- **Shop grid:** each card whose product has an approved label shows a
  lightweight **static front-panel preview** (procedural SVG built from the
  approved label's real data — brand / name / quantity / RUO), lazily mounted
  when the card scrolls into view. NO WebGL and NO master raster on the grid
  (both would tank it); the interactive master 3D vial stays PDP-only. Cards
  without an approved label keep the placeholder. Batch-fetched once via
  `/api/product-labels` (one approved label per product).

## Data path (approved-only, public)

`GET /api/product-label?product_id=&variant_id=` — rate-limited (120/min),
service-role read of `label_configs` (which has **no public RLS**). Returns a
label **only** when `isLabelPubliclyRenderable()` passes: approved /
production-ready, not recalled, not past expiration/retest. Renderable field
set only (no `created_by`, approver, revision notes, asset URLs, timestamps).
Prefers the exact variant; falls back to a product-level label, then to ANY approved label for the product (so the page still shows the vial). Client helper:
`getProductLabel()` in `src/lib/labelsApi.js`.

The gate is the same publishing rule enforced everywhere else
(`canRenderOutsideStudio` + date/recall), now unit-tested for the PDP path too.

## Performance

`VialPreview` gates the heavy `three.js` stack behind an IntersectionObserver +
WebGL probe; `vendor-three` (245 KB gzip) stays a lazy chunk and loads only
when a vial with an approved label scrolls into view. The `ProductDetail`
chunk is ~7 KB gzip (VialPreview wrapper only). No-WebGL / reduced-motion
devices get the flat label render; a screen-reader summary always exposes the
label content.

## Verification

Every label QR deep-links `${origin}/v/<verification-code>` → the six-state
verification page (verified / expired / recalled / administrative-hold /
not-found / unavailable) + linked published COA. On production the origin is
the live domain automatically (the texture renders with `window.location.origin`).

## Go-live checklist

1. In `/admin/labels`, move a product's label **Draft → In Review → Approved**.
2. Its variant's PDP now shows the interactive vial (approved-only; drafts stay
   hidden — the placeholder shows until approval).
3. Scan the on-vial QR (or open `/v/<code>`) to confirm the verification page +
   COA resolve.
