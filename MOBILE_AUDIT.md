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

## ✅ Resolved: layout shift on the legacy product alias (was "PDP CLS ≈ 1.0")

**This finding was previously reported as an unexplained PDP defect. That was
wrong, and the correction matters: the measurements had been taken against
`/products/bpc-157` — the legacy *plural* alias — not the canonical
`/product/:slug` the site actually links to.** Measured at 390×844 against the
built preview with a real `PerformanceObserver('layout-shift')`:

| Route | CLS before | CLS after |
| --- | --- | --- |
| `/product/bpc-157` (canonical) | **0** | 0 |
| `/products/bpc-157` (legacy alias) | **1.0** | **0** |
| `/shop`, `/`, `/cart`, `/research`, `/verify-lot` | 0 | 0 |

### Root cause

Traced at animation-frame resolution (`footer.getBoundingClientRect()` sampled
every rAF), the boot sequence on the alias path was:

| t | State |
| --- | --- |
| 74ms | first React commit — Navbar is `fixed` (0 layout height) and the routed subtree is empty, so **the Footer paints at `top: 0`, filling the viewport** (doc height 1112 = footer alone) |
| 109ms | the real page mounts; doc height → 2392, footer pushed to `top: 1280`, fully below the fold |
| 113ms | **one shift, `[0,844] → [0,0]`, v = 1.0** (a full-viewport element displaced more than a full viewport, so the score caps at 1.0) |

`/products/:slug` was routed to a bare `<Navigate>` with no page wrapper.
`<Navigate>` renders **no markup at all**, so nothing reserved vertical space
during the redirect frame and the footer was the only thing on screen.

### Fix

Reserve the content area so the footer can never paint inside the viewport:

- `ProductAliasRedirect` now wraps its `<Navigate>` in a `min-h-screen` spacer.
- The shared `Page` wrapper also carries `min-h-screen`, so any route whose lazy
  chunk commits late gets the same floor. It is only a *floor* — pages taller
  than the viewport are unaffected.

Verified: the redirect still resolves (`/products/bpc-157` → `/product/bpc-157`)
and CLS is **0 at 320, 390 and 1280** on both paths. **[VERIFIED]**

### Hypotheses tested and disproven along the way

Recording these because each one looked plausible and cost a measurement:

- **Skeleton height.** Rewriting the PDP skeleton to mirror the real layout left
  CLS unchanged. (The rewrite is kept — it is a better loading state regardless.)
- **A hanging `/api/product-label`.** It returns 500 in ~20ms. Not a hang.
- **The lazy `vendor-three` 3D vial chunk.** Instrumented: **no `<canvas>` ever
  mounted** during the measurement window, so the vial was never involved.
- **The render-blocking Google Fonts stylesheet.** It genuinely stalls this
  sandbox (`ERR_CONNECTION_RESET` after ~12.5s, delaying `DOMContentLoaded` to
  12.6s — which is why the shift appeared to happen "at t≈12.5s"). But aborting
  the request dropped DCL to 91ms **and CLS stayed at 1.0**. It moved *when* the
  shift happened, not *whether*. Worth noting separately: that stylesheet is
  render-blocking with no fallback, so a user behind a slow or blocked Google
  Fonts sees a blank page until it resolves. Not fixed here — flagged below.

### Regression guard

`tests/mobile/layout-audit.spec.js` now asserts **CLS < 0.1** on
`/product/bpc-157`, `/products/bpc-157`, `/shop` and `/`. The same measurement
returned 1.0 before the fix, so the guard demonstrably fails on the regression.

## Production CLS chase — second pass (post-merge)

