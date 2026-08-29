# Competitive features — change report (Aug 28)

Branch `claude/competitive-features-aug28`. Eight tasks from the vendor-crawl
brief. What follows is what changed, what was already true, and what is left for
the owner.

Gate on every commit: `npm run build` (78 route HTMLs, 74 sitemap URLs),
`npm run lint` (0 errors; 3 pre-existing warnings), `npm run test:unit` (green).

---

## T1 — COA/batch two-factor verification

**Goal:** a lot that resolves against the *issuing laboratory's own public
record*, not only against this site. That is the bar third-party vendor-audit
sites treat as confirmation; an unnamed lab is discounted.

- Migration **0032**: `labs` (name, accreditation body/number, public lookup URL
  template) and `batch_tests` (three-tier analytical panel), plus seven columns
  on `coas` — `lab_id`, `lab_lookup_code`, `purity_operator`,
  `net_peptide_content_mg`, `label_claim_mg`, `published_on`, `status` — and a
  unique index on `(product_id, lot_number)`.
- `src/lib/labVerify.js` builds the outbound lab link. The template is
  owner-entered data rendered as a trust link, so it is parsed and accepted only
  when it is **https** *and* contains the literal `{code}` placeholder.
  Anything else renders **no link at all** rather than a broken one.
- `formatPurity` honours `purity_operator`, so a qualified `≥ 99%` is never
  displayed as an exact `99%`.
- `<TestPanel>` groups results into identity/potency, contamination control, and
  physical integrity. Its heading count is derived from the rows, never written.
- Wired through `CoaCard`, `BatchHistoryTable`, `VerifyLot`, and the QR path in
  `api/verify.js` (the lab is a JOIN, not an extra round trip).

**Schema decision:** the brief proposed a new `batches` table. That would have
forked the source of truth away from `coas`, which has ten consumers. Extended
`coas` instead — confirmed with you before building.

## T2 — Safety Data Sheets

- Migration **0033**: `products.sds_file_url`, `sds_updated_at`, and a
  `product_type` split (`peptide` / `lab_supply`).
- `<SdsLink>` renders only for a real URL. **No placeholder, ever** — an EHS
  review treats a dead SDS reference as a compliance failure, which is worse
  than a stated absence.
- New **`/documents`** index: published sheets, the certificate library, lot
  verification, and the policy documents. Materials *without* a sheet are named
  in a labelled list rather than hidden; an index that quietly omits what it
  lacks is worse than one that says so.
- Control Room: SDS URL, revision date and product type under each expanded
  product. The server validates the URL as absolute https (http is
  downgradeable on exactly the wrong kind of document; parsing rules out
  `javascript:`/`data:`), shape-checks the date, and whitelists the type.
  Clearing the URL is supported — a withdrawn sheet must be removable.

## T3 — Quantity price ladder

**Already server-authoritative.** `price_tiers` drives
`resolveVariantUnitPrice()`, and `priceLines()` re-prices every line from the
database; the PDP ladder is DB-driven. What was missing was proof.

`scripts/test-server-pricing.mjs` (32 assertions) runs the **real**
`lib/pricing.js` against fixture rows with `supabaseServer` stubbed at bundle
time. Every case sends a hostile line item — `price`, `unitDollars`, `subtotal`,
a fabricated tier ladder, `is_bundle`, `inventory_count` — and asserts the
server's own figure survives. **Verified by regression:** making `priceLines()`
honour `item.price` fails 6 assertions.

One behaviour documented rather than changed: a negative quantity is clamped to
1, not rejected. It can only ever raise a charge, so the test asserts the clamp
instead of demanding a throw the checkout flow does not perform.

## T4 — Crypto payment incentive

**Already applied server-side** in `api/btcpay/create-invoice.js` from
`BTCPAY_CRYPTO_DISCOUNT_PCT`, on the server-priced subtotal, before shipping is
added.

- `<CryptoIncentive>` surfaces the saving **on the cart**, where it can affect
  the decision, instead of only at rail selection. It holds no percentage of its
  own: the number comes from `/api/payment-rails`, the same env the invoice
  reads, so advertised and charged cannot drift.
- It renders nothing unless the server reports a live crypto rail — the specific
  failure the rails endpoint was built to end, when crypto was advertised as
  recommended on a deployment where it 503'd.
- `scripts/test-crypto-incentive.mjs` (27 assertions) executes the rails
  endpoint under manipulated env and asserts no key material reaches the public
  response.

