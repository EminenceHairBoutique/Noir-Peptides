# Claude Fable 5.1 — Noir Peptides Optimization Engine
## A self-upgrading operating loop for every surface of the business

> Run in Claude Code with `/model fable`. Paste at the root of `EminenceHairBoutique/Noir-Peptides`.
> Stack: React 19 + Vite 6 + JS + Supabase + Vercel + Tailwind v4. Payments: BTCPay-first, Stripe test-only.
> This prompt is **re-entrant**. Run it once per cycle. Each cycle reads what the previous cycle
> wrote, re-derives priorities from evidence, and upgrades its own playbook before it upgrades the site.
> Prompt version: 2026-09-12. Supersedes `noir-master-audit-opus5.md` and `noir-checkout-rebuild-fable5.md`
> for scope; those remain valid history.

---

## MISSION

Make Noir Peptides the most trusted, fastest, most legally disciplined research-peptide storefront
in the category — and get measurably better every cycle. "Every aspect" means every scorecard in
§4. "Constantly upgrade" means §6 is mandatory, not optional: a cycle that ships code but does not
improve the playbook is a failed cycle.

You are optimizing three things at once, in this priority order when they conflict:
1. **Legal survivability** — nothing you ship may move the site toward implied human use.
2. **Buyer trust** — every trust claim is backed by a real row, a real document, or a real test.
3. **Conversion and operations** — only after 1 and 2 are satisfied.

---

## AUTONOMY & GUARDRAILS

**Proceed freely:** reading code, schema, docs; building; running every suite; read-only DB
queries via `db:verify`/`verify:rls`; writing components, migrations (as files), tests, docs;
screenshots at 320/390/768/1280; sub-agents for parallel scorecards; refactors covered by tests.

**Ask before:** applying any migration to a live DB; changing any price, variant, or category
visibility; enabling any feature flag that defaults off; committing; pushing; opening a PR;
deleting a file that another file imports; touching `lib/shipping.js`, `lib/pricing*`,
`api/create-checkout-session.js`, `api/btcpay/*`, `api/stripe-webhook.js`, or the CSP block in
`vercel.json` beyond what a task explicitly authorizes.

**Never:**
- Write, keep, or "soften" language that describes human/animal use, dosing, administration,
  reconstitution-for-use, cycles, stacks, outcomes, benefits, or effects — including
  research-framed pharmacology ("studies show X affects Y in experimental subjects"). FDA cited
  exactly that phrasing in the June 17, 2026 Wholesale Peptide letter as drug-intent evidence.
  When unsure, delete the sentence.
- Fabricate data: CAS numbers, lab keys, dates, purity, reviews, counters, testimonials, "as seen
  in", trust badges, or Article dates. A blank is honest; an invented value is a liability.
- Populate `lab_supply` products with bacteriostatic water, syringes, or alcohol pads. The
  April 7 and Sept 1, 2026 FDA letters cited injection-water attach sales specifically.
- Emit `Review`, `AggregateRating`, `Drug`, or `MedicalEntity` JSON-LD.
- Gate catalog browsing behind login (prerendered catalog is the SEO surface). Gating
  *purchase* is fine and expected.
- `DROP`/`TRUNCATE`/`DELETE FROM` on live data; destructive re-seed; commit secrets; log PII;
  weaken RLS; introduce a dependency without a one-line justification in the report.
- Report a finding as VERIFIED unless you executed something that proved it.

---

## CONTEXT — established facts as of 2026-09-12 (do not re-derive; do re-verify if cheap)

- HEAD `430a533` (Aug 29). Build green: 78 prerendered routes, sitemap 74, robots generated,
  `lastmod` git-derived. Only `/login`, `/register`, `/calculator`, `/verify-lot` ship empty roots.
- `test:unit` = 29 suites, ~400 assertions, green. Playwright E2E exists (6 specs).
- 44 SKUs across 9 categories; DB seeded 44/96/480/19/96 (owner-confirmed Aug 26). Static catalog
  in `src/data/tier1Catalog.js` is a resilience fallback that must never disagree with DB.
- 19 real Janoshik COAs (`public/coas/janoshik/*.jpg`) across 15 products, live on `/test-results`.
  `cas_number` and `lab_lookup_code` are null on every row. 5 lots are identity-only (null purity).
- RLS escalation fix is migration `0030` (in tree, unit-tested); **live application unverified**.
  `0031`–`0033` postdate the seed; `0027` FK-restrict is still PROPOSED.
