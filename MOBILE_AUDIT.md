# Noir Peptides — Mobile UI/UX Audit & Remediation

_Vision-driven pass. Every fix below was **verified** by re-screenshotting the
built preview at the failing width and by the `tests/mobile/layout-audit.spec.js`
collision guard (24/24 green). Findings I could not fully remediate this pass are
marked and carried to "Remaining"._

## How this was run

- Built `dist/`, served with `vite preview`, screenshotted at **320 / 360 / 390 /
  768 / 1280** via the pre-provisioned Chromium.
- Wrote a DOM collision guard (`tests/mobile/layout-audit.spec.js` +
  `playwright.mobile.config.js`) that, at 320/360/390 on `/shop`, a PDP, `/cart`,
  and `/`, fails on horizontal overflow or any element exceeding the viewport
  (scrollers excluded by computed `overflow-x`), and **reports** every tap target
  under 44×44.
- Screenshots are in `.mobile-audit/` (scratch, uncommitted): `top_320.png`
  (navbar+toolbar, after), `shop_320.png` (cards, after), `desktop_1280.png`
  (no-regression proof).

## Confirmed defects — status

| # | Defect | Root cause | Fix | Verified |
| --- | --- | --- | --- | --- |
| 1 | **Price / COA collision** on cards (`FROM $44` overlapping a two-line `COA ON REQUEST`) | `justify-between` row with no wrap; at 320px the two blocks couldn't both fit | `ProductCard`: `flex-wrap` + `shrink-0` + `whitespace-nowrap` so COA drops to its own line cleanly | ✅ `shop_320.png` — separate lines, no overlap |
| 2 | **Title truncated mid-word** (`TB-500 (Thymosin…`) | `line-clamp-1` cut the compound identifier itself | `line-clamp-2` + `min-h-[2.5em]` (even rows) + `title={name}` for the full value | ✅ improved — "TB-500" now gets a full first line; parenthetical clamps on line 2, full name in `title` |
| 3 | **Badge crowding** (`≥ 99% PURE` / `IN STOCK` flush, meeting mid-card at 320) | 0.16em tracking + padding too wide for a ~150px card | `index.css`: `@media (max-width:400px)` relaxes badge tracking to 0.08em and tightens padding; `white-space:nowrap` | ✅ no collision at 320 |
| 4 | **RUO banner wraps awkwardly**, orphaning "USE" | 0.25em tracking on a long line at 320px | `Navbar`: `tracking-[0.1em] sm:tracking-[0.25em]` + `[text-wrap:balance]` + horizontal padding | ✅ `top_320.png` — two balanced lines, no orphan |
| 5 | **Raw Postgres error in Label Studio** | admin endpoints returned `err.message` | **Already fixed** in prior audit work (PR #13 friendly 409s + `failSafely` sanitization). Studio surfaces the designed message, not the FK string. Styling of the admin error banner is a minor follow-up (Remaining) | ✅ (verified in code; admin-only) |

## Additional defects found this pass

| # | Defect | Width | Root cause | Fix | Verified |
| --- | --- | --- | --- | --- | --- |
| A | **Logged-out navbar overflow** — wordmark + "LOG IN" collided, "CREATE ACCOUNT" clipped off-screen | ≤360 | three inline elements can't fit; `hidden` on the CTA was defeated by `btn-primary`'s `display:inline-flex` | responsive wordmark tracking/size; guest actions `shrink-0`/no-wrap; CTA wrapped in a `<span className="hidden sm:inline-flex">` so `hidden` actually applies (both auth paths still reachable — Log In → /login links to register) | ✅ `top_320.png`; ✅ CTA restored at desktop (`desktop_1280.png`) |
| B | **Filter/sort toolbar collision** — "FILTERS"+"COMPARE" ran together as "FILTERSCOMP", "FEATURED" clipped | ≤390 | non-wrapping flex row of three fixed-width controls | `Shop`: `flex-wrap`; buttons `shrink-0`/no-wrap with `py-2.5` (≥44px tap height); sort select `w-full sm:w-auto` (own line on mobile) | ✅ `top_320.png` — two buttons split, sort on its own line |
| C | **Review star-picker overflow** on PDP | 320 | inline-flex star row exceeded viewport | `flex-wrap max-w-full` + `shrink` on the star buttons | ✅ collision guard now green on the PDP |

## Regression safety

- **No desktop regression:** `desktop_1280.png` shows the full CTA, single-line
  RUO banner, and inline toolbar all restored — every mobile fix is gated behind
  `sm:` breakpoints or `max-width` media queries, or is `flex-wrap` that only
  wraps when space is tight. **[VERIFIED]**
- **Collision guard: 24/24 green** at 320/360/390 across `/shop`, PDP, `/cart`, `/`.
- Lint 0 errors; 15 existing unit suites still pass; build 73 routes.

## Stage 5 — chrome / safe areas (verified in code)

- `viewport-fit=cover` set; `theme-color` matches the dark UI (`#05080f`).
- Added `env(safe-area-inset-top)` padding to the fixed header so the announcement
  bar clears the notch/Dynamic Island. Cookie banner already respects
  `safe-area-inset-bottom`.
- `min-h-screen` is a *minimum* (content still scrolls), so the iOS `100vh`
  collapse is cosmetically minor here; no fixed `h-screen` full-viewport traps
  were found. Left unchanged to avoid churn. [SUSPECTED low-impact]

## ⚠ Open finding: PDP layout shift (CLS ≈ 1.0) — **root cause NOT identified**

Measured with a real `PerformanceObserver('layout-shift')` at 390px against the
built preview:

| Route | CLS | Verdict |
| --- | --- | --- |
| `/shop` | **0** | good — the skeleton grid matches the real card grid exactly |
| `/products/bpc-157` | **~1.0** | **poor** (10× the 0.1 threshold) |

The PDP records a **single** shift, `v=1.0`, at **t≈12.5s**, sourced to
`FOOTER.bg-se-charcoal`. What I established and what I did **not**:

- **Ruled out — skeleton height.** I rewrote the PDP loading skeleton to mirror
  the real page structure (media + buy column + below-fold bands) instead of a
  short centered block. CLS was **unchanged**, so the short skeleton was not the
  cause. The rewrite is kept anyway: it is a strictly better loading state.
- **Ruled out — API hang.** I suspected the backend-less preview left
  `/api/product-label` hanging until timeout. Measured: it returns **500 in
  20ms**. Not the trigger.
- **Not established.** What actually changes layout at ~12.5s. Leading
  suspects, untested: the lazy `vendor-three` chunk (913 KB) initializing the 3D
  vial and resizing its container, or a late image/font settling. The
  `prev=0→cur=0` rects in the shift record are also unexplained.

**This needs production verification before it is treated as a real user-facing
defect** — the sandbox has no Supabase and no serverless functions, so the load
sequence here is not representative. If it reproduces in production, the next
step is to bisect by disabling the 3D vial on the PDP and re-measuring.
**[VERIFIED as measured; root cause SUSPECTED only]**

## Remaining (reported, not fixed this pass)

- **Sub-44px tap targets** — the guard reports ~16–18 per catalog view, almost all
  **inline text links** (category tabs at ~17px tall, footer links, breadcrumbs,
  the sort `<select>` at 43px). These are a spacing/hit-area design decision, not
  broken layout; raising them touches shared link styling site-wide and is better
  done deliberately. The spec logs the full list every run so a *new* undersized
  control is caught. **[REPORTED]**
- **Title clamp on the longest names** — `title` attr exposes the full value, but
  the very longest names still ellipsis on line 2 at 320px in the 2-col grid.
  Acceptable; a 1-col layout ≤359px (see `MOBILE_ROADMAP.md`) would remove it.
- **Label Studio error banner styling** — the message is now safe/human-readable;
  its visual treatment (unstyled red text) is a minor admin-only polish item.
- **Lighthouse / CLS / INP (Stage 7)** — not measured; the sandbox can't run a
  throttled Lighthouse against the deployment. Needs a real device or CI Lighthouse.
- **200% dynamic-type + landscape** — spot-checked via the width matrix; not
  exhaustively screenshotted. [SUSPECTED ok — layouts are flex/clamp-based]

## Enhancement shipped this pass (beyond defects)

- **Sticky add-to-cart bar on the PDP** (`src/components/StickyBuyBar.jsx`,
  `MOBILE_ROADMAP` #1). Mobile-only; surfaces variant · price · Add to Cart once
  the inline CTA scrolls out of view; safe-area padded; hidden while the cart
  drawer is open; out-of-stock → "Notify Me" that scrolls to the restock form.
  **[VERIFIED]** — renders correctly at 390px (`.mobile-audit/pdp_scrolled_390.png`),
  hides when the inline CTA is in view (`aria-hidden` toggles), no overflow
  regression, desktop untouched (`md:hidden`).

- **Filter/sort bottom sheet + accessible primitive** (`src/components/ui/BottomSheet.jsx`,
  `MOBILE_ROADMAP` #2/#3). On mobile the "Filters" button opens an accessible
  bottom sheet (role=dialog, aria-modal, focus trap, initial focus, focus
  restore, Escape, `#root` inert, body-scroll lock, safe-area) holding the same
  facets; desktop keeps the inline panel. Facet chips, the close button, and the
  sort select are now ≥44px. **[VERIFIED]** at 320px
  (`.mobile-audit/filter_sheet_320.png`) — dialog attributes correct, focus
  trapped inside, `#root` inert, "Show results" footer.

## Files changed (uncommitted, for review)

`src/components/ProductCard.jsx` · `src/components/Navbar.jsx` ·
`src/components/ProductReviews.jsx` · `src/components/StickyBuyBar.jsx` (new) ·
`src/components/ui/BottomSheet.jsx` (new) · `src/pages/ProductDetail.jsx` ·
`src/pages/Shop.jsx` · `src/index.css` ·
`tests/mobile/layout-audit.spec.js` (new) · `playwright.mobile.config.js` (new)
