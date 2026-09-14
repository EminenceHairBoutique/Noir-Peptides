/*
  scripts/test-shell-parity.mjs   (opt cycle 12 — scorecard 4.7)
  The paint-first result (opt cycle 11, Hy-008) holds only while every
  prerendered shell's largest above-the-fold text block is at least as large
  as the hydrated page's — three hand-placed inline styles nobody guarded.
  For one representative route per prerendered family this loads the page
  with every script blocked (the shell as painted), measures the largest
  visible text block, then loads normally, waits for hydration and measures
  again. Shell ≥ React on every family, or the gate fails and names the route.

    node scripts/test-shell-parity.mjs [baseUrl]   (default http://localhost:4180)
  Wired as `npm run test:parity` in the E2E job next to test:bytes.
*/
import { chromium } from "@playwright/test";

const base = (process.argv[2] || process.env.E2E_BASE_URL || "http://localhost:4180").replace(/\/+$/, "");
const ROUTES = ["/", "/shop", "/shop/tissue-repair-research", "/product/bpc-157", "/test-results", "/test-results/bpc-157", "/partners", "/research", "/deals", "/documents", "/faqs", "/about"];
const exe = process.env.PLAYWRIGHT_CHROMIUM_PATH;

let failures = 0;
const ok = (c, m) => { if (c) console.log(`  ✓ ${m}`); else { failures++; console.error(`  ✗ ${m}`); } };

const largestTextBlock = async (page) => page.evaluate(() => {
  const vw = window.innerWidth, vh = window.innerHeight;
  let best = { area: 0, tag: null, text: "" };
  for (const el of document.querySelectorAll("main p, main h1, main h2, main li, main td, #root p, #root h1, #root h2")) {
    const r = el.getBoundingClientRect();
    if (!(el.textContent || "").trim()) continue;
    const w = Math.max(0, Math.min(r.right, vw) - Math.max(r.left, 0));
    const h = Math.max(0, Math.min(r.bottom, vh) - Math.max(r.top, 0));
    const area = Math.round(w * h);
    if (area > best.area) best = { area, tag: el.tagName, text: (el.textContent || "").trim().slice(0, 50) };
  }
  return best;
});

const browser = await chromium.launch({ executablePath: exe || undefined });
const rows = [];
try {
  for (const route of ROUTES) {
    const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 1 });
    await ctx.addInitScript(() => { try { localStorage.setItem("np_age_ack_v1", "1"); localStorage.setItem("np_cookie_consent", JSON.stringify({ necessary: true, analytics: false, marketing: false, timestamp: Date.now() })); } catch { /* ignore */ } });
    // 1. The shell as painted: no script runs.
    const shellPage = await ctx.newPage();
    await shellPage.route("**/*.js", (r) => r.abort());
    await shellPage.goto(base + route, { waitUntil: "load" });
    await shellPage.waitForTimeout(300);
    const shell = await largestTextBlock(shellPage);
    await shellPage.close();
    // 2. The hydrated page.
    const page = await ctx.newPage();
    await page.goto(base + route, { waitUntil: "load" });
    await page.waitForSelector("#root > main", { state: "detached", timeout: 10000 }).catch(() => {});
    await page.waitForTimeout(600);
    const react = await largestTextBlock(page);
    await ctx.close();
    rows.push({ route, shell, react });
    ok(shell.area > 0 && shell.area >= react.area, `${route}: shell ${shell.area} px² (${shell.tag} "${shell.text}") ≥ hydrated ${react.area} px² (${react.tag} "${react.text}")`);
  }
} finally {
  await browser.close();
}
console.log("\nroute | shell px² | hydrated px²");
for (const r of rows) console.log(`${r.route} | ${r.shell.area} | ${r.react.area}`);
if (failures) { console.error(`\n${failures} shell-parity check(s) FAILED`); process.exit(1); }
console.log("\nAll shell-parity checks passed.");
