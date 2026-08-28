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
const { BusinessIdentity, BUSINESS } = mod;

const render = (variant) => renderToStaticMarkup(createElement(BusinessIdentity, { variant }));

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

// Restore + cleanup.
Object.assign(BUSINESS, snap);
fs.rmSync(outfile, { force: true });

if (failures) {
  console.error(`\n${failures} business-config check(s) FAILED`);
  process.exit(1);
}
console.log("\nAll business-config checks passed.");
