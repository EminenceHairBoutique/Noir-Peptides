# Claude Opus 5 — Noir Peptides Full Audit
## PR forensics · migrations · pricing · functionality · compliance

> Run in Claude Code (`/model opus` — default on Max, strongest on Pro; needs v2.1.219+).
> Paste at the root of the Noir Peptides repo.
> Stack: React + Vite + JS/TS + Supabase + Vercel.

---

## MISSION

Audit this repo end to end. Find what's broken, what's unsafe to launch, and — critically —
which problems have which causes. Produce a report I can act on.

This prompt is written to be self-sufficient. Everything you need to proceed is below. If you
find yourself wanting to ask me a question, check the **Pre-answered questions** and **Fallbacks**
sections first — the answer is probably there. Default to proceeding.

## THE NEVER-BLOCK RULE

If any part of this audit is blocked — missing tool, missing access, ambiguous finding — note
the blocker, move to the next workstream, and return at the end. **Never stall the whole run
waiting on one thing.** A report covering four of five stages delivered now beats a complete one
that never arrives.

## PERMISSIONS

**Proceed freely, no need to ask:** reading any code or git history; running builds, linters,
and test suites; read-only database queries; writing new test files under `tests/audit/`;
taking screenshots; installing dev dependencies you need for analysis; creating scratch files;
drafting proposed SQL and patches (drafting ≠ applying).

**Ask me before:** modifying application code, applying a migration, running a seed against the
database, changing pricing data, altering the FK delete rule, committing, pushing.

**Never do, under any circumstance:** `DROP`, `TRUNCATE`, or `DELETE FROM` against the live
database; destructive re-seed; force-push; rewrite git history; commit secrets.

## FALLBACKS — use these instead of asking

| If this is unavailable | Do this |
|---|---|
| `gh` CLI missing or unauthenticated | Use `git log --merges`, `git show`, `git diff` against merge commits. PR numbers usually appear in merge commit messages ("Merge pull request #9 from…"). Don't ask me to install `gh`. |
| Direct database access | Write the SQL you need into the report with a note on what each possible result would mean. Continue other work. Don't wait. |
| Can't determine the Phase 4 baseline commit | Use the decision rule below. State your choice and move on. |
| `.env` values missing | Note which are absent and continue. Never ask me to paste secret values into chat. |
| A test suite fails to run | Report the failure as a finding and continue. A broken test harness is itself audit material. |
| Dev server won't start | Analyze statically, note that runtime verification was blocked, continue. |
| A screenshot/vision check isn't possible | Fall back to reading the render path in code and mark the finding *suspected* rather than *verified*. |

## PRE-ANSWERED QUESTIONS

Things you might otherwise stop to ask. Don't — here are the answers:

- **"Which commit is the Phase 4 baseline?"** Pick it yourself with this rule, in order: (1) a
  tag matching `phase.?4`; (2) the last commit whose message references completing Phase 4;
  (3) the merge commit immediately preceding PR #9. State which rule you used.
- **"Should I fix what I find?"** No. Audit and propose. I approve before changes.
- **"Should I commit the report?"** No. Leave it uncommitted.
- **"Is this a real business?"** Yes. It's a research-use-only laboratory-materials e-commerce
  site. Your task is software engineering, regulatory-disclosure review, and consumer-protection
  review — not chemistry. Nothing here requires reasoning about chemical properties or synthesis.
- **"Which price source is correct?"** That's the finding, not a precondition. Report the
  mismatch; don't pick a winner.
- **"How thorough should I be?"** Assume launch depends on this. Prefer completeness over speed,
  but respect the never-block rule.
- **"Should I keep going if I find something major?"** Yes. Note it prominently and continue.

## ESTABLISHED FACTS — ground truth, do not re-derive

Verified by live database inspection this week:

1. `supabase_migrations.schema_migrations` **does not exist** on the remote DB. The Supabase CLI
   was never linked. **No migration in `supabase/migrations/` has ever been applied via CLI.**
   Existing tables were created by hand-pasted SQL.
2. Live counts: `products` = 0, `label_configs` = 0.
3. The storefront still renders 44 items — it reads static files (`src/data/tier1Catalog.js`,
   `src/data/products.js`), not the database.
4. The admin label studio's product dropdown is populated from static data, so the `product_id`
   it submits violates `label_configs_product_id_fkey` (references `products`, `ON DELETE CASCADE`).

**The empty tables are NOT a code regression.** They're an infrastructure gap predating the PRs
under investigation. Keep these threads separate in your report — conflating them produces fixes
to code that was never broken.

---

## STAGE 1 — PR forensics after Phase 4

I suspect a merge around **PR #9 or #10** broke site behavior. Establish what changed between the
Phase 4 baseline and HEAD.

Produce a table of every merge since the baseline: PR number, title, merge date, files touched,
net lines changed. Then deep-dive #9 and #10 — intent versus actual effect — flagging anything
touching pricing, routing, data sources, checkout, or admin guards. Look for deleted files,
removed routes, removed queries, and migrations renumbered or edited after the fact.

Answer these four, each with "caused by a post-Phase-4 PR" or "was always this way," citing the
commit:
- Did the storefront switch from Supabase queries to static file imports?
- Did the label studio dropdown switch from a live `products` query to static data?
- Were routes removed or renamed (`/admin/labels`, `/admin/login`, `/reset-password`)?
- Were prices edited in any data file?

