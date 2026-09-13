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
await browser.close();
fs.writeFileSync(out, JSON.stringify(report, null, 2));
const byRule = {};
for (const r of report) { const k = `${r.impact}|${r.id}`; byRule[k] = byRule[k] || { impact: r.impact, id: r.id, help: r.help, pages: new Set(), nodes: 0 }; byRule[k].pages.add(`${r.route}@${r.width}`); byRule[k].nodes += r.count; }
const order = { critical: 0, serious: 1, moderate: 2, minor: 3 };
console.log("\n=== violations by rule ===");
for (const v of Object.values(byRule).sort((a, b) => order[a.impact] - order[b.impact])) console.log(`[${v.impact}] ${v.id} — ${v.help} — ${v.nodes} node(s) on ${v.pages.size} page-view(s)`);
const blocking = report.filter((r) => r.impact === "critical" || r.impact === "serious").length;
console.log(`\ncritical/serious findings: ${blocking}; report: ${out}`);
process.exit(blocking ? 1 : 0);
