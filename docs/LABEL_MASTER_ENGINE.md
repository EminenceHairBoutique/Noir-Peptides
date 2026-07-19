# Noir Label Engine v1 — EXACT-Master Checkpoint Report

_Implements the owner-supplied starter package (`docs/labels/master-packages/`):
the approved SVG masters are **immutable artwork**; product data is applied only
as a deterministic `VARIABLE_DATA` overlay. Per the implementation prompt, the
**Core Black prototype is complete and everything else STOPS for approval.**_

## What shipped

| Deliverable | Where |
|---|---|
| 4 EXACT masters registered (verbatim files, byte-for-byte) | `public/labels/masters/*.svg` |
| Template registry (masters ↔ existing DB template ids, sha256, viewBox, field maps) | `src/lib/labels/masters/registry.js` |
| Deterministic overlay renderer (patches sampled from the master, replacement text at approved coordinates, real QR + Code 128, overflow **rejection**) | `src/lib/labels/masters/renderMasterLabel.js` |
| Core Black end-to-end prototype (studio preview → PNG/PDF export → 3D texture) | `renderLabelSvg` delegates full-wrap Core Black to the master engine |
| Immutability + engine tests (hash drift, master bytes verbatim in output, overflow, determinism, blank fields, storage gating) | `scripts/test-labels.mjs` §EXACT-master |
| Master showcases for review | `docs/labels/previews/master-core-black-*.svg` |

Template id mapping (no DB migration needed — `label_configs.template_id`
CHECK is unchanged): `core-black→noir-clinical-core`, `spectral→spectral-biotech`,
`cryogenic→cryogenic-white`, `neural-grid→neural-grid`.

## How the overlay works (per spec)

1. The master's embedded raster is emitted **unchanged** inside a locked
   `MASTER_ARTWORK` group (tests assert the exact base64 bytes appear in every
   output, and that each master file still hashes to its recorded sha256).
2. For each dynamic field, a background **patch** covers the baked sample
   value — either a region *sampled from the master itself* (name zone,
   metallic strip) or a solid matched to the flat panel color — then the
   replacement value draws at the approved coordinates/size/color.
3. Values that cannot fit their approved bounding box, even at the field's
   minimum size, **reject the render** (`LabelOverflowError` — surfaced in the
   studio). Nothing is ever moved, scaled, or reflowed to compensate.
4. Compliance gates are unchanged: unverified storage renders the safe
   placeholder (the master's baked −20 °C sample is always patched), blend
   quantities render only when owner-entered, blank LOT/MFG/EXP stay blank
   over the artwork's fill-in rules. QR (EC-H, center NP mark) deep-links
   `/v/<code>`; Code 128 encodes `barcode_value`.

## Decisions / blockers for the owner

1. **Spectral + Cryogenic masters are not production artwork** — the uploaded
   packages embed 313×206 thumbnail cards (with "TEMPLATE 2/3" captions baked
   in). They are registered and hash-locked, but rollout needs high-res
   masters like Core Black (1198×398) / Neural Grid (1825×862).
2. **Lot format**: the approved artwork's LOT area fits the compact
   `NP2405-001` (NPYYMM-BBB) format used in the mockups and
   `sample-label.json`. The legacy repo format `NP-BPC157-2607-001` is too
   long and correctly rejects. Confirm the compact format and I'll update the
   studio's "Suggest" helper to generate it.
3. **Physical size**: Core Black aspect ⇒ 72 × 23.9 mm on the standard 72 mm
   wrap. Confirm die with the printer (PDF slug notes "art edge = trim"; the
   master carries no bleed).
4. Neural Grid rollout (field map measurement) awaits Core Black approval, per
   the starter package instructions.

## Scope notes

- Only the **full wrap** has approved master artwork; front/neck/cap/partial
  presets and the three non-rolled-out templates keep the procedural engine
  (which carries RUO warnings as text — still fully tested).
- The 3D vial derives the label height from the artwork aspect (no
  stretching), and the same master render feeds preview, PNG, PDF, and 3D.
- No production deployment: everything is on PR #9's preview only.
