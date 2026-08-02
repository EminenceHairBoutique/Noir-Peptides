# Claude Opus 5 — Noir Peptides Master Audit & Roadmap
## Repo + live site: forensics · database · pricing · functionality · security · SEO · compliance · roadmap

> Run in Claude Code (`/model opus` — default on Max; needs v2.1.219+).
> Paste at the root of the Noir Peptides repo.
> Stack: React + Vite + JS/TS + Supabase + Vercel.

---

## MISSION

Audit this repo and the deployed site end to end, then propose what to build next. Two outputs:
a findings report I can act on, and a prioritized roadmap.

This prompt is self-sufficient. If you want to ask me something, check **Pre-answered questions**
and **Fallbacks** first — the answer is probably there. Default to proceeding.

## THE NEVER-BLOCK RULE

If anything is blocked — missing tool, missing access, ambiguous finding — note it, move to the
next workstream, return at the end. **Never stall the whole run on one item.** Six of eight
stages delivered now beats a complete report that never arrives.

## PERMISSIONS

**Proceed freely:** reading any code or git history; running builds, linters, test suites;
read-only database queries; writing new tests under `tests/audit/`; taking screenshots;
installing dev dependencies for analysis; scratch files; drafting proposed SQL and patches
(drafting ≠ applying).

**Ask me before:** modifying application code, applying a migration, running a seed against the
database, changing pricing data, altering the FK delete rule, committing, pushing.

**Never, under any circumstance:** `DROP`, `TRUNCATE`, or `DELETE FROM` against the live
database; destructive re-seed; force-push; rewrite git history; commit secrets; print a full
secret value in output (mask as `eyJh…9x2A`).

## FALLBACKS — use these instead of asking

| Unavailable | Do this |
|---|---|
| `gh` CLI missing/unauthenticated | Use `git log --merges`, `git show`, `git diff`. PR numbers appear in merge commit messages. Don't ask me to install it. |
| Direct database access | Write the SQL into the report with what each result would mean. Continue other work. |
| Phase 4 baseline unclear | Use the decision rule below, state your choice, move on. |
| `.env` values missing | Note which are absent, continue. Never ask me to paste secrets into chat. |
| Test suite won't run | Report as a finding and continue — a broken harness is audit material. |
| Dev server won't start | Analyze statically, mark runtime findings *suspected*, continue. |
| Can't render/screenshot | Read the render path instead; mark *suspected*. |
| Live site unreachable | Audit the repo only; note which findings need live verification. |

## PRE-ANSWERED QUESTIONS

- **"Which commit is the Phase 4 baseline?"** Pick it: (1) a tag matching `phase.?4`; (2) the
  last commit whose message references completing Phase 4; (3) the merge commit immediately
  before PR #9. State which rule you used.
- **"Should I fix what I find?"** No. Audit and propose. I approve before changes.
- **"Should I commit the report?"** No.
- **"What is this business?"** A research-use-only laboratory reference-materials e-commerce
  site. Your work here is software engineering, security review, and regulatory-disclosure
  review — not chemistry. Nothing requires reasoning about chemical properties or synthesis.
- **"Which price source is correct?"** That's the finding, not a precondition. Report the
  mismatch; don't pick a winner.
- **"Should I keep going after finding something major?"** Yes. Flag it prominently, continue.
- **"How ambitious should the roadmap be?"** Very. Include things I haven't thought of. Rank by
  impact-to-effort, and mark anything that's a launch blocker versus a later improvement.

## ESTABLISHED FACTS — ground truth, do not re-derive

Verified by live inspection this week:

1. `supabase_migrations.schema_migrations` **does not exist** on the remote DB. The Supabase CLI
   was never linked. **No migration in `supabase/migrations/` has ever been applied via CLI.**
   Existing tables were created by hand-pasted SQL.
2. Live counts: `products` = 0, `label_configs` = 0.
3. The storefront still renders 44 items — it reads static files (`src/data/tier1Catalog.js`,
   `src/data/products.js`), not the database.
4. The admin label studio's product dropdown is populated from static data, so the `product_id`
   it submits violates `label_configs_product_id_fkey` (references `products`, `ON DELETE CASCADE`).
5. The deployed site is client-side rendered — fetching it returns `<head>` only, no body. It is
   not indexed by search engines.
