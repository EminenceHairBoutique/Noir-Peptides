# Phase 0 — Repo Recon: Eminence Hair Boutique

> **Status:** Mapping only — no feature code written. Confirm plan before implementation.

---

## 1. Repo Map

### Routing Entry File

- **`src/App.jsx`** — single routing root, uses React Router v7 `<Routes>` + `<Route>`.
  All routes are defined in a flat array, lazy-loaded via `React.lazy`, wrapped in `<Suspense>` + Framer Motion page transition (`opacity 0→1, y 12→0, 0.35s easeOut`).
  Additional redirect-only `<Route>` entries sit below the array for backwards compat.

---

### Route Table

| Path | Component | Notes |
|---|---|---|
| `/` | `Home` | Landing page |
| `/start-here` | `StartHere` | Onboarding/FAQ |
| `/ready-to-ship` | `ReadyToShip` | In-stock listings |
| `/shop` | `Shop` | Main shop |
| `/shop/wigs` | `Shop` | |
| `/shop/bundles` | `Shop` | |
| `/shop/closures` | `Shop` | |
| `/shop/medical` | `Shop` | |
| `/products/:slug` | `ProductDetail` | |
| `/gallery` | `Gallery` | |
| `/collections` | `Collections` | |
| `/collections/:slug` | `CollectionDetail` | |
| **`/partners`** | **`PartnerProgram`** | Public partner info + application form |
| **`/partner-portal`** | **`PartnerRoute → PartnerPortal`** | Gated: approved partners only |
| `/partners/portal` | `PartnerRoute → PartnerPortal` | Alias for `/partner-portal` |
| **`/admin/partners`** | **`AdminPartners`** | Admin partner approvals UI (no extra auth guard in router; auth enforced via `ADMIN_EMAILS` allowlist server-side) |
| `/checkout` | `Checkout` | Cart → Stripe redirect |
| `/success` | `Success` | Post-Stripe success |
| `/cancel` | `Cancel` | Post-Stripe cancel |
| `/account` | `Account` | Auth (sign in / profile) |
| `/about` | `About` | |
| `/medical-hair` | `MedicalHair` | |
| `/faqs` | `Faqs` | |
| `/contact` | `Contact` | |
| `/custom-orders` | `CustomOrders` | |
| `/custom-atelier` | `CustomAtelier` | |
| `/custom-wig` | `CustomAtelier` | alias |
| `/custom` | `CustomOrders` | backwards compat alias |
| `/private-consult` | `PrivateConsult` | |
| `/consultation` | `Consultation` | |
| `/authenticity` | `Authenticity` | |
| `/care` | `Care` | |
| `/privacy` | `Privacy` | |
| `/privacy-choices` | `PrivacyChoices` | |
| `/terms` | `Terms` | |
| `/returns` | `Returns` | |
| `/cart` | `Cart` | |
| `/verify` | `Verify` | |
| `*` | `NotFound` | 404 fallback |
| `/checkout/success` | Redirect → `/success` | |
| `/order-confirmation` | Redirect → `/success` | |
| `/medical` | Redirect → `/medical-hair` | |

---

### Partner Program — `src/pages/PartnerProgram.jsx`

- **Route:** `/partners`
- Public page with brand hero (`PageHero`) + wholesale/distributor info.
- Contains an application form (`<form>` using local state) that POSTs to `/api/partners/apply`.
- Detects existing approved partners (`user.accountTier === "partner"` etc.) and shows a portal link instead.
- Uses `supabase` (client) for current user session; does NOT directly query `partner_applications`.

---

### Partner Portal — `src/pages/PartnerPortal.jsx`

- **Routes:** `/partner-portal` and `/partners/portal`
- Wrapped by `<PartnerRoute>` (see below) — redirects unapproved users to `/partners`.
- Shows wholesale price calculator (quantity × discount tiers), product catalogue with `WHOLESALE_DISCOUNTS` (`tier5`: 20%, `tier10`: 30%).
- Does NOT hit any API on its own — all data is from the static product catalogue (`src/data/products`).

