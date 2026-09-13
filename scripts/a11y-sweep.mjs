/*
  scripts/a11y-sweep.mjs   (opt cycle 2 — scorecard 4.9)
  WCAG 2.2 AA sweep with axe-core over the key public routes at 390 and 1280,
  against the built dist served Vercel-style. Findings-first: prints a
  per-rule summary and writes JSON. Exit code reflects serious/critical
  violations so it can become a gate once the baseline is clean.

  Usage: node scripts/a11y-sweep.mjs [baseUrl] [outJson]
*/
import { chromium } from "@playwright/test";
import { AxeBuilder } from "@axe-core/playwright";
import fs from "node:fs";
const [base = "http://localhost:4180", out = ".a11y-report.json"] = process.argv.slice(2);
const exe = process.env.PLAYWRIGHT_CHROMIUM_PATH || "/opt/pw-browsers/chromium-1194/chrome-linux/chrome";
const ROUTES = ["/", "/shop", "/product/bpc-157", "/test-results", "/documents", "/legal/ruo-agreement", "/verify-lot", "/login", "/faqs"];
const browser = await chromium.launch({ executablePath: fs.existsSync(exe) ? exe : undefined });
const report = [];
for (const width of [390, 1280]) {
  // @axe-core/playwright requires a page from an explicit context.
  const context = await browser.newContext({ viewport: { width, height: 900 } });
  const page = await context.newPage();
  for (const route of ROUTES) {
    await page.goto(base + route, { waitUntil: "networkidle" });
    await page.waitForTimeout(500);
    const results = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa", "best-practice"]).analyze();
    for (const v of results.violations) {
      report.push({ width, route, id: v.id, impact: v.impact, help: v.help, helpUrl: v.helpUrl, nodes: v.nodes.slice(0, 5).map((n) => ({ target: n.target.join(" "), html: n.html.slice(0, 160), summary: n.failureSummary?.split("\n")[1]?.trim() })) , count: v.nodes.length });
    }
    console.log(`${width}px ${route}: ${results.violations.length} rule(s) violated, ${results.passes.length} passed`);
  }
  await context.close();
}
// Opt c7 (4.9): the GATED pages. Works against the `npm run build:e2e` dist
// (the auth fixture routes the fake Supabase host); against the production
// build /cart bounces to /login and the pass is skipped with a note.
let authedViews = 0;
try {
  const { installAuth } = await import("../tests/e2e/fixtures/auth.js");
  for (const width of [390, 1280]) {
    const context = await browser.newContext({ viewport: { width, height: 900 } });
    const page = await context.newPage();
    await installAuth(page);
    await page.goto(base + "/product/bpc-157", { waitUntil: "networkidle" });
    const add = page.getByRole("button", { name: /add to cart/i }).first();
    if (await add.isVisible().catch(() => false)) { await add.click(); await page.keyboard.press("Escape"); }
    await page.goto(base + "/cart", { waitUntil: "networkidle" });
    if (!/\/cart$/.test(page.url())) { console.log(`authed pass skipped at ${width}px (dist is not the E2E build; landed on ${new URL(page.url()).pathname})`); await context.close(); break; }
    const sweep = async (label) => {
      await page.waitForTimeout(400);
      const results = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa", "best-practice"]).analyze();
      for (const v of results.violations) report.push({ width, route: label, id: v.id, impact: v.impact, help: v.help, helpUrl: v.helpUrl, nodes: v.nodes.slice(0, 5).map((n) => ({ target: n.target.join(" "), html: n.html.slice(0, 160), summary: n.failureSummary?.split("\n")[1]?.trim() })), count: v.nodes.length });
      console.log(`${width}px ${label}: ${results.violations.length} rule(s) violated, ${results.passes.length} passed`);
      authedViews++;
    };
    await sweep("/cart (authed)");
    await page.goto(base + "/checkout", { waitUntil: "networkidle" });
    await page.locator("#ct-first").waitFor({ timeout: 15000 });
    await sweep("/checkout step 1 (authed)");
    await page.fill("#ct-first", "Ada"); await page.fill("#ct-last", "Lovelace"); await page.fill("#ct-email", "researcher@e2e.test");
    await page.fill("#ship-line1", "12 Lab Row"); await page.fill("#ship-city", "Austin"); await page.selectOption("#ship-state", "TX"); await page.fill("#ship-zip", "78701");
    await page.selectOption("#ri-entity", { index: 1 }); await page.selectOption("#ri-protocol", { index: 1 });
    await page.locator('input[name="shipmethod"]').first().check();
    const boxes = page.locator('section[aria-labelledby="at-h"] input[type="checkbox"]');
    for (let i = 0; i < await boxes.count(); i++) await boxes.nth(i).check();
    await page.getByRole("button", { name: /continue to payment/i }).click();
    await page.getByText(/BTCPay/i).first().waitFor({ timeout: 15000 });
    await sweep("/checkout step 2 (authed)");
    await context.close();
  }
} catch (e) {
  console.log(`authed pass skipped: ${e?.message?.split("\n")[0]}`);
}
console.log(`authed page-views swept: ${authedViews}`);

