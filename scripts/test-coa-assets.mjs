/*
  scripts/test-coa-assets.mjs   (opt cycle 1 — scorecard 4.3)
  Every certificate the seed references must exist on disk, and its label
  must match its real type (Sept-11 T3: an image is never called "PDF").
  Reads supabase/migrations/0019_janoshik_coas.sql for every file_url.

  Run: node scripts/test-coa-assets.mjs   (wired into npm run test:unit)
*/
import { existsSync, readFileSync, readdirSync } from "node:fs";
import path from "node:path";
import { certificateLabel } from "../src/lib/coaTable.js";

let failures = 0;
const ok = (cond, msg) => {
  if (cond) console.log(`  ✓ ${msg}`);
  else {
    failures++;
    console.error(`  ✗ ${msg}`);
  }
};

const seed = readFileSync(path.join(process.cwd(), "supabase/migrations/0019_janoshik_coas.sql"), "utf8");
const urls = [...new Set([...seed.matchAll(/'(\/coas\/janoshik\/[^']+)'/g)].map((m) => m[1]))];

console.log(`Seeded certificate assets (${urls.length} referenced):`);
ok(urls.length > 0, "the seed references certificate files");
const missing = urls.filter((u) => !existsSync(path.join(process.cwd(), "public", u)));
ok(missing.length === 0, `every referenced certificate exists under public/ (missing: ${JSON.stringify(missing)})`);
const mislabelled = urls.filter((u) => certificateLabel(u) === "PDF" && !/\.pdf$/i.test(u.split(/[?#]/)[0]));
ok(mislabelled.length === 0, "no non-PDF asset is labelled PDF");
const images = urls.filter((u) => /\.(jpe?g|png|webp)$/i.test(u));
ok(images.every((u) => certificateLabel(u) === "Certificate image"), `all ${images.length} image certificates are labelled "Certificate image"`);
const onDisk = readdirSync(path.join(process.cwd(), "public/coas/janoshik"));
const unreferenced = onDisk.filter((f) => !urls.includes(`/coas/janoshik/${f}`));
ok(unreferenced.length === 0, `no certificate file on disk is unreferenced by the seed (orphans: ${JSON.stringify(unreferenced)})`);

if (failures) {
  console.error(`\n${failures} COA-asset check(s) FAILED`);
  process.exit(1);
}
console.log("\nAll COA-asset checks passed.");