---

### Partner Route Guard — `src/components/PartnerRoute.jsx`

- Checks `user.accountTier` and `user.partnerStatus` from `UserContext`.
- Approved if: `accountTier` is `"partner"`, `"wholesale"`, or starts with `"partner_"`; OR `partnerStatus` is `"approved"` or `"active"`.
- Unauthenticated → redirect `/account`. Not approved → redirect `/partners`.

---

### Admin Partner Approvals — `src/pages/AdminPartners.jsx`

- **Route:** `/admin/partners`
- **No client-side admin guard** — the route is open in the router; security is enforced only server-side via `ADMIN_EMAILS` env var.
- Fetches applications from `GET /api/admin/partner-applications` (Bearer token required).
- Posts approvals/rejections to `POST /api/admin/partner-application-update`.
- Displays each application with: name, status badge, email, business details, tier select dropdown, approve/reject/set-pending buttons.
- Key sub-component: `ApplicationRow` (inline in same file).

---

### API Endpoints — Partners

| File | Method | Path | Purpose |
|---|---|---|---|
| `api/partners/apply.js` | POST | `/api/partners/apply` | Submit partner application; upserts `partner_applications` table; updates `profiles`; sends concierge email |
| `api/admin/partner-applications.js` | GET | `/api/admin/partner-applications` | List all applications (admin only, `ADMIN_EMAILS` allowlist). Attempts joined select with `profiles`; falls back to plain select |
| `api/admin/partner-application-update.js` | POST | `/api/admin/partner-application-update` | Approve/reject/pending an application; updates `partner_applications.status` + `profiles.account_tier` / `partner_status` / `partner_tier` |

---

### Checkout Flow

- **Entry:** `src/pages/Checkout.jsx` at route `/checkout`
- Uses `useCart()` (items, total) and `useUser()` (user id + email for Stripe metadata).
- On "Continue to Payment" click: saves `eminence_checkout_snapshot` to `localStorage`, fires GA4/Meta `trackBeginCheckout`, POSTs to `/api/create-checkout-session`.
- **Stripe session endpoint:** `api/create-checkout-session.js`
  - Accepts `{ items, userId, customerEmail }`.
  - Looks up product from `src/data/products.js` by `id` or `slug`.
  - Calls `applyCustomPricing` from `src/utils/pricing.js` (wigs only).
  - Creates Stripe `checkout.sessions` with `mode: "payment"`, `allow_promotion_codes: true`.
  - Returns `{ url }` → `window.location.assign(url)`.
- Post-checkout: `/success` (reads `session_id` from query param), `/cancel`.

---

### Supabase Configuration

| File | Role | Client Type |
|---|---|---|
| `src/lib/supabaseClient.js` | Browser client | Anon key (`VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`) |
| `lib/supabaseServer.js` | Server/API client | Service role (`VITE_SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`) |

**How profiles are queried/updated:**

- `UserContext.jsx` → `fetchAccountAccess(userId)`: `supabase.from("profiles").select("account_tier, partner_status, partner_tier").eq("id", userId).maybeSingle()`
- `api/partners/apply.js` → on apply: `supabaseServer.from("profiles").update({ partner_status: "pending", account_tier: "partner_pending" }).eq("id", user.id)`
- `api/admin/partner-application-update.js` → on approve: upserts profile row then sets `{ account_tier: "partner", partner_status: "approved", partner_tier }` (or `customer`/`partner_pending` on reject/pending)

---

### SQL Migrations

- `SUPABASE_PARTNERS.sql` — creates `partner_applications` table
- `SUPABASE_PARTNERS_APPROVAL.sql` — adds `partner_tier`, `reviewed_by`, `reviewed_at`, `notes` columns + `profiles` partner columns
- `SUPABASE_LOYALTY.sql` — loyalty points table
- `SUPABASE_SMS_SIGNUPS.sql` — SMS opt-in table

---

### Other API Endpoints

