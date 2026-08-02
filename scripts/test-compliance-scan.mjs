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
if (failures) {
  console.error(`\n${failures}/${total} compliance-scan tests FAILED`);
  process.exit(1);
}
console.log(`\nAll ${total} compliance-scan tests passed.`);
