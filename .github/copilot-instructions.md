# Copilot Instructions for Noir Peptides

## Project Overview

Noir Peptides is a **research-use-only (RUO)** e-commerce SPA for batch-documented
peptide reference materials. The stack is **React 19 + Vite + JavaScript +
Tailwind v4**, deployed on **Vercel** with Node.js serverless API functions in
`/api`. Data + auth are **Supabase**; payments are **Stripe**; transactional
email is **Resend**; AI features use the **Anthropic API** (server-side only).

> **Compliance is the first constraint.** Everything is for laboratory research
> use only — not for human or veterinary use. Never add human-use, dosing,
> administration, cycling, or disease-treatment language anywhere (copy, product
> data, AI output, schema). AI endpoints must refuse such requests.

## What is public and what is gated (do not regress)

The **catalog is public**: product, variant, category and published-certificate
rows are readable without an account (migration `0013`, reconciled in `0024`),
the storefront, `/shop`, product pages, `/test-results` and `/documents` are
crawlable, and nothing may put catalog browsing behind login — that is a hard
rule of the site. What IS gated is identity and commerce: `/account`,
`/checkout`, `/cart`, `/admin`, orders, attestations, loyalty. The real lock is
**Supabase RLS**; the client guards are UX on top of it.

- `src/context/UserContext.jsx` — explicit state machine (`loading → splash`,
  never bounce a logged-in user to `/login` on refresh).
- `src/components/RequireAuth.jsx` / `RequireAdmin.jsx` — route guards for the
  gated surfaces only.
- Attestation: `lib/attestationStatements.js` is the canonical source (8
  statements, confirm phrase, `ATTESTATION_VERSION`); `src/config/attestation.js`
  re-exports it; `api/attestation.js` enforces version + every required ID.
  Purchasing requires a current attestation; browsing does not.

## Architecture map

```
src/
  pages/        # route components (lazy-loaded in App.jsx)
  components/   # UI + guards + SEO + analytics
  context/      # UserContext, CartContext, ToastContext
  lib/          # supabaseClient (anon), catalog (data layer; public reads, static fallback)
  data/         # tier1Catalog.js (catalog source of truth), productSpecs.js,
                # coaSeed.js (mirrored published certificates), research.js
  utils/        # track.js (provider-agnostic analytics), loyalty.js, format, etc.
  config/       # attestation, compliance, brand
api/
  _utils/       # auth (requireUser/requireAdmin), rateLimit, body, validate
  ai/           # research-assistant, coa-analyzer, literature-summarizer,
                # concierge, semantic-search (+ _shared guardrail)
  create-checkout-session.js, stripe-webhook.js, attestation.js, contact.js,
  subscribe.js, partners/**, admin/**
lib/            # supabaseServer (service role), email (Resend), orderNumber,
                # attestationStatements
supabase/migrations/  # 0001..0040 (additive, idempotent; docs/MIGRATIONS_*.md per apply)
```

## Data flow rules

- **Catalog**: client reads via `src/lib/catalog.js` (RLS-gated Supabase); the
  static source of truth is `src/data/tier1Catalog.js` + the `0009` seed. The
  legacy `src/data/products.js` was deleted in opt cycle 9 — do not recreate a
  second catalog file.
- **Pricing is server-trusted**: never price from the client. `price_tiers`
  (volume pricing) is resolved server-side in `create-checkout-session.js`.
- **Auth/z**: route every endpoint through `api/_utils/auth.js`. Admin =
  `profiles.role === 'admin'` (both client and server agree).
- **Validation**: mutating endpoints use `api/_utils/validate.js` (a small
  in-repo validator — no Zod).
- **AI keys are server-only** (no `VITE_` prefix). Missing keys → 503, never crash.

## Conventions

- Env-flag everything not yet wired (Stripe, Supabase, Anthropic, Voyage, OAuth);
  degrade gracefully.
- Migrations are `0004+`, `IF NOT EXISTS`/`do $$…$$` guarded, additive — never
  destructive without explicit approval.
- SEO: only `Product`/`Organization`/`FAQ`/`Article` JSON-LD — never `Drug`.
  Gated routes stay `noindex`; public education lives under `/research`.
- Tailwind design tokens are `se-*` (legacy class-name prefix only — not brand
  text; safe to leave).
- Keep `npm run build` and `npm run lint` green.
