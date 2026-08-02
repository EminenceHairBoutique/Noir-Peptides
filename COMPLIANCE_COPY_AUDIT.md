# Noir Peptides — Compliance Copy Audit

**Date:** 2026-06-30
**Scope:** All user-facing copy — product/category descriptors, homepage, FAQ,
legal pages, AI strings, marketing taglines.
**Method:** Repo-wide scan for human-use / therapeutic / physiological-effect
language (`dose`, `dosage`, `administer`, `inject`, `cycle`, `recovery`, `heal`,
`fat loss`, `muscle`, `libido`, `cognition`, `mood`, `therapeutic`, `treat`,
`cure`, `benefit`, `wellness`, `performance`, `results`, `energy`, …) across
`src/**/*.{js,jsx}`, `api/**`, and the SQL seed.

> **Rule applied:** copy describes the chemical and the in-vitro research context
> only. No human/veterinary use, dosing, route-of-administration, therapeutic
> benefit, or physiological-effect language.

**Per the engagement's stop-gate, NO copy rewrites have been merged.** This
report lists findings and *proposed* changes for your review. Approve and I'll
apply them in a follow-up commit.

---

## Summary

The catalog and site copy are, overall, **claim-safe**. The vast majority of
keyword hits are *negative* compliance statements (e.g. "we do **not** provide
dosing", "**not** intended to treat, cure, or prevent disease") or benign
technical labels (vial size in mg, HPLC %, molecular weight). The product
descriptors in the live catalog (`src/data/tier1Catalog.js`, mirrored to the
`0009` seed) are molecule-class / origin only.

| Severity | Count | Area |
|----------|-------|------|
| High (implies human/therapeutic effect) | 0 | — |
| Medium (ambiguous marketing language)   | 1 | "Performance" tagline |
| Low (benign term, optional tightening)  | 2 | "Dosage" UI label; "dosage" in a Deals sentence |

No High-severity (human-use / therapeutic-claim) copy was found.

---

## Findings

### MED-1 — "Performance" in the brand tagline
- **Files:** `src/config/brand.js:8` (`tagline: "Precision. Purity. Performance."`),
  `src/pages/PublicLanding.jsx:61` (`Precision · Purity · Performance`).
- **Why flagged:** in a peptide context, "Performance" can be read as a
  human physical/athletic-performance claim, even though it's intended as a
  brand value (product/analytical performance).
- **Proposed rewrite (for review — not applied):**
  - `brand.js:8` → `tagline: "Precision. Purity. Provenance."`
  - `PublicLanding.jsx:61` → `Precision · Purity · Provenance`
  - Alternatives: "Precision. Purity. Documentation." / "…Traceability."
- **Note:** `BRAND.subTagline` (footer) should be checked against the same rule
  when you pick the replacement, to keep the wording consistent.

### LOW-1 — "Dosage" selector label on the PDP
- **File:** `src/pages/ProductDetail.jsx:300–311` (the vial-size selector is
  labeled "Dosage").
- **Why flagged:** "Dosage" implies an administered dose; here it only selects
  the **vial size** (e.g. 5 mg vs 10 mg).
- **Proposed rewrite (for review):** rename the selector label "Dosage" → **"Size"**
  (or "Vial size"). Purely cosmetic; no functional change.

### LOW-2 — "Every dosage uses the same … ladder" (Deals page)
- **File:** `src/pages/Deals.jsx:96`.
- **Why flagged:** same "dosage" → "size" nuance as LOW-1.
- **Proposed rewrite (for review):** "Every **size** uses the same
  buy-more-save-more ladder."

---

## Verified clean (no action)

- **Legal pages** (`src/config/legalCopy.js`, `src/config/compliance.js`):
  comprehensive RUO / no-medical-claims / FDA-disclaimer language; explicitly
  refuse to provide dosing or administration guidance.
- **FAQ / Home / Contact / Calculator / Research articles:** state the RUO
  framing and avoid effect claims; the calculator is pure mass÷volume with no
  body-weight or dosing inputs.
- **AI strings** (`api/ai/guardrail.js`): the system guardrail and refusal
  redirect are claim-safe and now covered by `npm run test:guardrail`.
- **Catalog descriptors** (`src/data/tier1Catalog.js` → `0009` seed): neutral,
  molecule-class/origin only; CAS/sequence/MW left to the per-batch COA.

---

## Note on the legacy static catalog

`src/data/products.js` is a **stale** 13-product file with category slugs that no
longer match the live catalog. It is not the source of truth (the live data is
`tier1Catalog.js` + the `0009` seed) and is slated for removal/replacement in
the Task 6 schema reconciliation. Its copy is claim-safe, but a couple of
subtitles ("Tissue-model research peptide", etc.) should be retired with the
file rather than maintained.
