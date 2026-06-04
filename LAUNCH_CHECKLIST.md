# Noir Peptides — Launch Checklist

Research-use-only (RUO) peptide reference materials. This checklist covers what
an operator must wire before going live. Code is complete where noted; items
below are operator/legal/business actions the code cannot perform.

## 0) Business + legal (do these FIRST — highest risk)

- [ ] **RUO vs. consumer/human-use positioning decision** (the single largest
      risk to this venture). Confirm the research-use-only posture with counsel.
- [ ] **Payment-processor conversation.** Card processors frequently prohibit
      peptide/research-chemical sales for human use and freeze accounts. Confirm
      acceptance with Stripe (or an alternative) BEFORE wiring keys.
- [ ] **Attorney review** of all legal pages (`src/pages/*` legal + `/legal/*`)
      and the 21+ age threshold. Pages are claim-safe templates, not legal advice.

## 1) Vercel deployment

- [ ] Framework: Vite. Build: `npm run build`. Output: `dist`.
- [ ] Set **`VITE_SITE_URL`** to the real production domain (e.g.
      `https://www.noirpeptides.com`). The build THROWS if it is empty or points
      at localhost — so canonicals/OG can never leak a local address.
- [ ] Purchase + connect the domain.

## 2) Supabase

- [ ] Create the project; set `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`,
      `SUPABASE_SERVICE_ROLE_KEY` (service role is server-only).
- [ ] Apply migrations `0001`–`0008` (idempotent; safe in order). `0008` enables
      the `vector` extension for semantic search.
- [ ] Seed the catalog (`products`/`product_categories`) and, optionally,
      `price_tiers` for volume pricing.
- [ ] Configure Google OAuth in Supabase Auth (the client uses
      `signInWithOAuth({ provider: "google" })`).

## 3) Stripe

- [ ] Set `STRIPE_SECRET_KEY` and `STRIPE_WEBHOOK_SECRET`.
- [ ] Add the webhook endpoint `/api/stripe-webhook` (events:
      `checkout.session.completed`). `apiVersion` is pinned in code.
- [ ] Optional: create a US shipping rate and set `STRIPE_US_SHIPPING_RATE_ID`
      (otherwise an inline flat rate is used). Checkout is US-only.

## 4) Email (Resend)

- [ ] Set `RESEND_API_KEY`; verify the sending domain for `@noirpeptides.com`.

## 5) AI (optional — degrades gracefully if unset)

- [ ] Set `ANTHROPIC_API_KEY` to enable the AI suite (research assistant, COA
      analyzer, literature summarizer, concierge). Server-only.
- [ ] Set `VOYAGE_API_KEY` to enable semantic search, then run
      `node scripts/embed-backfill.mjs` to populate embeddings. Without it,
      search degrades to keyword.

## 6) Analytics (prepared, not activated)

- [ ] Set `VITE_GA_MEASUREMENT_ID` / `VITE_META_PIXEL_ID` to switch on GA4 / Meta
      (they only fire with the env var AND user consent). No code change needed.

## 7) Admin

- [ ] Set `ADMIN_EMAILS` to bootstrap the first admin, then flip that user's
      `profiles.role` to `'admin'` (the canonical admin source of truth).

## 8) Pre-launch verification

- [ ] `npm run build` and `npm run lint` are green.
- [ ] `npm run test:e2e` (set `E2E_API_URL` to also exercise the server gates).
- [ ] Logged-out users cannot read product rows; gated routes redirect to
      `/login`; `/research` + `/legal/*` are public and indexable.
- [ ] Confirm `robots.txt` and the canonical/OG URLs use the production domain.
- [ ] Instrument Lighthouse / Core Web Vitals on the deployed build (these are
      post-deploy targets, not in-session guarantees).
