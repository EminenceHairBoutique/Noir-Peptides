# Noir Label Engine v1.0

## Mission

Build a deterministic label-generation system for Noir Peptides that uses the approved exact-fidelity SVG masters as immutable artwork and swaps only approved product-specific fields.

The engine must never redesign, reinterpret, regenerate, resize, recolor, or restructure the approved label artwork.

## Approved Templates

Use these exact masters:

- Core Black
- Spectral
- Cryogenic
- Neural Grid

Each template contains:

- `MASTER_ARTWORK`: immutable
- `VARIABLE_DATA`: dynamic overlay layer

The engine must modify only `VARIABLE_DATA`.

## Critical Rules

1. Never alter `MASTER_ARTWORK`.
2. Never regenerate labels with AI.
3. Never rebuild the design in HTML/CSS.
4. Never change typography, spacing, borders, QR placement, barcode placement, logo placement, metallic strips, molecular graphics, or decorative elements.
5. Use the same master for web preview, 3D vial texture, and print export.
6. Product changes must be deterministic and data-driven.
7. All generated outputs must be reproducible from the same input payload.

## Dynamic Fields

Supported variable fields:

- product name
- product name line 1
- product name line 2
- quantity
- composition line 1
- composition line 2
- storage text
- lot number
- manufacturing date
- expiration or retest date
- catalog number
- barcode value
- QR verification URL
- verification code
- product family
- label status
- template ID

## Architecture

### Core Modules

- Template registry
- Product label schema
- Field-layout map per template
- Dynamic SVG overlay renderer
- QR generator
- Code 128 barcode generator
- Print export pipeline
- 3D texture export pipeline
- Admin approval workflow
- Validation layer
- Audit log
- Version history

### Rendering Strategy

Do not edit pixels inside `MASTER_ARTWORK`.

For every dynamic field:

1. Position a background patch over the original sample value.
2. Use a patch sampled from the exact corresponding approved master.
3. Draw the replacement field over that patch.
4. Preserve font family, size, weight, letter spacing, line height, alignment, and color.
5. Reject output if text exceeds its bounding box.
6. Do not move other fields to compensate.

### Long Product Names

Allowed behavior:

- use one line if it fits
- use the approved two-line format
- reduce only product-name font size within configured limits
- apply approved abbreviation only if present in product data

Forbidden behavior:

- moving the dose strip
- moving the logo
- changing center alignment
- increasing panel height
- changing letter spacing outside approved limits

## Template Registry

Each template must define:

- immutable master SVG path
- preview image path
- physical size
- viewBox
- field coordinates
- field bounding boxes
- font metrics
- background patch assets
- text alignment
- allowed minimum font size
- QR bounding box
- barcode bounding box
- bleed
- safe area
- label seam
- 3D texture crop

## Data Validation

Required before production-ready status:

- product name
- quantity
- catalog number
- lot number
- expiration or retest date
- verified storage text
- barcode value
- QR URL
- RUO warning
- approved template
- approved composition

Reject any label containing:

- unverified storage temperature
- invented expiry
- invented composition
- fake GS1 or UPC
- therapeutic claims
- human-use instructions
- missing RUO warning
- QR URL that does not resolve to the correct verification record

## Workflow

### Draft

Admin selects:

1. product
2. variant
3. template
4. lot
5. date fields
6. composition
7. storage statement

The engine generates a draft preview.

### Review

Admin sees:

- flat front preview
- full label preview
- 3D vial preview
- QR scan test
- barcode scan test
- overflow warnings
- field validation
- diff against approved template

### Approval

Statuses:

- draft
- in_review
- changes_requested
- approved
- production_ready
- archived

Only approved or production-ready labels may appear on customer-facing pages.

## Output Formats

Generate:

- SVG
- PNG
- WebP
- PDF
- 3D texture PNG/WebP
- static vial render
- print sheet

## 3D Integration

Use the generated label texture on the 10 mL vial model.

Requirements:

- preserve label aspect ratio
- do not stretch artwork
- account for vial curvature
- use anisotropic texture filtering
- generate static fallback image
- lazy-load interactive 3D
- update texture when variant changes
- never render dozens of active WebGL canvases on the shop page

## Testing

Required tests:

- immutable master hash remains unchanged
- field coordinates remain unchanged
- text overflow detection
- correct template selection
- QR payload validation
- Code 128 generation
- label status publishing rules
- product variant switching
- SVG export
- PNG export
- PDF export
- 3D texture export
- regression screenshot comparison
- mobile rendering
- print dimensions

## Acceptance Criteria

The system is complete when:

1. all four exact-fidelity masters are registered
2. product data can be swapped without altering the design
3. generated label previews match the approved master except for variable fields
4. QR and barcode are scannable
5. the same label is used for PDP, shop preview, 3D vial, and print export
6. admin approval controls publication
7. snapshot tests detect visual drift
8. no AI image generation is part of the production pipeline
