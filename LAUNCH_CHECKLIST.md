# Eminence Hair — Launch Checklist (Vercel + SEO + Conversion)

## 1) Vercel deployment settings
- **Framework Preset:** Vite
- **Build command:** `npm run build`
- **Output directory:** `dist`
- **Node version:** Use the default Vercel Node (or set 20+). (The project works with newer Node versions.)

> Note: This build now runs an extra step after Vite builds to generate:
> - route-specific HTML for major pages + each product URL
> - `sitemap.xml`
> - `robots.txt`

## 2) Environment variables (Vercel → Project → Settings → Environment Variables)
Set these in **Production** (and Preview if desired):

### Required for checkout + API
- `STRIPE_SECRET_KEY` (server)
- `STRIPE_WEBHOOK_SECRET` (server) — if you are using webhooks

### Recommended for order/lead email notifications
- `RESEND_API_KEY` (server)

### Supabase (recommended for newsletter list)
- `VITE_SUPABASE_URL` (public)
- `VITE_SUPABASE_ANON_KEY` (public)
- `SUPABASE_SERVICE_ROLE_KEY` (server)

### SEO + Social previews
- `VITE_SITE_URL` = `https://www.eminenceluxuryhair.com`

### Analytics / pixels (optional)
- `VITE_GA_MEASUREMENT_ID` (GA4)
- `VITE_META_PIXEL_ID` (Meta Pixel)

## 3) Newsletter lead capture (new)
Two places now submit to **`/api/subscribe`**:
- Home page “Private List”
- Discount modal

### Create the Supabase table
Run this SQL in Supabase:

```sql
create table if not exists public.email_signups (
  id uuid primary key default gen_random_uuid(),
  email text not null unique,
  source text,
  path text,
  utm jsonb,
  consent jsonb,
  user_agent text,
  created_at timestamptz not null default now()
);

create index if not exists email_signups_created_at_idx
  on public.email_signups (created_at desc);
```

If you don’t want to store in Supabase yet, the endpoint will still work (and can email you if `RESEND_API_KEY` is set).

## 4) Google indexing
1. Create/verify your property in **Google Search Console**.
2. Submit your sitemap:
   - `https://www.eminenceluxuryhair.com/sitemap.xml`
3. Request indexing for:
   - Homepage
   - A few category pages (Collections, Shop)
   - 3–5 product pages

## 5) Social share previews
Test a product URL on:
- Facebook Sharing Debugger
- Twitter/X Card Validator (or equivalent)

Your product pages now have route-specific OG tags (server-delivered), so previews should render correctly.

## 6) Conversion tracking
This build supports:
- GA4 page views (SPA) after consent
- Meta Pixel PageView (SPA) after consent
- Ecommerce events (after consent):
  - ViewContent / `view_item`
  - AddToCart / `add_to_cart`
  - InitiateCheckout / `begin_checkout`
  - Purchase / `purchase` (fired on Success page using a checkout snapshot)