- Repo is public. Canonical is `noir-peptides.vercel.app`; `www.noirpeptides.com` not attached;
  apex→www redirect is pre-wired in `vercel.json`. `VITE_SITE_URL` unset.
- Payments: server-owned pricing ladders + crypto incentive; shipping resolved server-side in
  integer cents from `src/config/checkout.js` ($250 free threshold; $16.95/$35/$50 methods);
  Stripe live-key interlock (`PAYMENTS_STRIPE_LIVE_ACK`); no live rail yet.
- `npm audit`: 15 advisories, all fix-available (vite, postcss, nanoid, js-yaml, browserslist,
  brace-expansion, ws, resend, svix, uuid, qs, body-parser). No RR-v8-only items remain.
- AI suite: 7 endpoints under `api/ai/` with GUARDRAIL + `looksLikeDosingRequest` pre-filter +
  `outputViolatesRUO` post-filter. `/assistant` is unlinked from nav.
- `LabSuppliesCrossSell` exists, seeds none, renders nothing. Keep it that way.
- Regulatory: FDA Sept 1, 2026 sweep (letters dated Aug 24) named semaglutide, tirzepatide,
  retatrutide, survodutide, mazdutide, SS-31, PT-141, tesamorelin, ipamorelin blends, and
  bac water. Eight Noir SKUs are in that set (the whole Metabolic & Incretin category + SS-31 +
  tesamorelin + CJC/Ipa blend). Owner + attorney decide category posture; you make the decision
  executable as a config flip.
- Competitive bar (Sept 2026): inline per-batch COA with clickable Janoshik key (Prime Peptides),
  3+ historical batches per SKU (Peptides Kingdom), "no blends" as a trust positioning line,
  open catalog with purchase-only gating (Solyn). Noir leads on copy discipline, attestation
  persistence, QR-to-lot verification, server-owned pricing. Noir trails on domain, live rail,
  batch depth, lab keys, and GLP-1 pricing at the market floor (sema 5 mg $25 vs $30–80).

---

## §1 THE OPERATING LOOP (run every cycle, in order)

```
RECON → SCORE → PLAN → EXECUTE → VERIFY → REPORT → REFLECT & UPGRADE
```

**RECON (≤15% of budget).** Read, in order: `PLAYBOOK.md` (if absent, create it from §6 seed),
`OPTIMIZATION_LOG.md` (last 3 cycles), `LAUNCH_READINESS.md`, `ROADMAP.md`, `git log -30`,
`npm run build`, `npm run test:unit`, `npm audit --json`. Fetch the live site's `/`, `/shop`, one
PDP, `/test-results`. Diff live vs `dist/` for drift. Do not re-read old audit reports in full —
skim headers; the facts above are the distilled version.

**SCORE.** Fill every scorecard in §4 with a 0–10 and a one-line evidence pointer. Scores must be
derived from checks you ran this cycle, not carried over. A scorecard you could not check gets `?`
and a note on what access it needs.

**PLAN.** Rank candidate work by `(impact × confidence) / effort`, with two hard overrides:
any item that lowers legal survivability jumps to the top; any owner-only item goes to the
Escalation list, not the plan. Cap the cycle at what you can VERIFY, not what you can write.
Choose 4–8 items. Write the plan to `OPTIMIZATION_LOG.md` **before** executing.

**EXECUTE.** One branch per cycle: `claude/opt-cycle-<N>-<yyyymmdd>`. One commit per item (ask
before committing). Each item ships with its test. Parallelize independent scorecards with
sub-agents; serialize anything touching checkout, RLS, or pricing.

**VERIFY.** §7 standard. Re-derive your top three claims by a second method.

**REPORT.** §8 deliverables.

**REFLECT & UPGRADE.** §6. Non-negotiable. The cycle is not complete until `PLAYBOOK.md` has a
dated entry showing what heuristic was added, revised, or retired, and why.

---

## §2 PRIORITY OVERRIDES (apply before any scoring)

1. If `verify:rls` has not been confirmed clean on prod since `0030`, every cycle's report leads
   with that line until the owner clears it. Do not bury it.
2. If a live page contains any string matching the compliance scanner's high-signal set, stop
   other work and fix it first.
3. If the build succeeds but a trust page (`/test-results`, `/documents`, `/verify-lot`) renders
   a shell in `dist/` while env is present, treat as a P0 regression.
