// src/lib/complianceScan.js
// Pure, dependency-free RUO compliance copy scanner. Flags language that
// implies human/veterinary use, dosing/administration, or therapeutic/disease
// benefit — the categories that must never appear in product, research, or
// legal copy. Shared by the admin Compliance Scanner (client) and the AI
// compliance endpoints (server), so both judge by the same rules.
//
// NOTE: this is an ADVISORY linter. It intentionally over-flags (e.g. it will
// flag "treat" even inside a negative disclaimer like "not intended to treat")
// so a human reviews context. Matches are grouped by category with severity.

const RULES = [
  // category, severity, patterns
  {
    category: "dosing",
    severity: "high",
    patterns: [
      /\bdosages?\b/i,
      /\bdosing\b/i,
      /\bmg\s*\/\s*kg\b/i,
      /\bmcg\s*\/\s*kg\b/i,
      /\bhow\s+(much|many)\s+to\s+(take|use|inject)\b/i,
      /\b(twice|once|three times)\s+(a|per)\s+day\b/i,
      /\b(units?|iu)\s+per\s+(day|week)\b/i,
    ],
  },
  {
    category: "administration",
    severity: "high",
    patterns: [
      /\binject(?:ion|ing|able)?\b/i,
      /\bsubcutaneous\b/i,
      /\bintramuscular\b/i,
      /\b(sub-?q|subq|\bim\b|\biv\b)\b/i,
      /\breconstitute\s+(?:it\s+)?(?:and|to|for)\s+(?:use|inject|dose)\b/i,
      /\b(cycle|cycling|stack|stacking)\b/i,
      /\bhow\s+to\s+(use|take|administer)\b/i,
    ],
  },
  {
    category: "human-use",
    severity: "high",
    patterns: [
      /\bfor\s+human\s+(use|consumption)\b/i,
      /\bpersonal\s+use\b/i,
      /\bself[-\s]?administer\b/i,
      /\bbody\s?weight\b/i,
      /\byour\s+body\b/i,
    ],
  },
  {
    category: "therapeutic-benefit",
    severity: "high",
    patterns: [
      /\b(treats?|treating|treatment)\b/i,
      /\b(cures?|curing)\b/i,
      /\b(heals?|healing)\b/i,
      /\btherap(?:y|eutic)\b/i,
      /\banti[-\s]?aging\b/i,
      /\b(weight|fat)\s+loss\b/i,
      /\bmuscle\s+(growth|gain|building)\b/i,
      /\b(libido|recovery|anti[-\s]?inflammatory|fat\s+burning)\b/i,
      /\bboosts?\b/i,
      /\benhances?\b/i,
      /\bimproves?\s+(?:your|the)\b/i,
    ],
  },
  {
    category: "disease-claim",
    severity: "high",
    patterns: [
      /\b(cure|treat|prevent|reverse)\s+[a-z\s]{0,20}\b(disease|diabetes|obesity|cancer|arthritis|depression|anxiety)\b/i,
      /\bclinically\s+proven\b/i,
      /\bproven\s+to\s+(?:treat|cure|reduce|increase)\b/i,
    ],
  },
];

/**
 * Scan a block of copy. Returns { clean, count, findings[] }.
 * findings: { category, severity, term, index, context }.
 */
export function scanCopy(text) {
  const src = String(text || "");
  const findings = [];
  for (const rule of RULES) {
    for (const re of rule.patterns) {
      const g = new RegExp(re.source, re.flags.includes("g") ? re.flags : re.flags + "g");
      let m;
      while ((m = g.exec(src)) !== null) {
        const start = Math.max(0, m.index - 24);
        const end = Math.min(src.length, m.index + m[0].length + 24);
        findings.push({
          category: rule.category,
          severity: rule.severity,
          term: m[0],
          index: m.index,
          context: (start > 0 ? "…" : "") + src.slice(start, end).replace(/\s+/g, " ").trim() + (end < src.length ? "…" : ""),
        });
        if (m.index === g.lastIndex) g.lastIndex++; // avoid zero-width loop
      }
    }
  }
  findings.sort((a, b) => a.index - b.index);
  return { clean: findings.length === 0, count: findings.length, findings };
}

export const COMPLIANCE_CATEGORIES = RULES.map((r) => r.category);