6. `profiles` has both `role` (text) and `is_admin` (boolean); which one the admin guard reads is
   unconfirmed.

**The empty tables are NOT a code regression** — they're an infrastructure gap predating the PRs
under investigation. Keep these threads separate; conflating them produces fixes to code that was
never broken.

---

# PART 1 — AUDIT

## STAGE 1 — PR forensics after Phase 4

I suspect a merge around **PR #9 or #10** broke site behavior. Establish what changed between the
Phase 4 baseline and HEAD.

Produce a table of every merge since: PR number, title, merge date, files touched, net lines.
Deep-dive #9 and #10 — intent vs. actual effect — flagging anything touching pricing, routing,
data sources, checkout, or admin guards. Look for deleted files, removed routes, removed queries,
and migrations renumbered or edited after being written.

Answer each with "caused by a post-Phase-4 PR" or "was always this way," citing the commit:
- Did the storefront switch from Supabase queries to static file imports?
- Did the label studio dropdown switch from a live `products` query to static data?
- Were routes removed or renamed (`/admin/labels`, `/admin/login`, `/reset-password`)?
- Were prices edited in any data file?

If a regression is confirmed but not localizable by inspection, bisect against a concrete symptom
and report the first bad commit.

**Verdict required:** what #9 and #10 each broke, what they didn't, and whether either is the real
culprit or merely coincident.

## STAGE 2 — Database & migrations

Inventory every migration: what it creates, alters, or seeds; whether its DDL is idempotent or
would fail against the existing hand-built schema.

Find contradictions — duplicate table creation, columns added twice, out-of-order numbering, two
migrations seeding the same rows with different values or UUIDs.

**Resolve the blocking question:** are product IDs in `0001`/`0009` hardcoded stable UUIDs or
generated at runtime? If generated, `0020`'s label-config foreign keys can never resolve. State it
plainly; propose deterministic IDs keyed on slug.

