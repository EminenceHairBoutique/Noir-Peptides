# Claude Fable 5 — Noir Peptides Checkout Rebuild
## Two-step RUO checkout modeled on observed best-in-class patterns

> Run in Claude Code with `/model fable` (requires v2.1.170+).
> Paste at the root of the Noir Peptides repo.
> Stack: React + Vite + JS/TS + Supabase + Vercel. (Target site is React/Supabase — do NOT
> introduce WooCommerce or PHP; the reference patterns below come from a WooCommerce competitor
> but must be reimplemented natively.)

---

## MISSION

Rebuild the checkout as a clean two-step flow (Personal → Payment) with a research-use-only
compliance layer and strong conversion patterns. Build it, verify it against real cart state,
and confirm the compliance record is actually persisted server-side.

This is a **reference-informed build**, not a copy. The patterns below were observed on a
competitor's live checkout; reimplement them in this stack, with our data model and our payment
architecture. Do not copy any competitor code, markup, or copy text.

## AUTONOMY & GUARDRAILS

**Proceed freely:** reading code and schema, running builds and tests, read-only DB queries,
writing new components and tests, taking screenshots to verify layout, delegating to sub-agents.

**Ask me before:** applying a migration, wiring live payment credentials, changing pricing,
committing, or pushing.

**Never:** `DROP`/`TRUNCATE`/`DELETE FROM` on the live DB; destructive re-seed; commit secrets;
gate the product catalog behind login (catalog must stay crawlable — SEO depends on it).

## CONTEXT — established facts, do not re-derive

- The `products` and `label_configs` tables are currently empty on the remote DB; the storefront
  renders from static files. **This checkout depends on the catalog being seeded** — cart line
  items must resolve to real product rows. If products are still unseeded when you build, make the
  checkout degrade gracefully (clear empty-cart / unavailable state) rather than submitting orders
  that reference nonexistent products, and note the dependency in your report.
- A `profiles` table exists with attestation columns already (`attestation_completed_at`,
  `attestation_version`, `attestation_statements` jsonb, `attestation_ip`, `attestation_user_agent`,
  `attestation_legal_name`). Reuse this infrastructure — do not duplicate it.
- A payment provider abstraction (BTCPay-first, with card/ACH adapters) is the intended step-2
  target. **Integrate with it; do not rebuild it.** If it doesn't exist yet, stub step 2 behind
  the same interface (`createCharge`/`getStatus`/`handleWebhook`) and mark it clearly.

---

## STAGE 1 — Structure: two-step checkout

Replace the current checkout with two steps and a numbered progress indicator
(`1 Personal` → `2 Payment`).

- Step 1 collects everything below and validates before advancing.
- Step 2 is payment only, and renders the available rails from the payment abstraction (crypto via
  BTCPay as primary; card/ACH if configured).
- Preserve cart state across steps; allow going back to step 1 without losing entered data.
- If the user is authenticated, show a "Signed in as {name} ({email})" confirmation banner. If not,
  see the guest-checkout decision in Stage 6 — do not force account creation.

## STAGE 2 — Step 1 fields

**Contact information**
- First name (required), Last name (required)
- Email (required, validated)
- Phone (optional)

**Shipping address**
- Institution / Organization name (optional; placeholder like "e.g. Ridgeline Research LLC")
- Contact name (optional)
- Street address (required)
- Apartment / suite / unit (optional)
- Town / City (required)
- State (required, dropdown of US states)
- ZIP (required, format-validated)
- Phone (optional)
- **"Different billing address?"** checkbox → progressively reveal billing fields only when checked.

**Research Information** (this is the compliance-as-UX layer — required)
- **Research Entity** (required dropdown). Options, RUO-consistent, no human-use implication:
  Academic / University Lab · Research Institution · Commercial / Industry Lab ·
  Analytical / Testing Laboratory · Other Professional Entity.
- **Research Protocol / Intended Research Use** (required dropdown). Options:
  In-vitro study · Analytical / reference standard · Assay or method development ·
  Stability / reference testing · Other research use.
- Persist BOTH selections with the order record (see Stage 4). Keep all option labels strictly
  research-framed; none may imply human/veterinary use.

**Shipping method** (required, single-select)
- Provide tiered options with descriptive labels, e.g.:
  - Standard 2-Day (2–3 business days) — $X
  - Economy / Ground (ideal for PO boxes; 3–5 business days, not guaranteed) — $Y
  - Next-Day — $Z
- Read rates from config, not hardcoded in the component.
- Show a **free-shipping threshold nudge**: "Add ${remaining} more to qualify for free shipping"
  when under the threshold; switch to a free-shipping-applied state at/over it.