The alias fix above zeroed CLS *in the sandbox*, but every measurement to that
point shared two blind spots: **fonts never loaded** (the sandbox proxy resets
the browser's `fonts.googleapis.com` connection) and **the label API always
500s** (no backend). Both were closed by fulfilling those requests inside the
harness with real bytes — the actual Google Fonts CSS + woff2 files fetched
via the proxy, and a realistic approved-label payload for
`/api/product-label`.

### Font swap: measured, negligible

With all six faces really loading and swapping (`display=swap`), including a
slow-network simulation (CSS 1.5s, woff2 1s) and 4× CPU throttle:
`/product/bpc-157` 0.0002 · `/shop` 0.0002 · `/` 0–0.0008. The swap does shift
the navbar account link and hero spans, but at 1/500th of the 0.1 budget.
**Font swap is not a CLS problem on this site.** [VERIFIED]

### Late label arrival: the real production CLS — found and fixed

When `/api/product-label` returns an approved label (production behavior the
sandbox's 500 can never show), the PDP media panel swaps from the static image
to the 3D vial preview. That swap measured **CLS 0.06–0.09** — near the 0.1
"good" ceiling before any other real-world shift stacks on top. Three
mechanisms, each fixed:

| Mechanism | Measured | Fix |
| --- | --- | --- |
| Caption `<p>` ("Interactive label preview…") renders in flow only after the response, pushing the info column down ~58px | up to 0.023 | Caption is now an absolute overlay pinned to the panel bottom — out of flow, cannot push anything. `lg`-only: on phones the canvas overflows the square and fills the bottom edge with the bright vial body, leaving no legible ground (verified by screenshot — it was unreadable); desktop has ~110px of empty glass where it reads cleanly |
| VialPreview host was a centered **flex item with no intrinsic width**: it rendered ~2px wide, then snapped to 324px when the scene mounted (`prev[x194,w2] → cur[x33,w324]`) | 0.062 | The wrapper is a plain block (`h-full w-full p-2`), full-width from the first commit |
| `items-center` re-centered the content every time hydration changed its height (skeleton 420 → scene 420 + controls ≈ 470) | (part of above) | Top-pinned: late growth extends into the clipped overflow instead of moving visible content |

**After: CLS = 0.0002** in every scenario (label at 100ms, at 2.5s, user
scrolled mid-page, scrolled deep). The only remaining entry is the navbar
account link growing ~18px on font swap. [VERIFIED]

Visual verification (both states screenshotted): mobile framing *improved* —
the vial cap and full label are now visible (the centered crop cut the cap);
desktop shows the full vial, all controls, and the caption. No copy changed;
the caption text is intact, shown where it is legible.

The spec now includes a **late-label CLS test** that fulfills
`/api/product-label` with a realistic payload after 1.5s and holds the same
&lt;0.1 budget — the scenario the sandbox otherwise cannot produce. 35/35 green.

### Found while chasing, flagged (not fixed): 3D controls clipped on mobile

With a real label, the vial canvas (418px + control row) overflows the 342px
square panel at 390px: the Front/Back/zoom/reset buttons and the auto-rotate
toggle are **fully clipped and unreachable on phones** (drag-rotate on the
canvas still works, so the preview degrades rather than breaks). Desktop shows
everything. Fixing this properly is a design decision — shrink the canvas
responsively, move controls out of the panel, or let the panel grow — each
with tradeoffs; deferred to `MOBILE_ROADMAP.md`. [VERIFIED clipped; behavior
needs confirming against production once an approved label is live]

## Remaining (reported, not fixed this pass)

- **Render-blocking Google Fonts stylesheet** — `index.html` loads three
  families via a plain `rel="stylesheet"` with no fallback. If Google Fonts is
  slow or unreachable (corporate proxy, restrictive network), first paint is
  blocked until it fails. Observed directly in this sandbox: 12.6s to
  `DOMContentLoaded`. It does **not** cause layout shift (proven above), but it
  is a real first-paint risk. Fix would be `media="print" onload` async loading
  or self-hosting the faces. Out of scope for a layout pass — logged for the
  performance workstream. **[VERIFIED as measured here; production impact SUSPECTED]**

- **Sub-44px tap targets — RAISED (third pass).** Primary navigation now has
  ≥44px hit boxes via padding + negative-margin expansion (hit area grows, layout
  pixel-identical, verified by measuring the strip row height before/after):
  category tabs 17→45px, navbar wordmark 15→45px, guest "Log In" 17→45px, PDP
  breadcrumb and category overline →45px, footer bottom legal row →45px. Footer
  link columns take a different, deliberate shape: the `space-y-3` gaps became
  the links' own padding — same 32px visual pitch, full-column-width hit boxes,
  **no overlapping targets** (a first attempt with negative margins collided
  with the sibling margins and was caught by a geometry check, then replaced).
  True 44px there would double the footer's height for tertiary links.
  Still reported, deliberately exempt: in-sentence prose links (cookie banner,
  PDP copy — WCAG 2.5.8's inline exception) and the cart item title link (dense
  row; the row's controls are already ≥44px). **[VERIFIED]**
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