fs.writeFileSync(out, JSON.stringify(report, null, 2));
const byRule = {};
for (const r of report) { const k = `${r.impact}|${r.id}`; byRule[k] = byRule[k] || { impact: r.impact, id: r.id, help: r.help, pages: new Set(), nodes: 0 }; byRule[k].pages.add(`${r.route}@${r.width}`); byRule[k].nodes += r.count; }
const order = { critical: 0, serious: 1, moderate: 2, minor: 3 };
console.log("\n=== violations by rule ===");
for (const v of Object.values(byRule).sort((a, b) => order[a.impact] - order[b.impact])) console.log(`[${v.impact}] ${v.id} — ${v.help} — ${v.nodes} node(s) on ${v.pages.size} page-view(s)`);
// Opt cycle 3 (Hy-004): landmark structure is a budget of ZERO — one <main>,
// every node inside a landmark, one h1 — now that the baseline is clean.
const LANDMARK_RULES = ["region", "landmark-one-main", "landmark-no-duplicate-main", "landmark-main-is-top-level", "landmark-unique", "page-has-heading-one"];
const landmark = report.filter((r) => LANDMARK_RULES.includes(r.id)).reduce((n, r) => n + r.count, 0);
console.log(`landmark findings (${LANDMARK_RULES.join(", ")}): ${landmark}`);

// Keyboard: the first Tab on a shell page must land on the skip link, and
// activating it must move focus into #main (WCAG 2.4.1 bypass block).
let keyboardFailures = 0;
{
  const context = await browser.newContext({ viewport: { width: 1280, height: 900 } });
  const page = await context.newPage();
  for (const route of ["/shop", "/test-results", "/faqs"]) {
    await page.goto(base + route, { waitUntil: "networkidle" });
    // The age gate is a modal on first visit; accept it so the page is reachable.
    const gate = page.getByRole("button", { name: /enter|confirm|i am|agree|continue/i }).first();
    if (await gate.isVisible().catch(() => false)) { await gate.click(); await page.waitForTimeout(300); }
    await page.keyboard.press("Tab");
    const first = await page.evaluate(() => ({ text: document.activeElement?.textContent?.trim(), href: document.activeElement?.getAttribute("href") }));
    const onSkip = first.href === "#main" && /skip to content/i.test(first.text || "");
    await page.keyboard.press("Enter");
    await page.waitForTimeout(150);
    const landed = await page.evaluate(() => { const a = document.activeElement; const m = document.getElementById("main"); return !!m && (a === m || m.contains(a)); });
    const pass = onSkip && landed;
    if (!pass) keyboardFailures++;
    console.log(`${pass ? "✓" : "✗"} keyboard ${route}: first Tab → ${JSON.stringify(first)}; Enter → focus ${landed ? "inside" : "OUTSIDE"} #main`);
  }
  await context.close();
}


await browser.close();
const blocking = report.filter((r) => r.impact === "critical" || r.impact === "serious").length;
console.log(`\ncritical/serious findings: ${blocking}; landmark findings: ${landmark}; keyboard failures: ${keyboardFailures}; report: ${out}`);
process.exit(blocking || landmark || keyboardFailures ? 1 : 0);
