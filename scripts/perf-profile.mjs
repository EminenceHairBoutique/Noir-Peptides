/*
  scripts/perf-profile.mjs   (opt cycle 3 — scorecard 4.7)
  Throttled-mobile field metrics for the key routes, measured in Chromium
  against the built dist served by scripts/serve-dist.mjs (gzip on):
  TTFB, FCP, LCP (+ element), CLS, request count, transferred KB.
  Emulation: 390×844 mobile, ~1.6 Mbps down / 150 ms RTT, 4× CPU slowdown —
  a Slow-4G-class device. Report only; the numbers go in OPTIMIZATION_LOG.md.

  Usage: node scripts/serve-dist.mjs & node scripts/perf-profile.mjs [baseUrl] [outJson]
*/
import { chromium } from "@playwright/test";
import fs from "node:fs";
const [base = "http://localhost:4180", out = ".perf-report.json"] = process.argv.slice(2);
const exe = process.env.PLAYWRIGHT_CHROMIUM_PATH || "/opt/pw-browsers/chromium-1194/chrome-linux/chrome";
const ROUTES = ["/", "/shop", "/product/bpc-157", "/test-results", "/faqs"];
const browser = await chromium.launch({ executablePath: fs.existsSync(exe) ? exe : undefined });
const rows = [];
for (const route of ROUTES) {
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
  const page = await ctx.newPage();
  const cdp = await ctx.newCDPSession(page);
  await cdp.send("Network.enable");
  await cdp.send("Network.emulateNetworkConditions", { offline: false, latency: 150, downloadThroughput: 1.6e6 / 8, uploadThroughput: 750e3 / 8 });
  await cdp.send("Emulation.setCPUThrottlingRate", { rate: 4 });
  await page.addInitScript(() => {
    window.__lcp = []; window.__cls = 0;
    new PerformanceObserver((l) => { for (const e of l.getEntries()) window.__lcp.push({ t: Math.round(e.startTime), size: e.size, el: e.element ? e.element.tagName + "." + String(e.element.className).split(" ").slice(0, 2).join(".") : "?" }); }).observe({ type: "largest-contentful-paint", buffered: true });
    new PerformanceObserver((l) => { for (const e of l.getEntries()) if (!e.hadRecentInput) window.__cls += e.value; }).observe({ type: "layout-shift", buffered: true });
  });
  await page.goto(base + route, { waitUntil: "load" });
  await page.waitForTimeout(6000);
  const m = await page.evaluate(() => {
    const nav = performance.getEntriesByType("navigation")[0];
    const res = performance.getEntriesByType("resource");
    return {
      ttfb: Math.round(nav?.responseStart || 0),
      fcp: Math.round(performance.getEntriesByName("first-contentful-paint")[0]?.startTime || 0),
      lcp: window.__lcp.at(-1)?.t || null,
      lcpEl: window.__lcp.at(-1)?.el || null,
      cls: Number(window.__cls.toFixed(3)),
      requests: res.length + 1,
      kb: Math.round((res.reduce((a, r) => a + (r.transferSize || 0), 0) + (nav?.transferSize || 0)) / 1024),
    };
  });
  rows.push({ route, ...m });
  console.log(`${route.padEnd(20)} TTFB ${String(m.ttfb).padStart(4)}  FCP ${String(m.fcp).padStart(5)}  LCP ${String(m.lcp).padStart(5)} (${m.lcpEl})  CLS ${m.cls}  ${m.requests} req  ${m.kb} KB`);
  await ctx.close();
}
await browser.close();
fs.writeFileSync(out, JSON.stringify(rows, null, 2));
const worst = Math.max(...rows.map((r) => r.lcp || 0));
console.log(`\nworst LCP ${worst} ms (target < 2500 on throttled mobile); report: ${out}`);