If a regression is confirmed but you can't localize it by inspection, bisect against a concrete
symptom and report the first bad commit.

**Verdict required:** what #9 and #10 each broke, what they didn't, and whether either is the
actual culprit or merely coincident in timing.

## STAGE 2 — Supabase migration audit

Inventory every migration: what it creates, alters, or seeds, and whether its DDL is idempotent
or would fail against the existing hand-built schema.

Find contradictions — duplicate table creation, columns added twice, out-of-order numbering, two
migrations seeding the same rows with different values or UUIDs.

**Resolve the blocking question:** are product IDs in the seed migrations (`0001`, `0009`)
hardcoded stable UUIDs, or generated at runtime? If generated, the `0020` label-config seed's
foreign keys can never resolve. State it plainly and propose deterministic IDs keyed on slug.

Reconcile migrations against the live schema (write me the SQL; don't wait for it) and report
drift in both directions.

Produce two artifacts:
- `scripts/manual-seed.sql` — consolidated, idempotent; data-only where tables exist,
  `IF NOT EXISTS` DDL where they don't; `ON CONFLICT DO NOTHING`; dependency order
  products → COAs → labels; verification counts at the end.
- A written procedure for baselining the CLI later without re-running colliding DDL.

Recommend changing `label_configs_product_id_fkey` to `ON DELETE RESTRICT` so future product
deletions fail loudly rather than silently destroying label history.

## STAGE 3 — Pricing integrity (highest business risk)

Prices live in multiple places. Find every source of truth: static data files, seed migrations,
any payment config, and whatever the cart and checkout actually read.

Build a comparison table across all 44 products — name/slug, price in each static file, price in
each migration, price used by the cart, price used at checkout — and flag every mismatch.

**Answer explicitly, yes or no: once `products` is seeded, will the price displayed on the card
match the price actually charged?** The storefront shows static prices ("FROM $44") while
checkout may resolve against the DB. A mismatch charges customers a different amount than
displayed — a launch blocker and a consumer-protection exposure, not a cosmetic bug.

Verify the variant matrix (5mg/10mg etc.) resolves consistently and that no variant silently
falls back to a default. Check dollars/cents confusion — `profiles.lifetime_spend_cents` proves
cents are in use somewhere, so confirm nothing multiplies or divides by 100 twice.

If you can render the app, screenshot the product grid and a detail page and verify displayed
prices against your table visually. If not, read the render path and mark findings *suspected*.

Recommend a single source of truth (DB-backed, static file demoted to seed input) and the path
to get there.

## STAGE 4 — Functionality

Enumerate every route and verify each renders — including `/admin/login`, `/admin/labels`,
`/reset-password`, `/auth/confirm`, catalog, product detail, cart, checkout.

`profiles` has both `role` (text) and `is_admin` (boolean). Report **which one the admin route
guard actually reads**, and whether the attestation gate (`attestation_completed_at`) can trap an
admin in a redirect loop.

List every component reading product data and whether it reads static files or Supabase. Trace
add-to-cart → cart state → checkout payload → order creation, and report what breaks when
`products` is empty — specifically whether orders can be created referencing nonexistent product
rows.

Run the build and existing suites (`scripts/test-labels.mjs`, `scripts/test-guardrail.mjs`,
`tests/e2e/shopper-journey.spec.js`). Flag any test passing only because it asserts against
static data — those are false green.

Confirm raw Postgres errors never reach end users. The label studio currently surfaces a bare FK
constraint string; find every similar leak.

## STAGE 5 — Regulatory disclosure & consumer protection (report only, don't fix)

- **COA presentation.** Cards read "COA ON REQUEST." Leading vendors in this category publish
  batch-specific certificates inline; "on request" is a known buyer red flag. Report whether
  `0019_janoshik_coas.sql` supplies the data to display them inline, and what wiring is missing.
- **Marketing copy.** Flag any product, category, or homepage text implying human use,
  therapeutic benefit, or physiological effect — file and line for each. Don't rewrite; I review
  the list first.
- **Attestation logging.** Confirm checkout attestations persist server-side with timestamp, IP,
  and the exact attested text.
- **AI endpoints.** Confirm they refuse dosing, administration-route, and human-use questions,
  and that tests cover those refusals.
- Confirm the research-use disclaimer renders on every product page and in the footer.

---

## VERIFICATION STANDARD

Mark every finding as **verified** (you executed something that proved it) or **suspected** (it
follows from reading code). I treat these differently — don't blur them.

Where you claim a route works, a guard blocks, or a price resolves, write a test under
`tests/audit/` that proves it and include the result.

Re-derive your top three findings by a second independent method: if you concluded it from code,
confirm by executing; if from a test, confirm by reading the code path.

Report what you couldn't determine and what access would be needed. An honest gap is more useful
than a confident guess.

## DELIVERABLES

`AUDIT_REPORT.md` at repo root, leading with:

1. **Verdict on PRs #9/#10** — one paragraph. What broke, what didn't.
2. **Launch blockers, ranked**, in three buckets that must not be merged: (a) code regressions
   from PRs, (b) the pre-existing migration/seed gap, (c) disclosure/compliance gaps. Different
   causes, different fixes.
3. **My action list** — what only I can do outside the repo: link the Supabase CLI, run the seed,
   fix the Supabase Site URL config, supply processor credentials.
4. **Blocked items** — anything the never-block rule made you skip, and what it needs.

Plus `scripts/manual-seed.sql` and any tests you wrote. Leave everything uncommitted.
