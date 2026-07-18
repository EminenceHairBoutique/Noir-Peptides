# Label System — Repository Audit & Implementation Report (Checkpoint 1)

_Phase-1 deliverable for the RUO Label System + 3D Vial Preview mandate._

## 1. Current-state findings

| Area | Finding |
|---|---|
| Framework | React 19 + Vite 6 + Tailwind v4, plain `.jsx`; react-router-dom 7; Vercel SPA (filesystem-first rewrites) + `/api` serverless; Supabase (idempotent migrations `0001`–`0018`) |
| Product schema | `products` / `product_variants` (66 variants: `sku`, `size_label`, `vial_size_mg`) / `price_tiers`; catalog source of truth `src/data/tier1Catalog.js` (37 products) mirrored to seed `0009` |
| Brand | Tokens in `src/index.css` `@theme`: se-black `#05080f`, charcoal `#0d1420`, bone `#e8edf5`, steel `#8a9ab3`, concrete `#1e2d40`; accent (`se-gold`) is **cyan `#00c2ff`**. Fonts: Syne / DM Sans / IBM Plex Mono (3 families, all OFL) |
| Images | No real product photography; PDP media column is a CSS `vial-visual` placeholder — the future 3D insertion point. `generate-og-image.mjs` is a hand-rolled pixel painter (cannot rasterize SVG) → label PNG export is client-side canvas |
| QR/verification | `qrcode` dep (SVG-capable); `/verify-lot?lot=` COA lookup + public `/test-results`; `/verify` path is TAKEN by email confirmation → label QR uses **`/v/:code`** |
| Lot/batch fields | `coas.lot_number/batch_number` (0014); `products.batch_number` legacy; no label/inventory table existed → added `label_configs` (0018) |
| Admin | `RequireAdmin` client guard + `requireAdmin` server enforcement; column-whitelist write pattern; `audit_logs` table existed with **no writers** — the labels API is its first writer |
| CSP | External font/HDR/model fetches blocked at runtime; same-origin allowed → self-hosted fonts + procedural 3D environment |
| Performance baseline | 61 prerendered routes; main bundle unchanged by this work; heavy 3D isolated (see §7) |

## 2. Recommended / implemented architecture
One **pure SVG layout engine** (`src/lib/labels/renderLabelSvg.js`, Node-safe, async) renders every label from a
`label_configs` row; four template skins share the layout. The same SVG feeds: studio flat preview (inline DOM),
editable SVG master export, 300-DPI PNG export (canvas), and the 3D vial texture (CanvasTexture) — screen, print,
and 3D can never drift. Approval workflow (`draft → in_review → changes_requested → approved → production_ready →
archived`) is enforced server-side; **only approved/production_ready labels may render outside the studio**
(`canRenderOutsideStudio`, unit-tested).

## 3. Files added
- `supabase/migrations/0018_label_configs.sql` — `label_configs` + `label_config_history`, admin-only RLS, no public policies
- `lib/labelConstants.js` — shared enums/warnings/whitelist/publishing rule (server + client single source)
- `src/lib/labels/` — `renderLabelSvg.js`, `templates/*` (4), `presets.js`, `code128.js` (dependency-free Code 128B), `verificationCode.js` (crypto Crockford base32), `lots.js`, `storage.js`, `types.js`, `fontEmbed.js`, `rasterize.js`
- `api/admin/labels.js` (CRUD + workflow + history + audit) · `api/verify.js` (public, rate-limited) · `src/lib/labelsApi.js`
- `src/pages/LabelStudio.jsx` + `src/components/labels/{LabelPreview,LabelConfigForm,StatusControls}.jsx`
- `src/components/product3d/{VialPreview,VialScene,useVialTexture}.js(x)` — lazy three.js procedural vial
- `public/fonts/*.woff2` (+ OFL license) · `scripts/{test-labels,gen-label-previews}.mjs` · `docs/labels/previews/*.svg` (13 samples)

## 4. Files modified
`src/App.jsx` (routes `/admin/labels`, `/v/:code`; exact-match fix so `/verify-lot` keeps site chrome),
`src/pages/VerifyLot.jsx` (code-verification view), `vite.config.js` (`vendor-three` chunk), `package.json`
(three, @react-three/fiber, `test:labels`).

## 5. Schema changes
Migration `0018` only (validated on fresh Postgres 16, idempotent re-run). No changes to existing tables.

## 6. Dependencies added
`three@0.185`, `@react-three/fiber@9.6` — both confined to the lazy `vendor-three` chunk (245 KB gzip), loaded
only when an admin opens the studio's 3D view. No barcode/QR deps added (Code 128 hand-rolled + existing `qrcode`).

## 7. Performance
Initial bundle **unchanged**. New chunks: `LabelStudio` 13 KB gzip (admin-only route), `VialScene` 2.6 KB +
`vendor-three` 245 KB gzip (lazy, IntersectionObserver-gated, `frameloop="demand"`, textures 2048 px desktop /
1024 px mobile, full dispose on unmount, context-loss handled, reduced-motion + no-WebGL static fallbacks).

## 8. Security
Admin enforced server-side on every labels endpoint; `label_configs` has **no public RLS policy** — the only
public read is `/api/verify` (rate-limited, whitelisted fields, non-sequential 65-bit codes, uppercase-canonical).
History + `audit_logs` record every mutation. No secrets client-side; CSP unchanged.

## 9. Missing product information (requires owner input — never fabricated)
1. **Verified storage conditions per product** — the seeded blanket −20 °C is treated as UNVERIFIED; labels print a safe placeholder until per-product documentation is confirmed
2. **Real lot numbers / packaged / expiration-or-retest dates** per batch
3. **GLOW / KLOW per-component quantities** — absent from the catalog; labels render "Composition: pending administrative input"
4. Retatrutide / Tirzepatide are **not in the catalog** (compliance-gated) — no labels until added
5. Cap-color preference per product family
6. Printer/label-stock confirmation of final die sizes (see LABEL_PRINT_SPECS)
7. Production domain confirmation for QR base URL (defaults `www.noirpeptides.com`)
8. A drawn logo mark, if desired (text wordmark used meanwhile)

## 10. Approval checkpoints
- **Checkpoint 1 (NOW):** four directions + sample products + studio + 3D prototype on the Vercel **preview** URL (`/admin/labels`). No merge to main until approved.
- Checkpoint 2: apply chosen direction to the sample set → approve
- Checkpoint 3: 3D prototype sign-off (perf/mobile) → approve
- Checkpoint 4: full catalog rollout matrix → approve
- Checkpoint 5: customer-facing PDP/shop integration + production verification links