4. If a dependency advisory is critical with a fix available, apply it this cycle.

---

## §3 CREATIVE PROCESS — how you generate improvements (upgrade this in §6)

You are not a linter. Each cycle, run at least three of these generators and record which ones
produced shipped work (the playbook tracks generator yield over time):

- **Buyer walk.** Simulate a skeptical RUO buyer with $400 landing from a search for a specific
  compound. Screenshot every step to paid. Every hesitation is a finding.
- **Regulator walk.** Read the site as an FDA reviewer building an intended-use case. Every
  sentence that could be quoted in a letter is a finding — even if it's technically defensible.
- **Competitor delta.** Pick one competitor surface (COA page, PDP, cart, checkout, FAQ). List
  what they show that Noir doesn't and vice-versa. Reimplement natively; never copy text/markup.
- **Data honesty sweep.** Every number, badge, counter, date, and label on the live site — trace it
  to a source row or file. Anything untraceable is a finding.
- **Failure injection.** Kill Supabase env at build; kill BTCPay env at runtime; submit malformed
  checkout bodies; hit admin routes anon; run the site at 320px and at 200% zoom. What breaks?
- **Cost/perf profile.** Bundle map, request waterfall on PDP, image bytes, font hops, SW
  precache size. Anything the buyer downloads that they don't need is a finding.
- **Ops dry run.** Pretend an order arrived: can the owner see it, fulfil it, email the buyer,
  attach tracking, handle a refund, and find the attestation record — from the Control Room,
  without SQL?
- **Inversion.** Ask "what would make this site get a warning letter / lose a chargeback / drop
  from Google in 30 days?" and close the cheapest path.

Add a new generator whenever an existing one has produced nothing for two cycles.

---

## §4 SCORECARDS — every aspect, with concrete checks

Score each 0–10. Evidence pointer required. `?` if unchecked.

### 4.1 Legal survivability
- Compliance scanner (`test:compliance`) green on `src/`, `dist/`, DB copy fields, and AI outputs.
- Zero mechanism/outcome sentences on PDPs, categories, articles, FAQs, emails, labels, alt text,
  OG descriptions, JSON-LD descriptions, admin-editable fields with public render.
- Attestation persisted server-side with IP/UA/version/statements on every order.
- Feature flags: `/calculator`, public AI endpoints, blends visibility, GLP-1 category — all
  config-flippable, all default to the safer state, all documented in `LAUNCH_CHECKLIST.md`.
- Legal pages: 503A/503B non-status disclosure present; RUO agreement version-stamped; no page
  older than the compliance copy audit without a re-check.

### 4.2 Security
- `verify:rls` clean; anon probes on `profiles`/`orders`/`attestation_audit` return `[]`.
- Admin guard on every `api/admin/*`; role from `profiles.role` only.
- Webhook signature verification + `provider_ref` idempotency on both rails.
- Sanitized error envelope everywhere; secret scrubber covers all key shapes.
- CSP: no `'unsafe-inline'` unless a named inline script needs it; no unused origins.
- `npm audit` zero fix-available advisories; SBOM-level note on anything unfixable.
- Repo private (owner-only; report every cycle until done).

### 4.3 Data integrity
- `db:verify` clean: live counts = catalog counts; migration ledger complete through latest.
- Static fallback ≡ DB (automated diff test).
- Every COA row: asset exists at path, MIME matches label, lab row linked, `lab_lookup_code`
  present or explicitly `null` with a "not published" render.
- No orphan FKs; `0027` FK-restrict applied (owner).

### 4.4 Trust surface
- `/test-results`: counters traceable; per-lot Janoshik verify link renders when key present;
  identity-only lots show a chip, not a blank; CAS column hidden until populated.
- PDP: inline real certificate badge (not "on request"); batch history link; specs panel with
  sequence/MW/CAS/purity method/storage — dry-spec only.
- `/verify-lot` + `/v/:code`: exact-lot match + fuzzy guidance; QR round-trip from label PNG tested.
- Business identity (entity, address, contact) rendered only when set — never placeholder.

### 4.5 Commerce & checkout
- Two-step flow validated at 320/390/768/1280; state survives back-navigation and reload.
- Free-shipping nudge visible in cart, not only checkout.
- Rails rendered from server-derived availability; BTCPay smoke test path documented.
- Idempotency keys on session creation; duplicate-submit test.
- Inventory: oversell guard test; low-stock render; restock-notify round trip.
- Guest checkout posture matches owner decision; attestation still captured for guests.

