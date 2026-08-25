# Noir Peptides — Mobile Enhancement Roadmap

_Stage 9 proposals, ranked by impact-to-effort. These are upgrades beyond the
defect fixes in `MOBILE_AUDIT.md`. Effort: S (<½ day) · M (1–3 days) · L (week+).
"Before launch?" reflects that nearly all traffic here is phone traffic._

## Do before launch

| # | Enhancement | Why it fits this audience | Effort | Before launch? |
| --- | --- | --- | --- | --- |
| 1 | ~~**Sticky add-to-cart bar on the PDP**~~ — **✅ BUILT this pass** (`src/components/StickyBuyBar.jsx`). variant · price · Add to Cart; appears once the inline CTA scrolls out of view (IntersectionObserver), `env(safe-area-inset-bottom)` padding, hidden while the cart drawer is open, `md:hidden` so desktop is untouched, `aria-hidden`+`tabIndex -1` while off. Out-of-stock variants show "Notify Me" → scrolls to the restock form. Verified: hidden when inline CTA visible, shown otherwise; 0 overflow regression | The PDP is long on mobile; the buy action stranded at the top. Biggest mobile conversion lever | M | **Done** |
| 2 | ~~**Filter/sort as a bottom sheet**~~ — **✅ BUILT this pass.** New accessible primitive `src/components/ui/BottomSheet.jsx` (role=dialog, aria-modal, focus trap, initial focus, focus restore, Escape, `#root` inert, body-scroll lock, safe-area) — the reusable scaffold the sequencing note called for. On mobile the "Filters" button opens the sheet with the same facets; desktop keeps the inline panel. Verified at 320px: aria-modal, labelled, focus trapped inside, `#root` inert, "Show results" footer | Native mobile pattern; gives facets real room | M | **Done** |
| 3 | ~~**Raise primary tap targets to 44px**~~ — **✅ DONE (third pass).** Facet chips, sheet close, sort select (pass 2); category tabs, navbar wordmark, guest Log In, PDP breadcrumb + overline, footer legal row all ≥44px hit boxes via padding+negative-margin (layout unchanged); footer columns get full-width 32px boxes with the gap folded into padding. In-sentence prose links and the cart title link stay exempt (WCAG inline exception / dense row) | mis-taps on the category nav are the likeliest daily friction | S | **Done** |
| 4 | **Skeleton loading states** — **mostly already existed; improved this pass.** The catalog grid skeleton was already correct (**measured CLS = 0**). The PDP skeleton was a short centered block and now mirrors the real page structure; `se-skeleton` shimmer now respects `prefers-reduced-motion`. The shift previously logged here as an open PDP defect was **traced and fixed**: it was the legacy `/products/:slug` alias rendering a bare `<Navigate>`, letting the footer paint at the top of the viewport for one frame. CLS is now **0** on every route measured, with a `CLS < 0.1` regression guard in the spec. See MOBILE_AUDIT.md | Grid was fine; PDP loading state was thin | S | **Done** |
| 5 | ~~**1-column card layout ≤359px**~~ — **✅ DONE (fourth pass).** `max-[359px]:grid-cols-1` on every ProductCard grid *and its mirroring skeleton* (Shop ×2, PDP related ×2, RecentlyViewed) — skeletons must match the real grid or the CLS guard fails. Verified: 1 col at 320, 2 at 360; full-width card breathes | Removes the last title-clamp on the longest names and gives price/COA full width on the smallest phones | S | **Done** |

## Do soon after launch

| # | Enhancement | Why | Effort | Before launch? |
| --- | --- | --- | --- | --- |
| 6 | ~~**QR-scan entry to lot verification**~~ — **✅ DONE (fifth pass).** "Scan vial QR" on `/verify-lot` opens a BottomSheet scanner: native `BarcodeDetector` where available, lazy-loaded `jsQR` over canvas frames elsewhere, photo-capture fallback when the camera is denied/absent (works on every phone), manual lot form always behind it. Decoding is on-device; a scanned QR yields only a Crockford-validated code (`src/lib/qrScanParse.js`, 71 unit assertions) — never a navigation target. E2E: generated QR PNG → decode → `/v/<code>`; foreign QR rejected; dialog a11y + focus restore | The single most mobile-native feature this business could have: scan the vial in hand, land on its certificate. A genuine differentiator (the benchmark competitor is web-only) | M | **Done** |
| 7 | ~~**PWA shell**~~ — **✅ DONE (sixth pass).** Installable manifest (192/512 + maskable PNGs rasterized from the favicon vial glyph by `scripts/generate-pwa-icons.mjs`, pure Node), real `apple-touch-icon.png` + iOS standalone metas, and a hand-rolled `public/sw.js` (no new deps): network-first navigations with cached-shell fallback, precache of every <300KB chunk (~1MB, injected at build by `generate-sw-precache.mjs`; the 427KB PDF and 892KB three.js vendors runtime-cache on first use), cache-first hashed assets, SWR for fonts/images, **`/api/*` and non-font cross-origin never touched**. CSP `worker-src` gained `'self'`; `/sw.js` served no-cache. E2E: manifest installability, SW registration+precache, and airplane-mode `/shop` rendering the full catalog from the cached shell | Returning research buyers reorder; an installed icon + instant shell is high-retention, low-risk | M | **Done** |
| 8 | ~~**Bottom navigation**~~ — **✅ DONE (seventh pass).** `src/components/BottomNav.jsx`: Catalog · Verify · Account (→ /login when signed out) · Cart (opens the drawer, live count badge, `aria-expanded`). `md:hidden`, safe-area padded, fixed (zero CLS) with an in-flow spacer so the footer stays reachable; **absent on the PDP** (the sticky buy bar owns that edge) and on bare auth/checkout chrome; blurs with the rest of the page when the cart is open; cookie banner stacks above it. Tabs 98×52. Top chrome intentionally left as-is — removing top links is a separate design call. 5 e2e tests | Frees the crowded top chrome and puts core destinations in thumb reach | M | **Done** |
| 8b | ~~**Unclip the 3D vial controls on mobile**~~ — **✅ DONE (fourth pass).** Canvas height is now `min(420px, 85vw - 60px)` (VialScene + both VialPreview skeletons, kept identical to avoid reintroducing the hydration shift). At 390px the canvas is 270px and the **whole vial plus Front/Back/zoom/reset controls fit inside the panel, fully tappable**; ≥~565px it is exactly 420px — desktop unchanged (verified 1280). Late-label CLS still 0.0002 | The interactive preview is a differentiator; its controls should exist on the device most buyers use | S | **Done** |
| 9 | **Swipe gallery** on the PDP media / 3D vial | Natural touch interaction; the media column already supports multiple views | S | Soon |

## Later / evaluate

| # | Enhancement | Why | Effort |
| --- | --- | --- | --- |
| 10 | **Haptics** on add-to-cart and successful lot verification (`navigator.vibrate`, progressive) | Small delight on confirmations; trivial and guarded | S |
| 11 | **Pull-to-refresh** on the catalog | Familiar gesture; only worth it if catalog data becomes more dynamic | S |
| 12 | **Reduced-motion pass** on catalog card entrance staggering | If cards animate on scroll, honor `prefers-reduced-motion`; audit before adding more motion | S |

## Sequencing note

Items 1–4 are the launch set and share infrastructure: the bottom sheet (#2) and
sticky bar (#1) both want one accessible, safe-area-aware sheet/dialog primitive.
Build that primitive once, then #1, #2, and any future mobile modal reuse it —
that's the highest-leverage first move.