## T5 — Trust surface

- Business hours render as a real table (closed days say "Closed"); the dispatch
  cutoff is a full same-day statement naming time, timezone and days.
- `<FreeShipProgress>` on the cart reads the **same** `FREE_SHIP_THRESHOLD` the
  server prices against; its `aria-valuemax` is that constant, not a copy.
- `<FulfillmentStatements>` puts the discreet-packaging and billing-descriptor
  facts on the shipping policy and at the payment step. A wrong descriptor is
  what turns an unrecognised charge into a chargeback, so both stay null until
  the owner sets the true value.
- **Removed two hardcoded claims** from the PDP: it asserted a "2:00 PM ET"
  cutoff and discreet packaging that nothing in the config backed. Both are now
  config-driven and absent by default.

Phone, address, hours, cutoff, guarantee, packaging and descriptor are all
null-by-default in `src/config/business.js`. Nothing renders a placeholder.

## T6 — Research-use agreement

`/legal/ruo-agreement` — a standalone, linkable document so an auditor or a
payment underwriter can cite one URL. Routed, prerendered, footer-linked.

The **21+ gate already ships** site-wide (`<AgeGate>`, `src/App.jsx`), so no
gate logic was touched.

⚠ The agreement text is a **claim-safe scaffold pending attorney review**,
marked as such in `src/config/legalCopy.js`.

## T7 — Purity vs. net peptide content

`/research/purity-vs-content` — six sections on why a chromatographic area
percentage and a mass of peptide are different measurements, and why lyophilised
peptide salts (counterions, residual water) make them diverge. Pairs with the
`net_peptide_content_mg` / `label_claim_mg` fields.

My first draft landed in `researchDrafts` — the deliberately unpublished
export — which would have shipped no route at all. Moved to `researchArticles`;
it now prerenders, sitemaps and carries Article JSON-LD. Every section passes
the compliance scanner (the rest of the corpus re-checked at the same time).
Still worth an owner read before launch.

## T8 — Laboratory consumables

`getLabSupplies()` + `<LabSuppliesCrossSell>` offer `product_type='lab_supply'`
items in the cart.

**Deliberately not framed as a step in any procedure** — no reconstitution,
ratio, dosing or protocol language, and the test asserts that copy stays clean.
Unlike the storefront reads, this query never falls back to the bundled
catalogue, which holds no consumables and would otherwise list peptides under
"laboratory consumables".

---

## Found while building

Three defects that were not on the brief:

1. **`/coa` was silently repurposed.** On `main` it rendered the COA *Policy*
   page. My own T1 commit added an earlier duplicate route that shadowed it —
   dead code that changed a live URL's meaning. Removed. The policy page keeps
   `/coa-policy`, which is where every internal link already pointed.
2. **Deploy-order hazard.** Selects naming post-migration columns would have
   made `products` fall back to the *bundled build-time catalogue* — stale stock
   and prices, with no visible error — on any deploy that landed before the
   migration. `src/lib/pgSelect.js` now degrades to the pre-migration column
   list on an undefined-column error **only**; every other error still surfaces.
   Applied to the product reads, the COA reads, and the Control Room catalog GET
   (which would otherwise have answered "Could not load catalog").
3. **`/coa-policy` was never prerendered.** `COA_POLICY_DOC` has been imported
   by the SEO generator all along with no route emitting it, so the page existed
   only behind Vercel's SPA rewrite — a soft-404 to crawlers. Now emitted.

## Owner work — none of this is code

- Apply migrations **0030–0033**: `docs/MIGRATIONS_0032_0033.md` has paste-ready
  SQL and states what each result means, including the recovery path if the new
  unique lot index rejects a pre-existing duplicate.
- Real laboratory records, lookup codes, and analytical panels (T1). The lookup
  template must be https and contain `{code}`.
- Author the Safety Data Sheets and enter them in the Control Room (T2).
- Attorney review of `RUO_AGREEMENT_DOC` and the 503A/503B wording.
- Fill `src/config/business.js`: phone, address, hours, cutoff, guarantee,
  packaging statement, billing descriptor.
- Set `BTCPAY_CRYPTO_DISCOUNT_PCT` and the BTCPay trio for T4 to surface at all.
- Mark consumables `product_type = 'lab_supply'` and give each a variant (T8) —
  an item without one cannot be priced server-side and is skipped.
