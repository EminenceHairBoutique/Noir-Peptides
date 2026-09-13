/*
  scripts/test-next-tier.mjs   (opt cycle 4 — scorecard 4.5)
  The cart's "Add N more for $X each" line. Imports the REAL pure functions
  from src/lib/tiers.js (no Supabase import) and proves nextTierFor picks the
  cheapest-next tier above the quantity, never a tier that costs more, never
  a tier already reached, and that the drawer renders it. Also proves the
  catalog module still exports the same unitPriceForQuantity (re-export).

  Run: node scripts/test-next-tier.mjs   (wired into npm run test:unit)
*/
import { readFileSync } from "node:fs";
import { unitPriceForQuantity, nextTierFor } from "../src/lib/tiers.js";

let failures = 0;
const ok = (cond, msg) => {
  if (cond) console.log(`  ✓ ${msg}`);
  else { failures++; console.error(`  ✗ ${msg}`); }
};
const tiers = [
  { min_quantity: 1, unit_price: 45, savings_pct: 0 },
  { min_quantity: 3, unit_price: 40, savings_pct: 11 },
  { min_quantity: 5, unit_price: 36, savings_pct: 20 },
  { min_quantity: 10, unit_price: 30, savings_pct: 33 },
];

console.log("unitPriceForQuantity (unchanged behaviour):");
ok(unitPriceForQuantity(45, tiers, 1) === 45, "qty 1 → base 45");
ok(unitPriceForQuantity(45, tiers, 4) === 40, "qty 4 → tier-3 price 40");
ok(unitPriceForQuantity(45, tiers, 10) === 30, "qty 10 → tier-10 price 30");
ok(unitPriceForQuantity(45, [], 7) === 45, "no tiers → base");

console.log("\nnextTierFor:");
let n = nextTierFor(45, tiers, 1);
ok(n && n.minQuantity === 3 && n.more === 2 && n.unitPrice === 40 && n.savingsPerUnit === 5, `qty 1 → next is 3 (add 2, $40, save $5) ${JSON.stringify(n)}`);
n = nextTierFor(45, tiers, 3);
ok(n && n.minQuantity === 5 && n.more === 2 && n.unitPrice === 36, `qty 3 (tier reached) → next is 5 ${JSON.stringify(n)}`);
n = nextTierFor(45, tiers, 9);
ok(n && n.minQuantity === 10 && n.more === 1, `qty 9 → add 1 for the last tier ${JSON.stringify(n)}`);
ok(nextTierFor(45, tiers, 10) === null, "qty 10 (top tier) → null");
ok(nextTierFor(45, tiers, 25) === null, "qty 25 → null");
ok(nextTierFor(45, [], 1) === null, "no tiers → null");
ok(nextTierFor(45, null, 1) === null, "tiers null → null");
ok(nextTierFor(45, [{ min_quantity: 5, unit_price: 50 }], 1) === null, "a higher tier that costs MORE per unit is never suggested");
ok(nextTierFor(45, [{ min_quantity: "x", unit_price: 40 }, { min_quantity: 4, unit_price: "bad" }], 1) === null, "malformed tiers ignored");
n = nextTierFor("45", [{ min_quantity: "3", unit_price: "40" }], "1");
ok(n && n.more === 2 && n.unitPrice === 40, "string inputs coerced");

console.log("\nWiring:");
const drawer = readFileSync(new URL("../src/components/CartDrawer.jsx", import.meta.url), "utf8");
ok(/nextTierFor\(item\.basePrice \?\? item\.price, item\.tiers, item\.quantity\)/.test(drawer), "drawer computes the nudge from the item's basePrice + tiers + quantity");
ok(/Add \{next\.more\} more for \{money\(next\.unitPrice\)\} each/.test(drawer), "drawer copy: \"Add N more for $X each\"");
ok(/import \{ nextTierFor \} from "\.\.\/lib\/tiers"/.test(drawer), "drawer imports the pure module");
const catalog = readFileSync(new URL("../src/lib/catalog.js", import.meta.url), "utf8");
ok(/export \{ unitPriceForQuantity, nextTierFor \} from "\.\/tiers\.js";/.test(catalog), "catalog.js re-exports both from tiers.js (existing imports keep working)");
ok(!/^export function unitPriceForQuantity/m.test(catalog), "no second copy of unitPriceForQuantity in catalog.js");

console.log(failures ? `\n${failures} assertion(s) failed` : "\nAll next-tier assertions passed");
process.exit(failures ? 1 : 0);
