/*
  scripts/perf-compare.mjs   (opt cycle 4 — scorecard 4.7)
  A/B the same routes against two servers (e.g. main's dist on :4181 and the
  branch's dist on :4180), N runs each, back to back, on the throttled-mobile
  profile perf-profile.mjs uses. Prints per run FCP / final LCP and the LCP
  CANDIDATE SEQUENCE (cycle 3's lesson: the last number hides the mode
  change), then medians. Report only.

  Usage: node scripts/perf-compare.mjs <urlA> <urlB> [runs=3] [routes=/,/shop,/product/bpc-157]
*/
import { chromium } from "@playwright/test";
import fs from "node:fs";
const [A, B, runsArg = "3", routesArg = "/,/shop,/product/bpc-157"] = process.argv.slice(2);
if (!A || !B) { console.error("usage: perf-compare <urlA> <urlB> [runs] [routes]"); process.exit(2); }
const runs = Number(runsArg);
const routes = routesArg.split(",");
const exe = process.env.PLAYWRIGHT_CHROMIUM_PATH || "/opt/pw-browsers/chromium-1194/chrome-linux/chrome";
const browser = await chromium.launch({ executablePath: fs.existsSync(exe) ? exe : undefined });
const median = (xs) => { const s = [...xs].sort((a, b) => a - b); return s.length ? s[Math.floor(s.length / 2)] : null; };
async function measure(base, route) {
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
  const page = await ctx.newPage();
  await page.route("**/sw.js", (r) => r.fulfill({ status: 404, body: "" }));
  const cdp = await ctx.newCDPSession(page);
  await cdp.send("Network.enable");
  await cdp.send("Network.emulateNetworkConditions", { offline: false, latency: 150, downloadThroughput: 1.6e6 / 8, uploadThroughput: 750e3 / 8 });
  await cdp.send("Emulation.setCPUThrottlingRate", { rate: 4 });
  await page.addInitScript(() => { window.__lcp = []; new PerformanceObserver((l) => { for (const e of l.getEntries()) window.__lcp.push(Math.round(e.startTime)); }).observe({ type: "largest-contentful-paint", buffered: true }); });
  await page.goto(base + route, { waitUntil: "load" });
  await page.waitForTimeout(4500);
  const r = await page.evaluate(() => ({ fcp: Math.round(performance.getEntriesByName("first-contentful-paint")[0]?.startTime || 0), seq: window.__lcp, kb: Math.round(performance.getEntriesByType("resource").reduce((a, x) => a + (x.transferSize || 0), 0) / 1024) }));
  await ctx.close();
  return r;
}
const summary = {};
for (const route of routes) {
  const res = { A: [], B: [] };
  for (let i = 0; i < runs; i++) {
    for (const [k, base] of [["A", A], ["B", B]]) {
      const r = await measure(base, route);
      res[k].push(r);
      console.log(`${route.padEnd(18)} ${k} run ${i}  FCP ${String(r.fcp).padStart(5)}  LCP ${String(r.seq.at(-1)).padStart(5)}  seq ${JSON.stringify(r.seq)}  ${r.kb} KB`);
    }
  }
  summary[route] = { A: { fcp: median(res.A.map((r) => r.fcp)), lcp: median(res.A.map((r) => r.seq.at(-1))), kb: median(res.A.map((r) => r.kb)) }, B: { fcp: median(res.B.map((r) => r.fcp)), lcp: median(res.B.map((r) => r.seq.at(-1))), kb: median(res.B.map((r) => r.kb)) } };
}
await browser.close();
console.log("\n=== medians (A → B) ===");
for (const [route, s] of Object.entries(summary)) console.log(`${route.padEnd(18)} FCP ${s.A.fcp} → ${s.B.fcp}   LCP ${s.A.lcp} → ${s.B.lcp} (${s.B.lcp - s.A.lcp >= 0 ? "+" : ""}${s.B.lcp - s.A.lcp})   KB ${s.A.kb} → ${s.B.kb}`);
