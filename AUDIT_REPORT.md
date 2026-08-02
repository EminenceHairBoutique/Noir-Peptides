# Noir Peptides — Master Audit Report

_Audit of repo at HEAD `16b5875` (main), 2026-07-27. Findings marked
**[VERIFIED]** (something was executed that proved it) or **[SUSPECTED]**
(follows from reading code). Where a prompt "Established Fact" conflicts with
first-party evidence from recent work, that reconciliation is called out — I
did not build on stale premises._

---

## ⚠ Reconciliation: the brief's "Established Facts" are partly out of date

The audit prompt's ground-truth list was captured *before* a series of merged
fixes (PRs #12–#17) and before the owner ran the seed kit. Each stale item,
with dated evidence:

| Brief's fact | Status now | Evidence |
| --- | --- | --- |
| #2 `products`=0, `label_configs`=0 | **Superseded** | Owner ran `scripts/manual-seed.sql` and pasted live results this session: `products`=44, `product_variants`=96, `price_tiers`=480, `coas`=19, `label_configs`=96, `orphan_labels`=0. |
| #3 storefront reads static, not DB | **Half-true** | `src/lib/catalog.js` reads Supabase FIRST and only falls back to static on error/empty (added PR #12). With the DB now seeded it serves live rows. |
| #4 label dropdown submits static IDs → FK violation | **Fixed (PR #13)** | Studio now uses `getProductsAuthoritative()` (strict live read, no fallback) and the API validates FK targets pre-insert with a friendly 409. |
| #5 site is CSR, empty body, not indexed | **False at HEAD** | `npm run build` prerenders **73 route HTML files**; `dist/product/bpc-157/index.html` contains 448 chars of visible body text, `<title>`, OG tags, and `Product` JSON-LD. |
| #6 `profiles` has `role` AND `is_admin`; guard target unknown | **Partly false** | No `is_admin` **column** exists; there is an `is_admin()` **function**. The guard reads `profiles.role` (`api/_utils/auth.js:101`). |

Fact #1 (no CLI migration ledger; tables hand-built) **remains true and
correct** — it is the single most important structural fact and everything in
Stage 2 is built around it.

---

## VERDICT ON PRs #9 / #10 (Stage 1)

**Neither #9 nor #10 broke the site. Both were purely additive.** The symptoms
in the brief (empty tables, static-fed dropdown) are the **infrastructure gap**
— migrations never applied via CLI — not a code regression. Baseline chosen by
**rule 3** (merge immediately before PR #9): Phase 4 = commit `77c7764`
(2026-07-19); the merge boundary is `8f8bc07` (PR #9).

- **PR #9** (`8f8bc07`, 2026-07-23, +6492/−34, 111 files): RUO label system +
  GLP-1 catalog + Janoshik COAs. **34 deletions total** across 111 files — no
  route, query, or price file was removed. [VERIFIED: `git diff --shortstat`]
- **PR #10** (`8e32a6d`, +189/−1, 6 files): customer-facing 3D vial on PDPs.
  Six files, one deletion. [VERIFIED]
- **No routes were ever deleted** (`git log --diff-filter=D 'src/pages/*.jsx'`
  → empty). [VERIFIED]
- **Storefront never "switched" to static** — `catalog.js` was DB-first from
  the start; the static path is an explicit resilience fallback, not a
  regression. [VERIFIED: read + git blame PR #12]
- **Prices** in `tier1Catalog.js` were last set in `fb24853` (owner-confirmed
  GLP-1 pricing) — a deliberate data edit, not a break. [VERIFIED]

---

## 🚨 LAUNCH BLOCKERS — ranked, four buckets

### (a) Code regressions from PRs
**None found.** [VERIFIED — Stage 1] The post-Phase-4 PRs are additive; the
storefront, routes, and pricing paths are intact.

### (b) Pre-existing migration / seed gap
**B1 — [RESOLVED this session, verify on your DB].** Tables were hand-built
with no CLI ledger (Fact #1). The owner has since run `manual-seed.sql` +
`manual-seed-rls.sql` and confirmed 44/96/480/19/96 with 0 orphan FKs. **Action
for you:** run the RUNBOOK §1 ledger check to confirm migrations `0025`/`0028`/
`0029` are also applied (they postdate the seed). Until the CLI is baselined
(procedure in Stage 2), drift can recur — but the acute gap is closed.

### (c) Security exposures
**C1 — 🔴 CRITICAL, [VERIFIED]: self-write privilege escalation via the
`profiles` UPDATE policy.** The shipped policy (`0024` line 170;
`manual-seed-rls.sql` line 79):
```sql
create policy profiles_update_own on public.profiles
  for update using (id = auth.uid()) with check (id = auth.uid());
```
`WITH CHECK` validates *which row* you may write, never *which columns*. Since
the anon key is public (it ships in the bundle), the attack is one REST call
with the attacker's own login — no app code involved.

**Blast radius is wider than `role`.** All four column groups below are
self-writable AND trusted server-side. Each was executed against the real
policy in scratch Postgres 16 and **succeeded**:

| Column | Attack result | Trusted by | Impact |
| --- | --- | --- | --- |
| `role` | → `admin` | `requireAdmin` (auth.js:101) | **Full admin takeover** |
| `loyalty_points` | → `999999` | `rewards.js:98` ("source of truth") | **Free money** at checkout |
| `attestation_completed_at` | → set | checkout gate (line 66) + `is_attested()` RLS | **Bypasses the RUO/legal wall** |
| `account_tier` | → `partner` | `requirePartner` (auth.js:132) | Wholesale pricing |

**Fix drafted + validated, NOT applied:**
`scripts/proposed-fix-profiles-rls.sql`. Post-fix rerun: all four attacks blocked
(`customer` / `0` / `null` / `customer`) while `service_role` writes still
succeed, so no server endpoint changes behavior. Regression test:
`tests/audit/profiles-escalation.test.mjs`.

**Note on a discarded approach.** My first draft added
`revoke update (role) ... from authenticated`. Testing proved that is a
**no-op** when a table-level UPDATE grant exists — escalation still succeeded.
Column-level `REVOKE` cannot subtract from a table-level `GRANT`. The shipped
fix instead revokes table-level UPDATE from `anon`/`authenticated` (safe: the
client only ever SELECTs `profiles`; all writes go through service-role
endpoints) with a column-pinning policy underneath as defence-in-depth.

**C2 — 🟠 [SUSPECTED, needs live probe]: verify RLS actually returns zero rows
to anon** for `profiles`, `orders`, `attestation_audit`. Policies exist in
`0024`/manual-seed-rls; I could not issue a live REST call (no network to the
project from here). SQL + curl to run yourself in Stage 5.

**C3 — 🟢 CLEARED, [VERIFIED]: no secrets in the client bundle.** `dist/`
scanned for `sk_live`, `service_role`, `AKIA…`, PEM headers, and JWTs — **zero
hits**, no `.map` files. The anon key is env-injected at runtime, not inlined
literally. `vercel.json` already carries HSTS, CSP (`frame-ancestors 'none'`),
nosniff, Referrer-Policy (5/5 header families present).

### (d) Compliance & disclosure gaps
**D1 — 🟡 [VERIFIED]: COA data exists but cards still say "COA on request."**
`0019_janoshik_coas.sql` supplies 19 real batch COAs, and the COA library page
exists — but `ProductCard.jsx:122` only shows a COA badge when `product.coa_url`
is set, which the catalog read doesn't populate from the `coas` table. The
inline batch-COA display is wired at the PDP but not the card. Report-only per
your instruction; roadmap item T1.

**D2 — 🟢 [VERIFIED]: attestation logging is correct.** `fulfillment.js:133`
writes `attestation_audit` with `ip_address`, `context:'checkout'`, version,
statements, legal name, and order id at purchase time.

---

## STAGE 2 — Database & migrations

- **Fact #1 confirmed structurally.** 29 migrations exist; none was applied via
  CLI. The consolidated, non-destructive `scripts/manual-seed.sql` (generated
  by `scripts/gen-manual-seed.mjs`) is the reconciliation artifact — idempotent,
  `IF NOT EXISTS` DDL + `ON CONFLICT DO NOTHING`/`WHERE NOT EXISTS`, dependency
  order categories→products→variants→tiers→COAs→labels, verification counts at
  the end. **[VERIFIED]** on scratch PG16 against both a hand-made empty schema
  (missing `variant_id`) and a fully-migrated DB: 44/96/480/19/96, 0 orphans,
  idempotent rerun, no-op on migrated DB.
- **Product IDs are deterministic text slugs, NOT generated UUIDs** (`'bpc-157'`,
  `'bpc-157-5mg'`) — so `0020`'s label FKs resolve. This directly answers the
  brief's "blocking question": IDs are stable; no UUID drift is possible.
  **[VERIFIED]**
- **FK delete rule:** `label_configs_product_id_fkey` is `ON DELETE CASCADE`.
  Recommend `RESTRICT` — drafted as `0027_label_fk_restrict_PROPOSED.sql`,
  proven in scratch PG (delete blocked, label rows survive). **Awaiting owner
  approval — not applied.**
- **CLI baseline procedure** (Stage 2 deliverable): `supabase link` the project,
  then `supabase migration repair --status applied 0001..0029` to mark the
  existing hand-built schema as already-applied WITHOUT re-running DDL, then
  future migrations flow through `supabase db push`. Detailed in RUNBOOK §1.

## STAGE 3 — Pricing integrity

**Answer to the crux question — "will the card price match the charged price
once seeded?": YES.** [VERIFIED by executed parity check]

- All **44/44** static product base prices in `tier1Catalog.js` exactly match
  the `0009` seed base prices (0 mismatches); 96 variants + 480 tiers parse
  consistently.
- Checkout **re-prices server-side** (`lib/pricing.js priceLines` →
  `product_variants.price` + `price_tiers`), never trusting the client display.
  So even a hypothetical mismatch could not overcharge — the server is
  authoritative.
- When the DB is unseeded, `resolveVariant` returns null → checkout throws
  "Unknown variant" and **fails closed** rather than mischarging. [VERIFIED by
  reading the path]
- **No cents/dollars double-conversion:** prices are dollars end-to-end;
  `unit_amount: Math.round(unitDollars*100)` converts once at the Stripe
  boundary. `lifetime_spend_cents` is cents only in the loyalty ledger.
  [VERIFIED]
- One UX nuance (not a blocker): the card shows the product-level "from" price;
  a larger variant costs more, shown correctly on the PDP. Standard pattern.

## STAGE 4 — Functionality

- **Build:** clean, 73 prerendered routes. **[VERIFIED]**
- **Unit suites:** 9 suites green (guardrail, compliance-scan, labels,
  cart-pricing, error-telemetry, admin-catalog, inventory, fulfillment,
  batch-discounts). **[VERIFIED]** No suite asserts against static data as a
  false-green — cart-pricing tests re-derive from the pure fns.
- **Admin guard reads `profiles.role`** (`auth.js:101`), with an `ADMIN_EMAILS`
  bootstrap fallback (client mirrors via `VITE_ADMIN_EMAILS`, PR #13). **No
  `is_admin` column is read** — Fact #6's ambiguity resolved. **[VERIFIED]**
- **Attestation redirect loop:** `RequireAuth` bounces unattested users to
  `/register/attestation`. An admin who never attested would loop **only on
  RequireAuth-wrapped routes**; `/admin` uses `RequireAdmin` (no attestation
  gate), so admins are not trapped out of admin. [VERIFIED by reading App.jsx]
- **Empty-`products` behavior:** storefront falls back to static (renders);
  checkout fails closed; orders cannot reference nonexistent rows because
  checkout errors first. [VERIFIED]
- **Raw Postgres error leaks:** the label-studio FK leak is **fixed** (PR #13,
  friendly 409). Residual raw `error.message` passthroughs remain in
  `api/admin/coa.js`, `reviews.js`, `ai-flags.js`, `labels.js` — **admin-only
  endpoints**, lower risk, but should be genericized. Roadmap A-hardening.
  [VERIFIED by grep]
- **Auth flows:** `/reset-password` handles **both** PKCE `?code=` and legacy
  hash recovery + `PASSWORD_RECOVERY` event; `/auth/confirm` routes through the
  attestation gate (PR #13). No hardcoded auth origin remains — the only
  `localhost:3000` is `vite.config.js`'s dev API proxy target, not a
  `redirectTo`. [VERIFIED]

## STAGE 5 — Security & opsec

- **C1 escalation** — the headline, proven above.
- **Bundle scan** — clean (C3). **[VERIFIED]**
- **RLS empirical probe** — run yourself (no live network here). SQL provided
  in `ROTATION_CHECKLIST.md` appendix + this curl shape:
  `curl 'https://<ref>.supabase.co/rest/v1/profiles?select=*' -H "apikey: <ANON>"`
  → **must return `[]`**. Any rows = world-readable PII. [SUSPECTED clear;
  policies exist but unverified live]
- **Git history secrets** — `git log -p --all -S 'sk_live'` and `service_role`
  → no hits in tracked history; `.env` is gitignored and never tracked.
  **[VERIFIED]**
- **Headers** — `vercel.json` already comprehensive (5/5). **[VERIFIED]**
- **Repo exposure** — the GitHub org name `EminenceHairBoutique` ties this
  research-materials store to an unrelated named brand and a real merge
  identity. Report-only; see "Your action list."

## STAGE 6 — SEO & indexability

**The brief's premise here is obsolete** — the highest-impact fix it names is
**already shipped.** `scripts/generate-static-seo.mjs` prerenders 73 routes at
build with real body text, `<title>`, description, canonical, OG, and `Product`
+ `Organization` JSON-LD in **static** HTML (not hydration-injected).
`sitemap.xml` (71 URLs) + `robots.txt` are generated. **[VERIFIED]** Remaining
SEO work is incremental (roadmap P-tier): per-vendor AI-crawler `robots.txt`
policy, single canonical host with 301s, richer structured data.

## STAGE 7 — Regulatory disclosure (report only)

- **COA inline** — data present (19 COAs), card still says "COA on request"
  (D1). PDP shows COAs. [VERIFIED]
- **Copy review** — the compliance scanner (`lib/complianceScan.js`) + its test
  suite already lint for human-use/dosing/therapeutic language; a full
  file+line copy sweep is a follow-up deliverable (flagged, not done here to
  respect the never-block rule). [SUSPECTED clean — enforced by tests]
- **Attestation logging** — correct (D2). [VERIFIED]
- **AI refusals** — `scripts/test-guardrail.mjs` (18 assertions) covers dosing/
  administration/human-use refusals. [VERIFIED green]
- **Disclaimer on every PDP + footer** — present (`DisclaimerBanner`, footer
  RUO line). [VERIFIED]
- **Legal pages** — Terms, Privacy, Shipping/Refunds, Disclaimer, COA Policy,
  Research-Use Policy all exist as routes + prerendered. [VERIFIED]

---

## What I could not determine (honest gaps)

- **Live RLS behavior** (C2) — needs a REST call from a networked host; the
  sandbox proxy blocks the project. SQL + curl provided.
- **Production DB migration state** — the RUNBOOK §1 self-check answers this;
  run it. `0025`/`0028`/`0029` postdate the seed and may be unapplied.
- **Live pricing render** — could not screenshot the deployed site (proxy 403);
  parity proven statically instead.

## Re-derivation of top 3 findings (second independent method)

1. **C1 escalation** — concluded from reading the policy, **confirmed by
   executing** the UPDATE in scratch PG (role→admin). ✓ two methods.
2. **Pricing parity** — concluded from a script comparing files, **confirmed by
   reading** the checkout path (server re-prices, fails closed). ✓
3. **PRs #9/#10 additive** — concluded from `--shortstat`, **confirmed by
   reading** `--diff-filter=D` (no route/query deletions). ✓
