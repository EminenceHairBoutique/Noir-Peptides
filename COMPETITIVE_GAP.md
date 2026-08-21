# Noir Peptides — Competitive Gap Analysis vs. Solyn

_Stage 8 of the master audit. Benchmarks **capability and structure** against
Solyn (solyn.com), a direct RUO reference-materials competitor. No competitor
code, markup, or copy was copied — only observed capabilities are compared.
Findings marked **[verified]** (executed/inspected in our repo) or
**[suspected]** (Solyn behavior described from the brief; their live site was
not reachable from the audit sandbox — proxy blocks outbound to third parties)._

## How to read this

"Our state" is verified against current `main` (post-PRs #13–#20). Several
items the brief lists as competitor advantages — server-rendered catalog,
two-step checkout with research-entity/protocol + granular RUO attestations +
tiered shipping, lot verification — **we already have**, because this session
shipped them. The genuine gaps are narrower than the brief assumes, and in one
dimension we are ahead.

## Gap table

| # | Capability | Solyn (benchmark) | Our state | Gap | Effort |
| --- | --- | --- | --- | --- | --- |
| G1 | **Server-rendered, crawlable catalog** | Fully SSR; only checkout behind a wall | **Closed** — build prerenders 73 route HTMLs with body text + `Product`/`Organization` JSON-LD + OG; catalog is public (migration 0013) [verified] | none | — |
| G2 | **Two-step checkout** (Personal → Payment), research entity + protocol dropdowns, granular RUO checkboxes, tiered shipping w/ free-ship nudge, org fields, billing toggle | Present | **Closed** — shipped PR #18/#19; server-authoritative shipping w/ $250 free threshold + $16.95/$35/$50 methods [verified] | none | — |
| G3 | **Lot verification** | Web lookup by lot number | **Ahead** — `/verify-lot` + `/v/:code`, and the physical vial carries a per-lot QR that deep-links to `/v/<code>` (label engine). Verify the vial *in hand*, not just a web search. [verified] | **we exceed** | — |
| G4 | **Public COA library, searchable** | `/coa-dashboard/`: search by lot / product / CAS; filter by category | **Partial** — `/test-results` lists published COAs, filters by product, and has a lot-number search that jumps to verification [verified]. Missing: search by **CAS**, filter by **research category**. | small | **S** |
| G5 | **Per-product expandable lot-history table** — every lot with lot #, purity %, CAS, test date, direct PDF link, and a permalink to that product's batch history | Present, inline on the dashboard | **Gap** — our COA rows carry lot #, purity %, test date, lab, HPLC, MS-confirmed, and `file_url` (PDF), but they render as a **flat list**, not an expandable per-product batch table, and there's no per-product batch permalink [verified] | **medium** | **M** |
| G6 | **CAS number per lot** | Shown per lot in the dashboard | **Gap** — `0019_janoshik_coas.sql` COA rows have **no `cas_number` column**; CAS lives (if anywhere) on the product, not the certificate [verified]. Populating it is owner data entry, not just code. | medium | **S**(code) + owner data |
| G7 | **Headline trust counters** — products tested, batches published, latest certificate date | Present atop the dashboard | **Gap** — not rendered; all three are derivable from the `coas` table with a `count`/`max(tested_at)` [verified] | small | **S** |
| G8 | **Inline batch-COA on product cards** (not "on request") | COA visible per product | **Gap** — `ProductCard.jsx:127` still shows "COA on request" when `coa_url` is null; the `coas` table has the data, the card just isn't wired to it [verified]. (This is roadmap **T1**.) | medium | **S** |
| G9 | **Quantified trust stack** — avg purity, same-day shipping cutoff, analytical panel breadth (HPLC + MS), staffed phone line w/ published hours | Present | **Partial** — HPLC + MS identity are surfaced per COA; avg purity, a shipping cutoff, and a staffed phone line w/ hours are **not** present [verified]. Phone line is an ops decision, not code. | small–med | **S**(code) + owner ops |
| G10 | **Disciplined RUO copy register** — in-vitro / preclinical / non-clinical, "without claims of therapeutic use"; full footer disclaimer incl. explicit "not a 503A compounding pharmacy or 503B outsourcing facility" | Present | **Partial** — RUO disclaimers render on PDPs + footer and the compliance scanner lints copy [verified], but the explicit **503A/503B non-status** line is **absent** [verified]. Attorney-review item. | small | **S** + legal review |
| G11 | **Category faceting on catalog** | Research-category filter | **Closed** — `/shop/:category` + faceted filters exist [verified] | none | — |

## Where we can plausibly exceed Solyn

1. **Physical-vial QR verification (G3).** Their verification is web-only; ours
   closes the loop from the vial in the researcher's hand to the published
   certificate. This is the strongest differentiator available and it is
   already built — it should be **marketed**, not just shipped. Put the
   "scan the vial" story on the COA dashboard and PDP.
2. **Batch-history permalinks + counters (G5/G7)** would bring the dashboard to
   parity, and combined with G3 gives a verification story that is strictly
   broader than theirs (web *and* physical).

## Net assessment

The competitive picture is much closer than the brief's stale premises imply —
the catalog is crawlable, checkout is two-step with the full research/attestation
apparatus, and lot verification exists and is physically anchored. The real,
codeable gaps are the **COA dashboard depth** (G5 expandable batch tables + G7
counters + G4 CAS/category search) and the **inline-COA-on-cards wiring** (G8) —
all small-to-medium, and all already reflected in `ROADMAP.md` under T1/T3. Two
items are **not code**: CAS-per-lot data entry (G6) and the 503A/503B disclosure
line (G10, attorney review). None is a launch blocker; they are trust-surface
polish that would let the storefront match or beat Solyn's most-cited advantage.
