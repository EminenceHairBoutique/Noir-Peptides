# Security Posture — Noir Peptides

## Authentication & authorization
- **Auth wall**: client route guards (`RequireAuth`/`RequireAdmin`) are UX; the
  real lock is Supabase **RLS**. Catalog, COAs, variants, and price tiers are
  `SELECT`-gated on `is_attested()`; orders/loyalty/wishlist/etc. are owner-scoped
  (`user_id = auth.uid()`), admins via `is_admin()`.
- **Admin source of truth**: `profiles.role === 'admin'`, enforced identically on
  the client (`UserContext.isAdmin`) and server (`api/_utils/auth.js#requireAdmin`).
  `ADMIN_EMAILS` remains only as a bootstrap fallback for granting the first admin.
- **Server identity**: checkout/attestation derive the user from the Supabase
  bearer token, never from the request body.

## Payments
- Stripe `apiVersion` is pinned (`2024-06-20`) in both the checkout and webhook.
- Webhook verifies signatures (`constructEvent`, `bodyParser:false`) and is
  idempotent on `stripe_session_id`.
- Pricing is server-trusted (never read from the client). Shipping is US-only.

## Rate limiting
- Distributed limiter backed by the `rate_limits` table (migration 0005),
  applied to checkout, attestation, subscribe, contact, AI, reviews,
  back-in-stock, and partner-application endpoints.
- **Degraded mode (not fail-open):** if the Supabase store is unavailable, the
  limiter falls back to a best-effort **in-memory** limiter per serverless
  instance (`api/_utils/rateLimit.js`), so an infra outage caps abuse instead of
  removing all limits. A request passes only if both the DB path and the
  in-memory backstop allow it.

## Admin surface
- Every `/api/admin/*` endpoint (overview, coa, orders, partner applications)
  calls `requireAdmin` server-side; the client `RequireAdmin` guard is UX only.
- Service-role reads are confined to admin endpoints (never shipped to the
  client). The admin Compliance Scanner endpoint (`/api/ai/compliance-scan`) is
  admin-gated and degrades to regex-only when no model key is present.

## Catalog visibility (by product decision)
- The catalog (products/variants/price-tiers/categories/COAs) is **public-read**
  (migration 0013) so product pages are indexable. This is a deliberate product
  decision — it does NOT weaken commerce: cart→checkout requires auth + a current
  research-use attestation (server-enforced 403), and orders/profiles/
  attestation records remain owner-scoped under RLS. Published COAs only are
  publicly readable (`is_published`); drafts stay admin-only.

## Content-Security-Policy — residual `'unsafe-inline'` (script-src)
`script-src` still allows `'unsafe-inline'`. This is a deliberate, documented
residual:

- The only inline scripts are (a) the static JSON-LD (`application/ld+json`,
  non-executable) emitted by the SEO layer, and (b) the GA4 / Meta Pixel
  bootstrap snippets injected **at runtime** by `TrackingScripts.jsx` (only when
  the corresponding env var **and** user consent are present).
- A static Vercel deployment cannot inject a fresh per-request **nonce** into
  pre-rendered HTML, and the analytics snippets are generated at runtime, so
  hashing them ahead of time is not possible.
- Analytics is **prepared but not activated** (no `VITE_GA_MEASUREMENT_ID` set).
  When GA4 is switched on (Checkpoint 3), migrate the analytics loader to GTM
  with a server-set nonce or to a hashed loader and **remove `'unsafe-inline'`**
  at that time.

Other CSP directives are tight: `object-src 'none'`, `base-uri 'self'`,
`frame-ancestors 'none'`, `form-action 'self'`, `upgrade-insecure-requests`,
and an allowlisted `connect-src` (Supabase, Stripe, analytics).

## Privacy
- Attestation records only IP + user-agent + timestamp (server-derived). **No
  browser fingerprinting** — it would create GDPR/CCPA exposure that works
  against the compliance goal.

## Secrets
- All keys are env-only; `.env*` is gitignored. The Supabase **service-role** key
  and `STRIPE_SECRET_KEY` / `ANTHROPIC_API_KEY` are server-only and never exposed
  to the client bundle (no `VITE_` prefix).
