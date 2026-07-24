# Noir Label Engine v1 — EXACT-Master Checkpoint Report

_Implements the owner-supplied starter package (`docs/labels/master-packages/`):
the approved SVG masters are **immutable artwork**; product data is applied only
as a deterministic `VARIABLE_DATA` overlay._

> **Rollout complete (owner approval, 2026-07-19):** after Core Black sign-off
> the production-resolution `Noir_Peptides_SVG_Templates` package replaced the
> thumbnail Spectral/Cryogenic masters, and **all four templates now render on
> their EXACT masters** (field maps grid-measured per template; patch textures
> sampled from each master — tile / mirrored-gradient reconstruction for
> patterned backgrounds and metallic strips). The compact lot format
> `NP2405-001` (NPYYMM-BBB) is now the generated format (legacy long lots
> remain valid for old rows). QA renders: `docs/labels/previews/master-*`._

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

1. ~~Spectral + Cryogenic thumbnails~~ **RESOLVED** — production masters
   received (Spectral 1817×866, Cryogenic 1536×510) and rolled out.
2. ~~Lot format~~ **RESOLVED** — compact `NPYYMM-BBB` approved; the studio
   Suggest button now generates it.
3. **Physical size** (still open): wrap width defaults to 72 mm; per-template
   heights follow each master's aspect (Core Black 23.9 mm · Spectral 34.3 mm
   · Cryogenic 23.9 mm · Neural Grid 34.0 mm). Confirm dies with the printer
   (PDF slug notes "art edge = trim"; masters carry no bleed).
4. Print note (from the package README): for final production, the chosen
   template should be manually rebuilt as native vector artwork once
   dimensions, fonts, and printer specs are fixed — the embedded-raster
   masters are the approved visual reference and web/3D source.

## Scope notes

- Only the **full wrap** has approved master artwork; front/neck/cap/partial
  presets keep the procedural engine (which carries RUO warnings as text —
  still fully tested).
- The 3D vial derives the label height from the artwork aspect (no
  stretching), and the same master render feeds preview, PNG, PDF, and 3D.
- No production deployment: everything is on PR #9's preview only.