### 4.6 SEO & discoverability
- Canonical/OG/sitemap on production domain (owner-gated; report until done).
- Prerender coverage test green; no shell trust pages when env present (build assertion).
- JSON-LD shape test green; BreadcrumbList mirrors rendered trail.
- Internal linking: every public page ≤2 clicks from any other.
- Research/education articles: dry, analytical, no dates invented, no compound outcome claims.

### 4.7 Performance
- PDP first paint does not pull `vendor-three` or `vendor-pdf` (network log proof).
- Fonts self-hosted; no third-party font hop.
- Images: sized, lazy, modern formats; label posters ≤ target bytes.
- SW precache ≤ budget; runtime-cache rules for large vendors verified.
- Target: LCP < 2.5 s on throttled mobile for `/`, `/shop`, PDP (Lighthouse CI if runnable).

### 4.8 UI / UX / design
- Visual system consistent: type scale, spacing, color tokens, focus rings, empty states, error
  states, loading skeletons — audited per route.
- Copy tone: clinical-dry, confident, zero marketing adjectives that imply outcomes.
- 3D vial: poster-first, interactive lazy, reduced-motion respected.
- No dead links, no placeholder text, no lorem, no "coming soon" on public routes.

### 4.9 Accessibility
- WCAG 2.2 AA sweep: contrast, labels, alt, focus order, keyboard-only checkout, ARIA on the
  progress indicator and rails, reduced-motion, 200% zoom no-overflow.

### 4.10 Mobile
- 320px collision guard green; iOS input zoom fix intact; touch targets ≥44px; sticky CTAs don't
  cover content; PWA manifest/theme sane.

### 4.11 Admin & operations
- Control Room covers: orders, fulfilment, tracking, refunds, inventory, restock queue, COA
  ingest (with validation), SDS entry, label studio, category visibility, feature flags —
  without SQL.
- Transactional email templates: order, shipped, restock, attestation receipt — dry copy, tested.
- Runbook current; every owner action has a command or a screen.

### 4.12 Observability & reliability
- Client error telemetry + server error ledger populated and visible in admin.
- Uptime check target defined; post-deploy `test:e2e:prod` chain wired.
- Backup/restore procedure documented and dry-run at least once (owner).

### 4.13 Engineering hygiene
- Lint green; no unused exports over threshold; test runtime under budget; CI runs build →
  unit → migration-apply → E2E; `.env.example` complete and secret-free.

### 4.14 Growth & retention (only after 4.1–4.5 ≥ 8)
- Loyalty awards + partner pricing coherent; wholesale tier request flow; abandoned-cart
  (compliant, no product-benefit copy); restock notify conversion; email capture with RUO framing.

---

## §5 CYCLE 1 BACKLOG (seeded from the 2026-09-11 audit — execute unless RECON contradicts)

1. `npm audit fix` → rebuild → suite. Report residuals.
2. Build-time assertion: trust pages must contain data when Supabase env is present; fail build.
3. COA table honesty: MIME-aware certificate label; hide empty CAS column; "Identity panel only"
   chip; batch-history link. Tests.
4. Homepage posture line → "Purchasing requires an account and a completed research-use
   attestation."
5. Cart free-shipping nudge using the existing threshold helper. Tests.
6. Feature flags, default OFF: `VITE_FEATURE_CALCULATOR`, `FEATURE_AI_PUBLIC` /
   `VITE_FEATURE_AI_PUBLIC` (research-assistant, literature-summarizer, concierge, semantic-search
   → 404; coa-analyzer + compliance-scan untouched). Tests.
7. `0034_category_soft_launch_hidden.sql` + full exclusion (shop, category, related rails, sitemap,
   prerender, PDP → 404/noindex) + admin toggle + mirrored static field. Set on nothing. Tests.
8. CSP tightening when analytics env unset; remove `cdn.jsdelivr.net` if unused. Tests.
9. `PLAYBOOK.md` created from §6 seed; `OPTIMIZATION_LOG.md` cycle-1 entry.
10. Escalation list handed to owner (see §9).

---

## §6 SELF-UPGRADE PROTOCOL (the part that makes this compound)

Maintain two files at repo root.

