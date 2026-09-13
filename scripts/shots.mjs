// scripts/shots.mjs — screenshots of key routes at 320 and 1280 for visual
// verification (§7). Usage: node scripts/shots.mjs <label> <outDir> [baseUrl]
import { chromium } from "@playwright/test";
import fs from "node:fs";
import path from "node:path";
const [label, outDir, base = "http://localhost:4180"] = process.argv.slice(2);
const exe = process.env.PLAYWRIGHT_CHROMIUM_PATH || "/opt/pw-browsers/chromium-1194/chrome-linux/chrome";
const browser = await chromium.launch({ executablePath: fs.existsSync(exe) ? exe : undefined });
const routes = ["/", "/product/bpc-157", "/test-results"];
for (const w of [320, 1280]) {
  const page = await browser.newPage({ viewport: { width: w, height: 900 } });
  for (const r of routes) {
    await page.goto(base + r, { waitUntil: "networkidle" });
    await page.waitForTimeout(600);
    const file = path.join(outDir, `${label}-${w}-${r === "/" ? "home" : r.replace(/\//g, "_").replace(/^_/, "")}.png`);
    await page.screenshot({ path: file, fullPage: false });
    const fam = await page.evaluate(() => getComputedStyle(document.querySelector("h1") || document.body).fontFamily);
    const loaded = await page.evaluate(async () => { await document.fonts.ready; return [...document.fonts].filter((f) => f.status === "loaded").map((f) => `${f.family} ${f.weight}`); });
    console.log(`${label} ${w}px ${r}: h1 font-family="${fam}" | loaded faces: ${loaded.length} (${[...new Set(loaded.map((x) => x.split(" ")[0]))].join(", ")})`);
    if (r === "/" && w === 1280) {
      const widths = await page.evaluate(() => {
        const c = document.createElement("canvas").getContext("2d");
        const m = (fam, wt) => { c.font = `${wt} 40px "${fam}"`; return Math.round(c.measureText("Noir Peptides Research Catalog").width); };
        return { syne: [600, 700, 800].map((wt) => m("Syne", wt)), dm: [300, 400, 500, 600].map((wt) => m("DM Sans", wt)), mono: [400, 500, 600].map((wt) => m("IBM Plex Mono", wt)) };
      });
      console.log(`${label} weight-axis widths — Syne 600/700/800: ${widths.syne.join("/")} · DM Sans 300/400/500/600: ${widths.dm.join("/")} · Plex Mono 400/500/600: ${widths.mono.join("/")}`);
    }
  }
  await page.close();
}
await browser.close();
