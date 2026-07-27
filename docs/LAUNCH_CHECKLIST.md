# Launch Checklist — live-payment smoke test

_Run top to bottom, in order. Each step names what proves it passed. Do the
whole thing once in Stripe **test mode**, then repeat steps 4–9 once with a
real card after flipping to live keys._

## 1. Preconditions (one-time)

- [ ] §1 ledger check in `docs/RUNBOOK.md` reports every migration applied
      (0025 / 0028 / 0029 true).
- [ ] Vercel env has: Supabase trio, Stripe trio + shipping rate id,
      `RESEND_API_KEY`, `ADMIN_EMAILS` + `VITE_ADMIN_EMAILS`,
      `VITE_SITE_URL`. Redeploy after changes — env is baked at build time.
- [ ] Supabase dashboard: Site URL = production origin; redirect allow-list
      includes production `/**`.
- [ ] Stripe dashboard: webhook endpoint `https://<site>/api/stripe-webhook`
      subscribed to `checkout.session.completed`; secret matches
      `STRIPE_WEBHOOK_SECRET`.

## 2. Storefront sanity (2 min)

- [ ] `/shop` shows 44 products from the LIVE database (spot-check a price
      you changed in the Catalog tab — the bundled fallback would show the
      old price).
- [ ] A PDP with an approved label shows the 3D vial; its QR resolves
      `/v/<code>` → **verified** + linked COA.

## 3. Auth loop

- [ ] Register a fresh test account → confirmation email lands →
      `/auth/confirm` → routed to the attestation page → complete it.
- [ ] "Forgot password" → email → `/reset-password` → new password →
      re-login works. An already-used link shows the invalid-link screen
      (not a blank page).

## 4. Tracked-inventory purchase (the money path)

- [ ] Catalog tab: set a test variant's **inv = 3**. PDP still sells it.
- [ ] Cart with qty 5 of it → checkout refuses with "3 available" (oversell
      guard).
- [ ] Buy qty 1 with Stripe test card `4242 4242 4242 4242`:
  - [ ] Success page shows; cart cleared.
  - [ ] Order appears in Control Room → Orders as **paid** with items +
        address.
  - [ ] Variant's inv now **2** (decrement fired).
  - [ ] Order-confirmation email received.
- [ ] Set inv = 0 → PDP shows out of stock; join the back-in-stock list
      with a second email address.

## 5. Ship it

- [ ] Open the order → **Print packing slip** (both RUO lines, no prices).
- [ ] Paste any https tracking link → **Mark shipped + email customer** →
      email arrives with the link; order shows `shipped`; tracking link
      visible in the customer's Researcher Console.

## 6. Restock loop

- [ ] Set the variant's inv back to **10** → status derives in-stock → the
      second email address receives the one-time restock notice.

## 7. Promo code

- [ ] Discounts tab: create `LAUNCH10`, 10% off, min $0 → apply at checkout
      → server-priced total reflects it → after purchase, usage shows 1.

## 8. Crypto rail (if BTCPay configured)

- [ ] Checkout via crypto → invoice settles (testnet) → same order flow:
      order row, decrement, confirmation email.

## 9. Failure visibility

- [ ] Errors tab is empty after all of the above (no silent production
      errors during the run).

## 10. Go live

- [ ] Swap Stripe test keys → live keys (secret, publishable, webhook
      secret from the LIVE webhook endpoint); redeploy.
- [ ] Repeat steps 4–5 once with a real card for a $-small variant; refund
      it from Stripe afterwards (status → refunded in the Orders tab).
- [ ] Re-run step 2 on production and a real phone (Safari/iOS): browse,
      add to cart, reach the payment sheet.

Anything fails → the RUNBOOK's §4 drift check first, then the Errors tab,
then Vercel function logs for the specific endpoint.
