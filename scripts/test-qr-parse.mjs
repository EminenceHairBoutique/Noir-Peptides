// scripts/test-qr-parse.mjs — unit tests for the QR scan parser.
// Run: node scripts/test-qr-parse.mjs
import { parseScannedCode } from "../src/lib/qrScanParse.js";
import {
  generateVerificationCode,
  VERIFICATION_CODE_LENGTH,
} from "../src/lib/labels/verificationCode.js";

let failed = 0;
function eq(actual, expected, label) {
  const ok = actual === expected;
  if (!ok) {
    failed++;
    console.error(`  ✗ ${label}: expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}`);
  }
}

const CODE = "7Q3M0R8VNPXKD"; // valid Crockford base32, 13 chars

// Label QRs as renderLabelSvg encodes them
eq(parseScannedCode(`https://www.noirpeptides.com/v/${CODE}`), CODE, "canonical URL");
eq(parseScannedCode(`https://noir-peptides.vercel.app/v/${CODE}`), CODE, "preview-host URL");
eq(parseScannedCode(`https://www.noirpeptides.com/v/${CODE}/`), CODE, "trailing slash");
eq(parseScannedCode(`/v/${CODE}`), CODE, "bare path");

// Bare codes, normalization (lowercase, separators, ambiguous glyphs O→0, I/L→1)
eq(parseScannedCode(CODE), CODE, "bare code");
eq(parseScannedCode(CODE.toLowerCase()), CODE, "lowercase code");
eq(parseScannedCode("7Q3M-0R8V-NPXKD"), CODE, "hyphenated code");
eq(parseScannedCode("7Q3MOR8VNPXKD"), CODE, "O normalized to 0");
eq(parseScannedCode(` ${CODE} `), CODE, "surrounding whitespace");

// Generated codes always round-trip
for (let i = 0; i < 50; i++) {
  const c = generateVerificationCode();
  eq(parseScannedCode(`https://www.noirpeptides.com/v/${c}`), c, `generated round-trip ${c}`);
}

// Rejections — anything that is not a /v/ deep link or a valid code
eq(parseScannedCode(""), null, "empty");
eq(parseScannedCode(null), null, "null");
eq(parseScannedCode("https://www.noirpeptides.com/shop"), null, "other site path");
eq(parseScannedCode("https://evil.example/phishing"), null, "foreign URL, no /v/");
eq(parseScannedCode(`https://evil.example/v/${CODE}`), CODE, "foreign host but valid /v/ code (code is looked up server-side, host irrelevant)");
eq(parseScannedCode("/v/"), null, "empty code segment");
eq(parseScannedCode("/v/short"), null, "too short");
eq(parseScannedCode("/v/" + "A".repeat(14)), null, "too long");
eq(parseScannedCode("/v/7Q3M0R8VNPXKU"), null, "U is not Crockford");
eq(parseScannedCode("WIFI:T:WPA;S:home;;"), null, "random QR payload");
eq(parseScannedCode("BEGIN:VCARD"), null, "vcard payload");
eq(parseScannedCode(CODE.slice(0, VERIFICATION_CODE_LENGTH - 1)), null, "12 chars");

if (failed) {
  console.error(`qr-parse: ${failed} assertion(s) FAILED`);
  process.exit(1);
}
console.log("qr-parse: all 71 assertions passed");