**RUO Certification** (required — all must be checked to proceed)
Three separate checkboxes, each independently required. Write our own wording (do not copy any
competitor's text); cover these three affirmations:
1. Purchased for research use only, not for human or animal consumption.
2. Read and agree to the Terms & Conditions (link) and Privacy Policy (link).
3. At least 21 years old; will not use products for human/animal consumption or as food additives,
   drugs, or household chemicals; represents being a qualified/appropriate purchaser.

"Continue to Payment" is disabled until contact, shipping, research information, shipping method,
and all three attestations are valid.

## STAGE 3 — Validation & UX

- Mobile-first. The customer base is overwhelmingly on phones — verify the whole flow at 390px
  width with a screenshot, not just desktop.
- Inline, per-field validation with clear error messages; never surface a raw backend/Postgres
  error to the user.
- Preserve entered data on validation failure and on step navigation.
- Accessibility: every field has a real `<label>`, checkboxes are keyboard-operable, focus order is
  logical, error messages are associated via `aria-describedby`. Screen-reader test the attestation
  block.
- Autocomplete attributes on address/contact fields for fast mobile entry.

## STAGE 4 — Compliance persistence (do not skip)

The research declarations and attestations are the legal paper trail — they must be stored
server-side, not just validated client-side.

- On order submission, persist to Supabase (extend the existing attestation infrastructure; add an
  `order_attestations` record or columns on the order):
  - the three attestation booleans + the exact attested text shown, and the attestation version
  - Research Entity and Research Protocol selections
  - server-side timestamp, IP, and user agent (capture server-side; never trust client values)
  - the associated order ID and user ID (or guest identifier)
- Enforce server-side too: the order-creation endpoint/RPC must reject an order lacking valid
  attestations, so the client checks can't be bypassed.
- Write me the SQL for any schema change (new table/columns) rather than applying it — I'll run it.

## STAGE 5 — Step 2: payment integration

- Render available rails from the payment abstraction layer. Default to crypto (BTCPay) if no card
  processor is active.
- Do NOT implement any flow that disguises the transaction's nature from card networks or issuing
  banks. Represent the business honestly to every processor.
- Verify webhook signatures and use idempotency keys on order fulfillment.
- On successful payment, transition the order to paid and show a confirmation with order number;
  ensure the compliance record from Stage 4 is already attached before payment is attempted.

## STAGE 6 — Guest checkout decision (flag for me)

The reference competitor forces account creation at checkout. That captures emails and binds
attestations to a persistent identity, but adds friction that hurts conversion pre-launch.

- Implement **guest checkout as the default path**, with an optional "create an account" toggle
  that sets a password post-purchase.
- Bind the attestation/research record to the guest order regardless.
- In your report, lay out the tradeoff (captured-email + stronger identity binding vs. conversion
  friction) and how to flip to a hard wall later if I choose — but ship guest-checkout-capable.

## STAGE 7 — Don't break what works

- Preserve existing cart state, order schema, and any working order flow. Diff before/after.
- Reconcile with the existing admin/order views so orders created through the new checkout appear
  correctly there.
- Keep the catalog and product pages crawlable — no login wall on browsing.

---

## SELF-VERIFICATION — before reporting

- **Drive the full flow end to end** with a real (test) cart: add item → step 1 (all fields +
  attestations) → step 2 (stubbed or test payment) → order created. Screenshot each step at mobile
  width.
- **Prove the compliance record persists:** after a test submission, show the stored attestation +
  research-entity/protocol row (via a read query) with server-set timestamp/IP.
- **Prove server-side enforcement:** attempt an order submission with attestations missing and show
  it's rejected by the backend, not just the UI.
- Write component/integration tests under `tests/checkout/` for: validation gating, attestation
  enforcement, free-shipping threshold math, and billing-toggle disclosure.
- Mark each finding **verified** (executed) or **suspected** (inferred). Report the bundle-size
  delta and anything blocked (e.g. unseeded products).

## DELIVERABLES

1. The rebuilt two-step checkout (components, validation, state) — uncommitted, for review.
2. SQL for any schema change needed for Stage 4 (for me to run).
3. Tests under `tests/checkout/`.
4. `CHECKOUT_NOTES.md`: what was built, the guest-vs-wall tradeoff with a recommendation, the
   payment-layer integration status, and any dependency still blocking (seeding, payment provider).
5. My action list — what only I can do (run the SQL, supply processor/BTCPay credentials, set the
   free-shipping threshold and shipping rates, decide guest vs. wall).

Stop and ask before applying migrations, wiring live payment credentials, changing pricing,
committing, or pushing.