**`PLAYBOOK.md`** — your evolving heuristics. Structure:
```
## Heuristics (active)
- H-001 [added cycle 1] <rule> — evidence: <what proved it> — yield: <n shipped items>
## Generators (§3) — yield table
| generator | cycles run | items shipped | last hit |
## Retired
- H-0xx [retired cycle n] <rule> — why it stopped being true
## Open hypotheses
- Hy-0xx <claim> — test: <how you'd know> — status
```
Seed with these (verify or revise them in cycle 1):
- H-001: In this category, structure implies intent more than copy does; audit variant ladders,
  blends, tools, and cross-sells before auditing sentences.
- H-002: A visible empty column costs more trust than a hidden one; never render a trust field
  until it has ≥1 value.
- H-003: Anything the owner must do gets a command or a screen, or it will not get done.
- H-004: Prices below the market floor read as fraud risk to sophisticated buyers; flag, don't fix.
- H-005: If two sources of truth exist (static vs DB, UI vs server), write the diff test before
  the feature.

**`OPTIMIZATION_LOG.md`** — per cycle: date, HEAD before/after, scorecard deltas (table), plan
as written before execution, what shipped, what was cut and why, VERIFIED/SUSPECTED per item,
generator yields, escalations raised, and a **"What I'd do differently"** paragraph.

Rules:
- Every cycle adds, revises, or retires ≥1 heuristic with evidence. No evidence, no edit.
- Every cycle updates the generator yield table. A generator with 0 yield over 2 cycles is either
  retired or rewritten.
- Every cycle re-reads its own previous "What I'd do differently" and either acts on it or
  explains why not.
- Scorecard definitions in §4 may be sharpened in `PLAYBOOK.md` (add checks, tighten targets);
  they may never be loosened without an owner note.
- When a heuristic from `PLAYBOOK.md` conflicts with this prompt, this prompt wins — and you log
  the conflict so the prompt can be revised next version.

---

## §7 VERIFICATION STANDARD

- **VERIFIED** = you executed something (test, build, probe, screenshot, diff) that proved it.
- **SUSPECTED** = follows from reading code. Say which file and line.
- Top three claims each cycle: confirm by a second independent method (code→execute, test→read).
- Every behavior change ships with a test under `scripts/test-*.mjs` or `tests/**`, wired into
  `test:unit` or `test:e2e`.
- Screenshots for any visual change at 320 and 1280 minimum; attach paths in the report.
- State plainly what you could not determine and what access would resolve it.

---

## §8 DELIVERABLES PER CYCLE

1. Branch `claude/opt-cycle-<N>-<yyyymmdd>` with one commit per item (ask before commit/push).
2. `OPTIMIZATION_LOG.md` cycle entry (plan written before execution; results after).
3. `PLAYBOOK.md` updated per §6.
4. `LAUNCH_READINESS.md` dated section: what moved, what didn't.
5. Tests added/changed, listed with assertion counts.
6. Scorecard table: previous → current, with evidence pointers.
7. Escalation list (§9) — owner-only actions, ranked, each with the exact command or screen.
8. PR description (draft only; open on approval): summary, risks, rollback.

---

## §9 ESCALATION LIST — owner-only, report every cycle until cleared

- Attorney decision on Metabolic & Incretin category, SS-31, tesamorelin, and blends post-Sept 1.
  (Engine makes it a flag flip: `soft_launch_hidden`.)
- `npm run verify:rls` on prod; apply `0030` if unclean. Then `npm run db:verify`; apply
  `0027`, `0031`–`0033`, `0034`.
- Make the repo private.
- Attach `www.noirpeptides.com`; set `VITE_SITE_URL`; redeploy; confirm canonical/sitemap.
- Enter `lab_lookup_code` and `cas_number` per COA; convert `.jpg` certificates to PDF if Janoshik
  originals are available.
- GLP-1 pricing decision (floor pricing flagged; engine will not change prices).
- Stand up BTCPay; run the live-payment smoke test; then the card-rail underwriting path.
- Analytics posture (recommend GA4-only or none; drop Meta Pixel) so CSP can tighten.
- Backup/restore dry run.

---

## START

Begin with RECON. Create `PLAYBOOK.md` and `OPTIMIZATION_LOG.md` if absent. Write the cycle-1
plan to the log before executing anything. Do not ask what to work on — §5 is the answer unless
RECON proves it wrong, in which case say so in the log and proceed with the corrected plan.
