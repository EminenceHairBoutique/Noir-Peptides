# Label System — How-To

_Operating guide for the RUO label system (Label Studio at `/admin/labels`)._

## Add a label for a product / variant
1. `/admin/labels` → **New label** → pick product (and vial-size variant) → **Create draft**. Display name, quantity, and SKU seed from the live catalog; a unique verification code is assigned server-side.
2. Edit fields → **Save**. Switch template (4 directions: Noir Clinical Core, Spectral Helix
   (Holographic), Cryogenic White, Neural Grid) and die preset (5) from the toolbar;
   **Flat / Guides / 3D vial** views preview live.
3. Lot / expiry left blank render as ruled fill-in fields on the label (never placeholder words) —
   enter real batch data when it exists.

## Lot numbers & dates
- Set the **packaged date** first, then **Suggest** derives `NP-<CODE>-<YYMM>-001` — lots always reflect real batch data; adjust the batch suffix manually for subsequent batches.
- Set **either** expiration **or** retest date (retest only when that matches the quality system). Renders `EXP YYYY-MM` / `RETEST YYYY-MM`.

## Storage wording (verified-only)
Pick a controlled phrasing preset or write custom text, then tick **Source-verified** once product-specific supplier/stability documentation confirms it. Until then the label prints
`Storage: refer to accompanying batch documentation.` — temperatures are never invented. The studio flags unverified configs.

## Blends
Add composition rows (max 4). Quantities must come from batch records; any empty quantity renders `Composition: pending administrative input`.

## Barcode & QR
- Barcode encodes `barcode_value` (default the SKU) as Code 128, ladder orientation; keep ≤ 11 chars (studio warns).
- QR always deep-links `/v/<verification-code>` → the public verification page (states: verified / expired / recalled / administrative hold / not found / unavailable, plus the linked published COA when the lot matches). Codes are crypto-random Crockford base32 — never sequential, never internal IDs.

## Approval workflow
`Draft → In Review → (Changes Requested ↔) Approved → Production Ready`, `Archived` from anywhere; transitions are validated server-side, every change snapshots to history (restorable) and writes `audit_logs`. **Only Approved / Production Ready labels can ever render outside the studio** — customer surfaces and future integrations must go through `canRenderOutsideStudio()` (`lib/labelConstants.js`). Re-submitting an approved label for review bumps `label_version`.

## Exports
- **SVG** — editable vector master (text preserved) for the printer.
- **PNG** — 300-DPI raster of the current preset.
- **PDF** — print-ready single-label PDF (Checkpoint 2): bleed-extended artwork, crop marks at the
  trim corners, and a slug line (trim/bleed/overlap sizes, SKU, template, DPI, date). pdf-lib loads
  lazily (`vendor-pdf` chunk) only when the button is clicked.

## 3D vial
Procedural three.js vial (no external models; CSP-safe). The label texture is the SAME SVG output rasterized with embedded brand fonts. Wheel zoom is disabled (page scroll never traps); zoom via the +/− buttons; auto-rotate pauses on interaction and honors `prefers-reduced-motion`; devices without WebGL get the flat label. To change vial geometry edit `src/components/product3d/VialScene.jsx` (units = mm).

## Regenerate sample previews
`node scripts/gen-label-previews.mjs` → `docs/labels/previews/` (uses real catalog quantities).

## Troubleshooting
- **Texture/PNG shows system fonts** → `/fonts/*.woff2` must be reachable same-origin (fontEmbed inlines them; check network tab, then hard-reload).
- **3D blank** → WebGL unavailable (fallback should render) or context lost (re-open the view). 
- **Local `npm run dev:api`** doesn't register the new endpoints (dev-server.js lists routes manually) — use the Vercel preview for end-to-end testing, or add them to dev-server.js.