Reconcile migrations against the live schema (write me the SQL; don't wait) and report drift both
directions.

Produce:
- `scripts/manual-seed.sql` — consolidated, idempotent; data-only where tables exist,
  `IF NOT EXISTS` DDL where they don't; `ON CONFLICT DO NOTHING`; dependency order
  products → COAs → labels; verification counts at the end.
- A written procedure to baseline the Supabase CLI later without re-running colliding DDL.

Recommend `ON DELETE RESTRICT` for `label_configs_product_id_fkey` so future product deletions
fail loudly instead of silently destroying label history.

## STAGE 3 — Pricing integrity (highest business risk)

Find every price source: static data files, seed migrations, payment config, and whatever cart and
checkout actually read.

Build a comparison table across all 44 products — name/slug, price in each static file, price in
each migration, price used by cart, price used at checkout — flagging every mismatch.

**Answer explicitly, yes or no: once `products` is seeded, will the price displayed on the card
match the price actually charged?** The storefront shows static prices ("FROM $44") while checkout
may resolve against the DB. A mismatch charges customers a different amount than displayed — a
launch blocker and consumer-protection exposure, not a cosmetic bug.

Verify the variant matrix (5mg/10mg etc.) resolves consistently and no variant silently falls back
to a default. Check dollars/cents confusion — `profiles.lifetime_spend_cents` proves cents are in
use somewhere; confirm nothing multiplies or divides by 100 twice.

If you can render the app, screenshot the grid and a detail page and verify displayed prices
against your table visually.

## STAGE 4 — Functionality

Enumerate every route and verify each renders — including `/admin/login`, `/admin/labels`,
`/reset-password`, `/auth/confirm`, catalog, product detail, cart, checkout.

Report **which column the admin route guard actually reads** (`role` or `is_admin`), and whether
the attestation gate (`attestation_completed_at`) can trap an admin in a redirect loop.

List every component reading product data and whether it reads static files or Supabase. Trace
add-to-cart → cart state → checkout payload → order creation; report what breaks when `products`
is empty, and whether orders can reference nonexistent product rows.

Run the build and existing suites (`scripts/test-labels.mjs`, `scripts/test-guardrail.mjs`,
`tests/e2e/shopper-journey.spec.js`). Flag any test passing only because it asserts against static
data — those are false green.

Confirm raw Postgres errors never reach end users. The label studio currently surfaces a bare FK
constraint string; find every similar leak.

**Auth flows:** confirm `/reset-password` handles both the PKCE `code` exchange and the legacy
hash-fragment recovery token, and that `/auth/confirm` routes new signups through the attestation
gate rather than into a guard bounce. Grep for any hardcoded origin (`localhost:3000`) in
`redirectTo` / `emailRedirectTo` values.

## STAGE 5 — Security & opsec

**Client bundle.** Vite inlines any `VITE_`-prefixed variable into public JS — the prefix is the
only thing controlling exposure. Build, then scan `dist/` for secret patterns (`sk_live`,
`service_role`, private keys, cloud access keys). Decode every `eyJ…` JWT found and confirm the
only one present has role `anon`. Separately, grep source and env files for `VITE_` next to
`secret|service|private|password|api_key|token` — a server secret given a `VITE_` prefix to
silence an error is the classic cause.

**RLS, verified empirically.** The anon key is public by design; that's safe only if RLS actually
blocks it. For `profiles`, `orders`, `attestations`, and anything holding emails, legal names, IPs,
or addresses: issue an unauthenticated REST request with only the anon key and report whether rows
come back. Any rows returned = world-readable customer data. Also write me the SQL to dump
`pg_policies` for these tables, and flag the specific danger: an UPDATE policy on `profiles` using
only `auth.uid() = id` with **no `WITH CHECK` protecting `is_admin`/`role`** lets any logged-in
user escalate themselves to admin through ordinary app calls. Propose a column-restricted policy.

**Git history.** Check whether env files are or ever were tracked; search history for committed
secrets (`git log -p --all -S 'sk_live'` etc.). Anything found goes on a rotation checklist —
rotation, not deletion, is what neutralizes it.

**Headers & build.** Report missing `Strict-Transport-Security`, `Content-Security-Policy`,
`X-Content-Type-Options`, `X-Frame-Options`/`frame-ancestors`, `Referrer-Policy`. Confirm
production source maps are disabled and no `.map` files ship to `dist/`. Provide a ready-to-paste
`vercel.json` headers block.

**Repo exposure.** Report whether the repo is public, whether its name/description/homepage ties
this project to the owner's other named brands, and whether commit authorship exposes a real
identity. Recommend concrete steps to break the link if so.

Produce `ROTATION_CHECKLIST.md` for every credential needing rotation, in order.

## STAGE 6 — SEO & indexability

The site is client-side rendered and effectively invisible to crawlers — the single highest-impact
technical fix available.

Assess the cost and approach for SSR or build-time prerendering of all public routes (home,
categories, every product page) — `vite-react-ssg`, a Vercel prerender step, or a framework
migration. Recommend one with reasoning and effort estimate.

Verify that title, description, canonical, and OG tags land in *static* HTML rather than being
injected after hydration. Check for a generated `sitemap.xml`, a `robots.txt` referencing it, and
JSON-LD `Product` + `Organization` structured data in served HTML.

Report every domain/deployment currently live for this brand and recommend a single canonical host
with 301s from the rest.

**AI crawler policy.** Propose a `robots.txt` distinguishing training crawlers (GPTBot, ClaudeBot,
Google-Extended, CCBot, Bytespider, Applebot-Extended) from retrieval/citation crawlers
(OAI-SearchBot, ChatGPT-User, PerplexityBot) that drive referral traffic. Verify current
user-agent names against each vendor's official crawler documentation before finalizing — guidance
in third-party articles conflicts and goes stale. Disallow `/admin/` and `/api/` for all agents.

## STAGE 7 — Regulatory disclosure & consumer protection (report only, don't fix)

- **COA presentation.** Cards read "COA ON REQUEST." Leading vendors publish batch-specific
  certificates inline; "on request" is a known buyer red flag. Report whether
  `0019_janoshik_coas.sql` supplies the data to display them inline and what wiring is missing.
- **Copy review.** Flag any product, category, or homepage text implying human use, therapeutic
  benefit, or physiological effect — file and line for each. Don't rewrite; I review the list first.
- **Attestation logging.** Confirm checkout attestations persist server-side with timestamp, IP,
  and the exact attested text.
- **AI endpoints.** Confirm they refuse dosing, administration-route, and human-use questions, and
  that tests cover those refusals.
- Confirm the research-use disclaimer renders on every product page and in the footer.
- Confirm Terms, Privacy, Shipping, and Refund pages exist and are linked.

---

# PART 2 — ROADMAP

## STAGE 8 — Upgrades, features, and hardening

Propose what to build next. Use the seeds below as a starting point, then **add your own** based on
what you actually find in the code — you'll see opportunities I can't. For each item give: what it
is, why it matters here, effort (S/M/L), and whether it's a launch blocker or a later improvement.

**Trust & differentiation** (the competitive moat in this category)
- Batch-specific COA display per product, with named lab and test date.
- Public COA library at `/test-results`, filterable.
- Lot-number lookup + per-lot QR so a buyer can verify the vial in their hand against the published
  certificate. This is the single strongest differentiator available.
- Technical datasheets per compound: sequence, molecular weight, CAS, purity method, storage and
  handling, solubility. Dry specification content is both the compliant framing and what
  sophisticated buyers actually want.
- Linked literature references (e.g. PubMed) per compound.

**Commerce**
- The schema already has `account_tier`, `partner_status`, `partner_tier`, `loyalty_points`,
  `lifetime_spend_cents`, `first_purchase_bonus_awarded` — report what's implemented vs. dormant,
  and propose completing wholesale/partner tiering and loyalty.
- Inventory management with low-stock alerts; make "IN STOCK" badges reflect real quantities rather
  than static text.
- Order tracking, fulfillment workflow, transactional email.
- Guest checkout, abandoned-cart recovery, restock notifications.

**Payments** (architecture matters more than any single processor)
- A provider-abstraction layer (`createCharge`, `getStatus`, `handleWebhook`, `refund`) so a
  processor can be swapped by config — termination in this vertical is when-not-if.
- Self-hosted BTCPay Server as the primary rail (non-custodial, no chargebacks, BTC/ETH/USDC).
- An adapter for an honestly-underwritten high-risk card processor; Apple/Google Pay ride on that
  processor as tokenized cards, not as separate rails.
- ACH/eCheck as a third rail.
- **Do not implement any flow that disguises the nature of the transaction from card networks or
  issuing banks** (card-to-stablecoin "on-ramp" gateways marketed to this vertical). Represent the
  business accurately to every processor.
- Webhook signature verification and idempotency keys on every payment path.

**Admin**
- COA upload UI so certificates don't require SQL.
- Label studio fixes: live product query, human-readable errors, and the label field-fill
  automation (two-tier template selection, auto-filled quantity/CAT/storage/composition/LOT/
  barcode/QR).
- Admin action audit log; 2FA for admin accounts; rate limiting on auth endpoints.

**Platform & reliability**
- Link the Supabase CLI and establish migration discipline so schema drift stops recurring.
- CI that runs build + tests + a migration-applies-cleanly check on every PR.
- A real staging environment separate from production data.
- Error monitoring (Sentry or equivalent), uptime monitoring, and verified backup restores.
- Performance: image optimization, code splitting, caching.

**Note on scope discipline:** flag anything that would push product content toward implying human
use — that constraint governs the roadmap as much as it governs existing copy.

---

## VERIFICATION STANDARD

Mark every finding **verified** (you executed something that proved it) or **suspected** (it
follows from reading code). Don't blur them.

Where you claim a route works, a guard blocks, or a price resolves, write a test under
`tests/audit/` proving it, and include the result.

Re-derive your top three findings by a second independent method: concluded from code → confirm by
executing; concluded from a test → confirm by reading the path.

Report what you couldn't determine and what access it would need. An honest gap beats a confident
guess.

## DELIVERABLES

Write to repo root, uncommitted:

1. **`AUDIT_REPORT.md`** — Stages 1–7, leading with:
   - Verdict on PRs #9/#10, one paragraph: what broke, what didn't.
   - **Launch blockers, ranked, in four buckets that must not be merged:** (a) code regressions
     from PRs, (b) the pre-existing migration/seed gap, (c) security exposures, (d) compliance and
     disclosure gaps. Different causes, different fixes, different urgency.
   - Blocked items and what they need.
2. **`ROADMAP.md`** — Stage 8, ranked by impact-to-effort, launch blockers separated from
   improvements.
3. **`ROTATION_CHECKLIST.md`** — credentials to rotate, in order.
4. **`scripts/manual-seed.sql`** and any tests written.
5. **My action list** — what only I can do: link the Supabase CLI, run the seed, fix the Supabase
   Site URL config, register a domain/trademark, supply processor credentials.
