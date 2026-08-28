/*
  scripts/test-compliance-scan.mjs
  Unit tests for the RUO compliance copy scanner (src/lib/complianceScan.js).
  Banned language (dosing/administration/human-use/therapeutic/disease) MUST be
  flagged; neutral analytical copy MUST pass. No network.

  Run: node scripts/test-compliance-scan.mjs   (npm run test:compliance)
*/
import { scanCopy } from "../src/lib/complianceScan.js";

const MUST_FLAG = [
  "Recommended dosage is 250 mcg twice a day",
  "Inject subcutaneously for best results",
  "Clinically proven to treat inflammation",
  "Helps with weight loss and muscle growth",
  "For human use only",
  "Reconstitute and inject to dose",
  "Run an 8-week cycle for recovery",
];

const MUST_PASS = [
  "Lyophilized peptide reference material for in-vitro laboratory research.",
  "HPLC purity 99.2% with mass-spec identity confirmation.",
  "Molecular weight 1419.5 g/mol. Store at -20°C.",
  "For research use only. Not for human or veterinary use.",
  "A synthetic 15–amino-acid peptide supplied as a batch-documented reference material.",
];

let failures = 0;
const fail = (m) => { failures++; console.error(`  ✗ ${m}`); };

console.log("Compliance scanner — MUST FLAG:");
for (const t of MUST_FLAG) {
  const r = scanCopy(t);
  if (!r.clean) console.log(`  ✓ ${t}  [${r.findings.map((f) => f.category).join(",")}]`);
  else fail(`NOT flagged: "${t}"`);
}

console.log("\nCompliance scanner — MUST PASS:");
for (const t of MUST_PASS) {
  const r = scanCopy(t);
  if (r.clean) console.log(`  ✓ ${t}`);
  else fail(`Wrongly flagged: "${t}"  [${r.findings.map((f) => `${f.category}:${f.term}`).join(", ")}]`);
}

const total = MUST_FLAG.length + MUST_PASS.length;
// ── W7 (gap G10): the footer disclaimer must carry the 503A/503B
// non-status disclosure. Wording is DRAFT pending attorney review (see the
// comment at the string in src/config/compliance.js); this rule guards its
// PRESENCE — losing the line fails the build, same severity as any other
// compliance failure here.
console.log("\nFooter 503A/503B non-status disclosure:");
const { FOOTER_LEGAL } = await import("../src/config/compliance.js");
if (/503A/.test(FOOTER_LEGAL) && /503B/.test(FOOTER_LEGAL) && /not a (503A )?compounding pharmacy/i.test(FOOTER_LEGAL) && /outsourcing facility/i.test(FOOTER_LEGAL)) {
  console.log("  ✓ footer disclaimer states 503A/503B non-status");
} else {
  fail("footer disclaimer is missing the 503A/503B non-status disclosure");
}
// NOTE: the disclaimer is deliberately NOT run through scanCopy — it is a
// NEGATIVE compliance statement, and the keyword scanner correctly fires on
// phrases like "not intended to … treat, cure, or prevent any disease"
// regardless of negation. Disclaimers are canonical constants, not scanner
// targets. The rule below guards the PRESENCE of the exact drafted sentence.
const sentence = "Noir Peptides is not a pharmacy, is not a 503A compounding pharmacy, and is not a 503B outsourcing facility; its products are not compounded drugs.";
if (FOOTER_LEGAL.includes(sentence)) console.log("  ✓ the drafted sentence appears verbatim in the footer disclaimer");
else fail("drafted 503A/503B sentence drifted from the footer disclaimer");

if (failures) {
  console.error(`\n${failures}/${total} compliance-scan tests FAILED`);
  process.exit(1);
}
console.log(`\nAll ${total} compliance-scan tests passed.`);
