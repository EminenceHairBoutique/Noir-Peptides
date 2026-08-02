# Two-Step Checkout — Build Notes

_Review build, **uncommitted**. Nothing here is wired into the live `/checkout`
route yet — the existing single-step checkout is untouched and still works
(Stage 7). Activation is a one-line route swap (below)._

## Reconciliation: the brief's "established facts" are stale

Two premises in the prompt are out of date against this session's evidence, so
I built against reality and note it here:

- **"products/label_configs are empty; storefront renders from static files."**
  The catalog was seeded this session (owner-confirmed live counts:
  products 44, variants 96, tiers 480, COAs 19, labels 96, 0 orphan FKs), and
  `catalog.js` reads Supabase first. Cart line items resolve to real rows.
  Checkout still fails **closed** if a variant can't be resolved server-side —
  it never submits an order referencing a nonexistent product.
- **"attestation must be persisted server-side (implying it isn't)."** It
  already is: `fulfillment.js` writes `attestation_audit` with server IP/UA/
  timestamp at purchase. This build **extends** that with a per-order
  `order_attestations` record carrying the research entity/protocol + the three
  checkout certifications.

## What was built

| Piece | File | Notes |
| --- | --- | --- |
| Two-step orchestrator | `src/pages/CheckoutTwoStep.jsx` | Progress bar `1 Personal → 2 Payment`; cart + entered data preserved across steps and back-nav |
| Step 1 (Personal) | `src/components/checkout/StepPersonal.jsx` | Contact · shipping (+ billing toggle) · research info · shipping method · 3 RUO certs |
| Address fields (reused) | `src/components/checkout/AddressFields.jsx` | Real `<label>`s, autocomplete tokens, `aria-describedby` errors |
| Step 2 (Payment) | `src/components/checkout/StepPayment.jsx` | Rails from the abstraction; BTCPay primary, Stripe when configured |
| Config (rates/threshold/options) | `src/config/checkout.js` | Shipping rates + free-ship threshold + research entity/protocol lists — **owner-tunable, not in JSX** |
| Our RUO cert wording | `src/config/checkoutAttestations.js` | Three independent affirmations, our text, versioned |
| Pure validation | `src/lib/checkoutValidation.js` | No DOM; shared by component + tests |
| US states | `src/lib/usStates.js` | |
| Payment rails mirror | `src/lib/paymentRails.js` | |
| Compliance endpoint | `api/checkout-compliance.js` | Persists the record **before** payment; server-enforced, server-captured IP/UA/timestamp |
| Schema (for you to run) | `scripts/proposed-order-attestations.sql` | `order_attestations` table + `orders.compliance_id` |
| Tests | `tests/checkout/*.test.mjs` | 48 assertions, all green |

## Verification (all **executed**)

- **Mobile (390px) screenshots** of Step 1 empty + filled — every field, the
  free-ship nudge, and the three certs render correctly. Filled state advances.
- **48 test assertions pass**: validation gating, attestation enforcement
  (all-three-required), free-ship threshold math, billing-toggle disclosure,
  and server-side enforcement guards (version match, off-list research values
  rejected, IP/UA captured server-side, canonical statement text).
- **Server enforcement proven independent of the UI**: the endpoint rejects a
  payload with a missing/blank certification or an off-list research value —
  the client checkboxes can't be bypassed by calling the API directly.
- **No regression**: the 9 existing unit suites stay green; the temporary
  preview route was reverted; the live checkout is unchanged.
- **Bundle delta**: the two-step checkout chunk is **26.3 KB (7.5 KB gzip)**,
  lazy-loaded — it replaces, not adds to, the current 10 KB Checkout chunk on
  activation, and loads only on the checkout route.

## 🔶 The decision only you can make: guest checkout vs. the auth wall

**This is the crux, and it conflicts with a design your site treats as legal
infrastructure — so I did not silently change it.**

Your checkout is **auth-walled by deliberate compliance design**: `/checkout`
sits behind `RequireAuth`, the server hard-requires a Supabase bearer token
**plus** a stored, current attestation, and migration 0003 describes this wall
as *"the actual lock"* for research-use compliance. Orders bind to a verified
account identity via RLS (`user_id = auth.uid()`).

The brief asks for **guest checkout as the default**. That is not a UI toggle —
it requires:
1. Removing `RequireAuth` from `/checkout`.
2. A new **unauthenticated** order-creation + attestation path (the current
   `create-checkout-session` returns 403 without a logged-in, attested user).
3. A guest-order RLS model (no `auth.uid()` to key on) + a guest identifier.
4. Accepting a **weaker compliance binding** — the legal paper trail would
   attach to a self-entered email instead of a verified account.

### Recommendation

**Keep the authenticated model for launch** (what this build ships as), for two
reasons specific to you: (a) it preserves the compliance posture your own
migrations call the actual lock, and (b) account creation is already low
friction here because attestation is a one-time gate, not a per-order step.
Registration doubles as the age/qualified-purchaser record — valuable in this
category.

**If you still want guest checkout**, it's a clean follow-up, and I've built
toward it: `api/checkout-compliance.js` already accepts an anonymous caller
(`user_id` NULL) and `order_attestations` already allows guest rows. Flipping it
on is a scoped change — remove the route guard, add a guest branch to the
order-creation endpoint, and extend RLS — **plus running the migration**. It is
*not* wired now because it changes your compliance posture and needs your
explicit go-ahead. Say the word and I'll do it as its own reviewed change.

The reverse (hard wall) is trivial from either state — it's the current guard.

## Payment-layer integration status

Step 2 renders rails from `paymentRails.js` (a build-time mirror of the server
abstraction). Both rails hand off to the **existing** endpoints — BTCPay
(`/api/btcpay/create-invoice`, primary) and Stripe
(`/api/create-checkout-session`, shown only when `VITE_STRIPE_PUBLISHABLE_KEY`
is set). Those already verify webhook signatures and key fulfillment on
`provider_ref` for idempotency (unchanged). I did **not** rebuild payment.

**Open seam:** address is currently collected by Stripe's hosted page. This
build collects it in-app; to make the in-app address authoritative you'd pass
it to the session (`shipping_address_collection` → prefilled/locked) and thread
`complianceId` into `fulfillment.js` so the order links the compliance row. That
wiring is the one piece left for full end-to-end and is called out in "Your
action list."

## Your action list (only you can do these)

1. **Run `scripts/proposed-order-attestations.sql`** in the Supabase SQL editor
   (creates `order_attestations` + `orders.compliance_id`). The compliance
   endpoint 500s until this exists.
2. **Decide guest vs. auth wall** (above). This build ships authenticated; I
   flip to guest on your go-ahead.
3. **Set shipping rates + free-ship threshold** in `src/config/checkout.js`
   (currently Standard $12 / Economy $7 / Next-Day $35; free over $200 — placeholders).
4. **Confirm Stripe shipping-rate wiring** if you want the in-app shipping
   method to drive the Stripe charge (today Stripe uses its own rate id).
5. **Activate when approved**: point the `/checkout` route at `CheckoutTwoStep`
   (one line in `src/App.jsx`), and I'll wire `complianceId` through fulfillment.
