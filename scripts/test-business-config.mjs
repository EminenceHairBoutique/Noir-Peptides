/*
  scripts/test-business-config.mjs
  Snapshot-style test for the business-identity config + renderer (Task 9).
  Proves:
    - with the default all-null config, <BusinessIdentity> renders NOTHING
      (byte-identical output — no empty wrappers), for both variants;
    - once fields are set, each element renders from the config;
    - /legal/returns guarantee line comes from the SAME config.
  Uses esbuild (a Vite dep) to transform the JSX + react-dom/server to render.
  Style mirrors scripts/test-guardrail.mjs.

  Run: node scripts/test-business-config.mjs   (wired into npm run test:unit)
*/
import { build } from "esbuild";
import { renderToStaticMarkup } from "react-dom/server";
import { createElement } from "react";
import path from "node:path";
import fs from "node:fs";

let failures = 0;
const ok = (cond, msg) => {
  if (cond) console.log(`  ✓ ${msg}`);
  else {
    failures++;
    console.error(`  ✗ ${msg}`);
  }
};

// Bundle the component + config into a temp ESM module INSIDE the repo (so
// node resolves react from ./node_modules), react/react-dom left external so we
// share the same instance renderToStaticMarkup uses.
const outfile = path.join(process.cwd(), `.business-test-${Date.now()}.mjs`);
await build({
  entryPoints: [path.join(process.cwd(), "scripts/_business-entry.jsx")],
  bundle: true,
  format: "esm",
  outfile,
  jsx: "automatic",
  external: ["react", "react-dom", "react/jsx-runtime"],
  logLevel: "silent",
});
const mod = await import(`file://${outfile}`);
const {
  BusinessIdentity,
  FulfillmentStatements,
  FreeShipProgress,
  FreeShipNudge,
  BUSINESS,
  FREE_SHIP_THRESHOLD,
  FREE_SHIP_THRESHOLD_CENTS,
  freeShipProgressCents,
  freeShipNudgeText,
  formatCents,
  toCents,
} = mod;

const render = (variant) => renderToStaticMarkup(createElement(BusinessIdentity, { variant }));
const renderStatements = (variant) => renderToStaticMarkup(createElement(FulfillmentStatements, { variant }));
const renderShip = (subtotal) => renderToStaticMarkup(createElement(FreeShipProgress, { subtotal }));

console.log("Business-identity config — default (all null):");
// 1. Default config → renders nothing at all (null), both variants.
ok(render("footer") === "", "footer variant renders empty string (no DOM)");
ok(render("contact") === "", "contact variant renders empty string (no DOM)");

console.log("\nBusiness-identity config — values set:");
// 2. Set each field and confirm it renders. (BUSINESS is a live object; mutate
//    for the test, then restore — mirrors what launch-day config editing does.)
const snap = { ...BUSINESS };
BUSINESS.phone = "+1 (555) 010-0143";
BUSINESS.addressLines = ["Noir Peptides", "123 Research Way", "Lab City, ST 00000"];
BUSINESS.guaranteeDays = 30;
BUSINESS.shipCutoff = "2:00 PM";
BUSINESS.shipCutoffTz = "ET";

const footer = render("footer");
ok(footer.includes("+1 (555) 010-0143"), "phone renders");
ok(footer.includes('href="tel:+15550100143"'), "phone dial href is digit-stripped");
ok(footer.includes("123 Research Way"), "address line renders");
ok(footer.includes("<address"), "address uses semantic <address>");
// Task 5: the cutoff is now a full same-day dispatch statement, not a bare
// "Order by" fragment — it must name the time, timezone AND the days.
ok(
  footer.includes("Orders placed before 2:00 PM ET") && footer.includes("ship the same business day"),
  "shipping cutoff renders as a full same-day dispatch statement with tz"
);
ok(footer.includes("30-day satisfaction guarantee"), "guarantee renders");
ok(render("contact").includes("+1 (555) 010-0143"), "contact variant renders values too");

// Business hours (Task 5): absent by default, table when configured.
ok(!render("footer").includes("business-hours"), "no hours table when BUSINESS.hours is null");
BUSINESS.hours = [
  { day: "Monday", opens: "9:00 AM", closes: "5:00 PM" },
  { day: "Sunday", closed: true },
];
const withHours = render("footer");
ok(withHours.includes('data-testid="business-hours"'), "hours table renders when configured");
ok(withHours.includes("Monday") && withHours.includes("9:00 AM"), "configured hours row renders");
ok(withHours.includes("Closed"), "a closed day renders as Closed, not blank");
BUSINESS.hours = null;

// 3. Partial config — only one field set — renders only that element.
Object.assign(BUSINESS, { phone: null, addressLines: null, shipCutoff: null, guaranteeDays: 30 });
const onlyGuarantee = render("footer");
ok(
  onlyGuarantee.includes("30-day satisfaction guarantee") &&
    !onlyGuarantee.includes("tel:") &&
    !onlyGuarantee.includes("<address"),
  "only the set field (guarantee) renders; others absent"
);

// ── Task 5: fulfilment statements (discreet packaging + billing descriptor) ──
// Both are factual claims about the real operation. A wrong billing descriptor
// turns an unrecognised charge into a chargeback, so nothing may render until
// the owner sets the true value.
console.log("\nFulfilment statements — default (all null):");
Object.assign(BUSINESS, { discreetPackaging: null, billingDescriptor: null });
const fs0 = renderStatements();
ok(fs0 === "", "renders empty string with neither value set (no DOM at all)");
ok(renderStatements("inline") === "", "inline variant also renders nothing");

