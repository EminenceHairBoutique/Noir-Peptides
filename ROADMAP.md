# Noir Peptides — Roadmap (audit-derived)

Ranked by impact-to-effort. **🔴 Launch blocker** must ship before real money.
Effort: S (<½ day) · M (1–3 days) · L (week+). Items marked ✅ are **already
built** (Phases 6–11 this project) and listed so the roadmap reflects reality.

## 🔴 Launch blockers (must merge first)

| # | Item | Why | Effort |
| --- | --- | --- | --- |
| **B1** | **Fix `profiles` UPDATE RLS (self-write escalation).** Apply `scripts/proposed-fix-profiles-rls.sql`. | Any logged-in user can self-write `role`→admin, `loyalty_points`→999999 (free money), `attestation_completed_at` (bypass the RUO wall), and `account_tier`→partner — via the public REST API. All four proven; fix validated. | **S** |
| **B2** | **Live RLS probe** of `profiles`/`orders`/`attestation_audit` with the anon key; confirm `[]`. | If any return rows, customer PII (emails, legal names, IPs, addresses) is world-readable. | S |
| **B3** | **Run pending migrations** `0025`/`0028`/`0029` (RUNBOOK §1 self-check lists them). | Errors tab, inventory, and fulfillment columns are dormant until applied. | S |
| **B4** | **Live-payment smoke test** (`docs/LAUNCH_CHECKLIST.md`), then test→live key cutover. | Nothing has processed a real charge yet. | M |

## Trust & differentiation (the category moat)

| # | Item | Why | Effort | State |
| --- | --- | --- | --- | --- |
| T1 | **Inline batch-COA on product cards** (D1). Populate `coa_url`/badge from the `coas` table so cards stop saying "on request." | "On request" is a known buyer red flag; the data already exists. | S | data ready, wiring missing |
| T2 | Lot-number lookup + per-lot QR (verify vial-in-hand vs published cert). | Strongest single differentiator. | — | ✅ shipped (`/v/:code`, `/verify-lot`) |
| T3 | Public filterable COA library. | Trust surface. | — | ✅ `/test-results` |
| T4 | Technical datasheets per compound (sequence, MW, CAS, purity method, storage, solubility). | Compliant dry-spec framing + what sophisticated buyers want. | M | partial (`PeptideSpecsPanel`) |
| T5 | Linked literature refs (PubMed) per compound. | Depth signal; keep strictly non-use-implying. | M | not started |

## Commerce (dormant schema → live features)

| # | Item | Why | Effort | State |
| --- | --- | --- | --- | --- |
| C1 | Tracked inventory + low-stock + oversell guard. | Real stock, not static badges. | — | ✅ Phase 8 |
| C2 | Order tracking + fulfillment + transactional email. | Ship-it loop. | — | ✅ Phase 9 |
| C3 | Restock notifications. | Recover lost demand. | — | ✅ Phase 7 |
| C4 | **Wholesale/partner tiering + loyalty.** Schema has `account_tier`, `partner_status`, `partner_tier`, `loyalty_points`, `lifetime_spend_cents`, `first_purchase_bonus_awarded`; loyalty **awards** on purchase but partner **pricing** is dormant. | Repeat-buyer economics. | L | half-built |
| C5 | Guest checkout + abandoned-cart recovery. | Conversion. | M | not started |

## Payments (architecture > any one processor)

| # | Item | Why | Effort | State |
| --- | --- | --- | --- | --- |
| P1 | Provider-abstraction layer (`createCharge`/`getStatus`/`handleWebhook`/`refund`). | Termination is when-not-if in this vertical. | M | **partial** — `lib/payments/{providers,fulfillment}.js` + shared `priceLines` already abstract Stripe + BTCPay behind one fulfillment path; formalize the interface. |
| P2 | BTCPay as primary rail (non-custodial, no chargebacks). | Resilience. | — | ✅ `api/btcpay/*` |
| P3 | Honestly-underwritten high-risk card adapter; Apple/Google Pay as tokenized cards on it. | Card coverage. | L | env stubs present (`HIGHRISK_CARD_API_KEY`) |
| P4 | ACH/eCheck third rail. | Diversify. | L | env stub (`ACH_API_KEY`) |
| P5 | Webhook signature verification + idempotency on every path. | Integrity. | — | ✅ (Stripe sig + `provider_ref` unique idempotency) |
| — | **Do NOT** build card-to-stablecoin disguise gateways. Represent the business accurately to every processor. | Constraint, not a task. | — | — |

## Admin

| # | Item | Why | Effort | State |
| --- | --- | --- | --- | --- |
| A1 | COA upload UI (no SQL). | Ops without SQL. | M | partial (COA Manager creates rows; no file upload) |
| A2 | Label studio: live product query + human-readable errors + field-fill automation. | | — | ✅ PR #13 (live query + 409s); field-fill via seed rules |
| A3 | Admin action audit log. | Forensics. | — | ✅ `audit_logs` (catalog/label/discount writes) |
| A4 | **2FA for admin + rate-limit auth endpoints.** | Given B1's blast radius, MFA is high-value. | M | not started (rate-limit infra exists) |
| A5 | Genericize residual raw-error passthroughs in `api/admin/{coa,reviews,ai-flags,labels}.js`. | Stop leaking Postgres strings even to admins. | S | not started |

## Platform & reliability

| # | Item | Why | Effort | State |
| --- | --- | --- | --- | --- |
| R1 | **Baseline the Supabase CLI** (RUNBOOK §1 procedure) so drift stops recurring. | Root cause of every "empty/missing" incident. | S | procedure written, not run |
| R2 | CI: build + tests + migration-applies-cleanly on every PR. | Catch drift + false-green. | M | not started |
| R3 | Staging env separate from prod data. | Safe rehearsal. | M | not started |
| R4 | Error monitoring + uptime + verified backup restores. | | S | ✅ first-party error telemetry (Phase 6); add uptime + restore drill |
| R5 | Perf: image optimization, code-splitting, caching. | | M | partial (vendor chunks split; images unoptimized) |

**Scope discipline:** every content item above (T4, T5 especially) must stay
strictly non-use-implying — dry specification and analytical framing only.