| File | Path | Purpose |
|---|---|---|
| `api/concierge.js` | `/api/concierge` | Concierge request emails (Resend) |
| `api/subscribe.js` | `/api/subscribe` | Newsletter signup |
| `api/sms-start.js` | `/api/sms-start` | Twilio SMS opt-in (send OTP) |
| `api/sms-verify.js` | `/api/sms-verify` | Twilio SMS OTP verification |
| `api/stripe-webhook.js` | `/api/stripe-webhook` | Stripe webhook handler |
| `api/atelier/signed-upload.js` | `/api/atelier/signed-upload` | Supabase Storage signed URLs for atelier uploads |

---

## 2. Summary of Findings

### Design System / Aesthetic Constraints

- **Typography:** `Playfair Display` (headers/display), `Poppins` (body), `Allura` (cursive accent). Configured in `tailwind.config.js`.
- **Palette:** `ivory` (`#FAF8F5`), `gold` (`#D4AF37`), `charcoal` (`#1B1B1B`), `softGray` (`#EAE8E3`). Background pattern: `radial-gradient(ellipse_at_top, #FBF5EC, #F4EBDF, #F7F1E7)`.
- **Components:** Rounded pill buttons (`rounded-full`), card panels (`rounded-3xl`, `backdrop-blur-xl`, white/60 glass), micro-text at `text-[11px] tracking-[0.26em] uppercase`.
- **Animations:** Framer Motion page transitions (all routes), no custom animation library.
- **No external component library** — UI is bespoke Tailwind + Lucide icons. A small `src/components/ui/button.jsx` helper exists.
- **Deployment:** Vercel (vite + serverless functions in `api/`). `vercel.json` routes `/api/*` to serverless, everything else to `index.html`.

### Important Limitations / Notes

- **⚠️ Security: `/admin/partners` has no client-side auth guard** — any user can load the page URL; server-side enforcement via `ADMIN_EMAILS` prevents actual data access, but the UI shell is exposed to anyone. **Recommended fix:** add a client-side admin check (e.g. a `useIsAdmin()` hook or an `AdminRoute` guard component) so unauthorized visitors see a redirect or "Access denied" message before any API calls fire.
- **⚠️ Security: `PartnerPortal.jsx` enforced only client-side** — `PartnerRoute` checks `UserContext` (browser state) but issues no server-side token verification at render time. A user who manipulates local state or crafts a direct fetch with a valid JWT could bypass the client guard. **Recommended fix:** any sensitive wholesale pricing data or partner-only resources fetched by `PartnerPortal` should be served from a gated API endpoint that re-validates the JWT and profile tier server-side (via `supabaseServer.auth.getUser(token)` + `profiles` check).
- **`eslint-env` comments in API files** will become hard errors in ESLint v10 (currently warnings). Not blocking now.
- **Existing lint errors** (pre-existing, unrelated to partner flow): `lib/email.js` has `no-useless-escape`, `no-unused-vars`, `no-undef`; `api/stripe-webhook.js` has `no-unused-vars`.
- **`profiles` table partner columns** may not exist if `SUPABASE_PARTNERS_APPROVAL.sql` hasn't been run — all API handlers fall back gracefully with `console.warn`.

---

## 3. Recommended Next Steps (Safe + Incremental)

1. **Run the SQL migrations** (`SUPABASE_PARTNERS.sql` then `SUPABASE_PARTNERS_APPROVAL.sql`) in Supabase if not already done.
2. **Set `ADMIN_EMAILS`** environment variable in Vercel. Optionally add a client-side guard in `AdminPartners.jsx` for better UX (show "Access denied" instead of hitting the API and getting a 403).
3. **Partner application flow** is complete end-to-end (form → `/api/partners/apply` → DB upsert + email + profile update). Validate that `sendConciergeRequestEmail` is wired to a working Resend API key.
4. **Admin approval flow** is complete (list → approve/reject → profile update). Validate with a real test application.
5. **Checkout** is complete (cart → Stripe session → redirect). Ensure `STRIPE_SECRET_KEY` and webhook secret are set in Vercel.
6. **No feature code changes needed** for Phase 0. This document is the deliverable.
