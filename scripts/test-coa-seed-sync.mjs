/*
  scripts/test-coa-seed-sync.mjs   (opt cycle 11)
  src/data/coaSeed.js must be exactly what scripts/gen-coa-mirror.mjs emits
  from migration 0019 (byte-compare, like test-seed-sync for the catalog), so
  the static mirror can never drift from the seeded lab data; and every
  mirrored certificate names a catalog product and a shipped asset.
  Run: node scripts/test-coa-seed-sync.mjs   (wired into npm run test:unit)
*/
import { readFileSync, existsSync } from "node:fs";
import { MODULE, COA_SEED } from "./gen-coa-mirror.mjs";
import { getAllProducts } from "../src/data/tier1Catalog.js";
let failures = 0;
const ok = (cond, msg) => { if (cond) console.log(`  ✓ ${msg}`); else { failures++; console.error(`  ✗ ${msg}`); } };
ok(readFileSync("src/data/coaSeed.js", "utf8") === MODULE, "src/data/coaSeed.js equals the generator output (re-run scripts/gen-coa-mirror.mjs after editing 0019)");
ok(COA_SEED.length === 19, `19 certificates mirrored (${COA_SEED.length})`);
const ids = new Set(getAllProducts().map((p) => p.id));
ok(COA_SEED.every((r) => ids.has(r.product_id)), "every certificate names a catalog product");
ok(COA_SEED.every((r) => r.is_published === true && r.lot_number && r.tested_at), "every mirrored certificate is published, has a lot number and a test date");
ok(COA_SEED.every((r) => existsSync(`public${r.file_url}`)), "every certificate file is shipped under public/");
ok(new Set(COA_SEED.map((r) => r.product_id)).size === 15, "15 products carry a certificate");
ok(COA_SEED.every((r) => /^seed-\d+$/.test(String(r.id)) && r.created_at === null), "mirrored rows carry seed-N ids and no synthesised created_at (opt cycle 12)");
if (failures) { console.error(`\n${failures} COA-seed-sync check(s) FAILED`); process.exit(1); }
console.log("\nAll COA-seed-sync checks passed.");