console.log("\nFulfilment statements — values set:");
BUSINESS.discreetPackaging = "Ships in plain, unbranded outer packaging.";
const fsPack = renderStatements();
ok(fsPack.includes("plain, unbranded outer packaging"), "packaging statement renders verbatim from config");
ok(!fsPack.includes("statement as"), "billing descriptor absent while unset");

BUSINESS.billingDescriptor = "NP RESEARCH LLC";
const fsBoth = renderStatements();
ok(fsBoth.includes("NP RESEARCH LLC"), "billing descriptor renders");
ok(fsBoth.includes('data-testid="billing-descriptor"'), "descriptor is individually addressable");
ok(fsBoth.includes("plain, unbranded outer packaging"), "both statements coexist");

// Descriptor alone, without packaging.
BUSINESS.discreetPackaging = null;
const fsDesc = renderStatements();
ok(
  fsDesc.includes("NP RESEARCH LLC") && !fsDesc.includes("unbranded"),
  "only the set statement renders; the unset one leaves no empty wrapper"
);
Object.assign(BUSINESS, { discreetPackaging: null, billingDescriptor: null });

// ── Task 5 (Aug) + Sept-11 T5: free-shipping nudge, integer-cents maths ──
console.log("\nFree-shipping maths (integer cents, one threshold):");
ok(Number.isFinite(FREE_SHIP_THRESHOLD) && FREE_SHIP_THRESHOLD > 0, "FREE_SHIP_THRESHOLD is a real number");
ok(FREE_SHIP_THRESHOLD_CENTS === Math.round(FREE_SHIP_THRESHOLD * 100), "FREE_SHIP_THRESHOLD_CENTS is DERIVED from the dollar threshold");
ok(toCents(249.99) === 24999, "toCents rounds once (249.99 → 24999)");
ok(toCents(0.1 + 0.2) === 30, "toCents absorbs float noise (0.1+0.2 → 30)");
ok(toCents(-5) === 0 && toCents("abc") === 0, "toCents never goes negative or NaN");
ok(formatCents(1) === "$0.01" && formatCents(25000) === "$250" && formatCents(123456) === "$1,234.56", "formatCents: cents, whole dollars, thousands");
{
  const below = freeShipProgressCents(FREE_SHIP_THRESHOLD_CENTS - 1);
  ok(below.qualifies === false && below.remainingCents === 1, "one cent short → not qualified, remaining exactly 1 cent");
  const at = freeShipProgressCents(FREE_SHIP_THRESHOLD_CENTS);
  ok(at.qualifies === true && at.remainingCents === 0, "exactly at threshold → qualified");
  const above = freeShipProgressCents(FREE_SHIP_THRESHOLD_CENTS + 1000);
  ok(above.qualifies === true && above.remainingCents === 0 && above.pct === 100, "above → qualified, pct capped at 100");
}
ok(freeShipNudgeText(0) === null, "empty cart → no nudge text");
ok(freeShipNudgeText(FREE_SHIP_THRESHOLD_CENTS - 2500) === "Add $25 for free shipping", 'below → "Add $25 for free shipping"');
ok(freeShipNudgeText(FREE_SHIP_THRESHOLD_CENTS - 1) === "Add $0.01 for free shipping", 'one cent short → "Add $0.01 for free shipping" (no float tail)');
ok(freeShipNudgeText(FREE_SHIP_THRESHOLD_CENTS) === "Free shipping unlocked.", 'at threshold → "Free shipping unlocked."');
ok(freeShipNudgeText(FREE_SHIP_THRESHOLD_CENTS + 1) === "Free shipping unlocked.", 'above threshold → "Free shipping unlocked."');

// Render fixtures: below / at / above, on the one-line nudge.
console.log("\n<FreeShipNudge> render — below / at / above:");
const renderNudge = (subtotal) => renderToStaticMarkup(createElement(FreeShipNudge, { subtotal }));
ok(renderNudge(0) === "", "zero subtotal → renders nothing");
{
  const below = renderNudge(FREE_SHIP_THRESHOLD - 25);
  ok(below.includes('data-testid="free-ship-nudge"') && below.includes("Add $25 for free shipping"), "below: single line 'Add $25 for free shipping'");
  ok(!below.includes("unlocked"), "below: never says unlocked");
  const at = renderNudge(FREE_SHIP_THRESHOLD);
  ok(at.includes("Free shipping unlocked."), "at: 'Free shipping unlocked.'");
  const above = renderNudge(FREE_SHIP_THRESHOLD + 10);
  ok(above.includes("Free shipping unlocked.") && !above.includes("Add $"), "above: unlocked, no remaining amount");
  ok((above.match(/<p /g) || []).length === 1, "it is one line — a single <p>");
}

// The cart-page progress bar shares the nudge and the cents helper.
console.log("\n<FreeShipProgress> (cart page) shares the same wording + maths:");
ok(renderShip(0) === "", "no progress bar at a zero subtotal");
const shipUnder = renderShip(FREE_SHIP_THRESHOLD - 25);
ok(shipUnder.includes("Add $25 for free shipping"), "progress line uses the shared nudge wording");
ok(
  shipUnder.includes(`aria-valuemax="${FREE_SHIP_THRESHOLD}"`),
  "progressbar max is the threshold itself, not a duplicated literal"
);
const shipOver = renderShip(FREE_SHIP_THRESHOLD + 10);
ok(shipOver.includes("Free shipping unlocked."), "qualifying subtotal states it plainly");
ok(!shipOver.includes("Add $"), "a qualifying subtotal never also shows a remaining amount");

// Restore + cleanup.
Object.assign(BUSINESS, snap);
fs.rmSync(outfile, { force: true });

if (failures) {
  console.error(`\n${failures} business-config check(s) FAILED`);
  process.exit(1);
}
console.log("\nAll business-config checks passed.");
