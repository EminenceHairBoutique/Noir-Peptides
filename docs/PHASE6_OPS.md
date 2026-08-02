# Phase 6 — Production operations & conversion

_First-party error monitoring, GA4 commerce events, E2E purchase journeys,
and a recently-viewed strip. No third-party monitoring accounts required._

## 1. First-party error monitoring

Production JS errors now reach the Control Room instead of dying in customers'
consoles.

- **Capture** — `src/lib/errorReporter.js` wires `window` errors, unhandled
  promise rejections, and React `ErrorBoundary` crashes. Browser noise
  (cross-origin "Script error.", ResizeObserver warnings, connectivity
  failures, stale-deploy chunk errors) is filtered; a session cap + dedupe
  keep it polite. Dev builds never report.
- **Sink** — `POST /api/client-error`: rate-limited (10/min/IP), every field
  length-capped, fingerprint computed **server-side**; repeats within 24h
  collapse into one row (`hits++`). Writes with the service role — the
  `client_errors` table (migration **0025**, admin-only RLS, no INSERT
  policy) accepts no direct client traffic.
- **Review** — Control Room → **Errors** tab: grouped errors with source
  badge, path, hit count, expandable stack, resolve/reopen. The Overview
  grid shows an open-errors count.

> **Go-live:** run `supabase/migrations/0025_client_errors.sql` in the
> Supabase SQL editor (validated against a fresh Postgres 16 with all 25
> migrations in order; idempotent).

## 2. GA4 / Meta commerce events

The provider registry in `src/utils/track.js` already gated everything on
env + consent; Phase 6 completes the canonical funnel:

| Event | Fires from |
| --- | --- |
| `view_item` | PDP, per product+variant view |
| `add_to_cart` | `CartContext.addToCart` (every add path) |
| `search` | Shop search box, debounced 900 ms, min 2 chars |
| `begin_checkout` | Checkout (existing) |
| `purchase` | Success page (existing, session-deduped) |

Nothing fires until `VITE_GA_MEASUREMENT_ID` (analytics consent) or
`VITE_META_PIXEL_ID` (marketing consent) is set — switch on by env alone.

## 3. E2E purchase journeys

`tests/e2e/shopper-journey.spec.js` (runs against the built `dist/` via
`vite preview`, no backend needed): age-gate dismiss, shop grid → PDP,
add-to-cart drawer + cart persistence across reload (`np_cart`), search
narrowing, bad-URL 404 + recovery, recently-viewed strip. Payment stays
covered by the server-gate spec (needs `E2E_API_URL`).

Sandboxed/CI images that ship their own Chromium can point the suite at it
with `PLAYWRIGHT_CHROMIUM_PATH=/path/to/chrome npx playwright test`.

## 4. Recently viewed

Device-local only (`np_recently_viewed` in localStorage, max 8 slugs —
nothing leaves the browser, no tracking table). PDPs record on view and
render up to 4 previously viewed products below the related-products row,
resolved through the catalog layer (works even on static fallback).
