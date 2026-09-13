/*
  scripts/evidence-screens.mjs   (opt cycle 9 — addendum B1; scorecards 4.8 / 4.10)
  The screenshot matrix: every route in dist/sitemap.xml, the age gate on a
  first visit, and the gated /cart + /checkout (steps 1 and 2, through the
  E2E auth fixture) × {320, 390, 768, 1280}, against the served dist.

  Writes  evidence/screens/<route>/<width>.png       (full page, after a
          scroll-through so whileInView sections render)
          evidence/screens/<route>/<width>-fold.png  (the viewport at load —
          a sticky header prints mid-page in full-page captures)
          evidence/screens.json                      (one record per view: HTTP
          status, page errors, console errors, horizontal overflow px)
  Public views run with the age gate acknowledged and cookie consent recorded
  (essential only) so the PAGE is what is reviewed; the first-visit dialogs
  get their own view of "/".
  Exit 1 on any uncaught page error, or a ≥400 response on a sitemap route.
  Overflow is RECORDED here; the mobile suite and the axe sweep own that gate.

  Usage: node scripts/evidence-screens.mjs [baseUrl] [outDir]
*/
import { chromium } from "@playwright/test";
import fs from "node:fs";
import path from "node:path";
import { sitemapRoutes, routeSlug } from "./_sitemap-routes.mjs";
import { installAuth } from "../tests/e2e/fixtures/auth.js";
import { seedCart, fillCheckoutStep1, continueToPayment } from "../tests/e2e/fixtures/checkout.js";

const [base = "http://localhost:4180", outDir = "evidence"] = process.argv.slice(2);
const WIDTHS = [320, 390, 768, 1280];
const CONCURRENCY = 4;
const exe = process.env.PLAYWRIGHT_CHROMIUM_PATH || "/opt/pw-browsers/chromium-1194/chrome-linux/chrome";
const FAKE_HOST = "https://e2e.supabase.co/**";

const routes = sitemapRoutes();
const screensDir = path.join(outDir, "screens");
fs.mkdirSync(screensDir, { recursive: true });
const records = [];
const t0 = Date.now();

function attach(page, rec) {
  page.on("pageerror", (e) => rec.pageErrors.push(String(e?.message || e).split("\n")[0].slice(0, 200)));
  page.on("console", (m) => {
    if (m.type() !== "error") return;
    const text = m.text();
    const loc = m.location()?.url || "";
    // Not defects: the E2E build's fake Supabase host is answered with 503 by
    // design, and the static server has no /api/* functions (Vercel does).
    if (/e2e\.supabase\.co/.test(loc + text) || (/Failed to load resource/.test(text) && /503/.test(text))) { rec.fixtureNoise++; return; }
    if (/Failed to load resource/.test(text) && /\/api\//.test(loc)) { rec.apiNoise++; return; }
    rec.consoleErrors.push(`${text.split("\n")[0].slice(0, 160)}${loc ? ` @ ${loc.replace(/^https?:\/\/[^/]+/, "").slice(0, 80)}` : ""}`);
  });
}

const CONSENT = JSON.stringify({ necessary: true, analytics: false, marketing: false, timestamp: 0, source: "evidence" });
const acknowledgeDialogs = (context) => context.addInitScript((consent) => {
  window.localStorage.setItem("np_age_ack_v1", "1");
  window.localStorage.setItem("np_cookie_consent", consent);
}, CONSENT);

async function shoot(page, rec, file) {
  await page.waitForTimeout(400);
  rec.overflowPx = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  // The fold first (what a visitor sees at load), then a scroll-through so
  // whileInView sections have rendered, then the full page from the top.
  await page.screenshot({ path: file.replace(/\.png$/, "-fold.png"), fullPage: false });
  await page.evaluate(async () => {
    const step = Math.max(400, window.innerHeight - 80);
    for (let y = 0; y < document.documentElement.scrollHeight; y += step) { window.scrollTo(0, y); await new Promise((r) => setTimeout(r, 60)); }
    window.scrollTo(0, 0);
  });
  await page.waitForTimeout(300);
  await page.screenshot({ path: file, fullPage: true });
  rec.file = path.relative(outDir, file);
}

const browser = await chromium.launch({ executablePath: fs.existsSync(exe) ? exe : undefined });
for (const width of WIDTHS) {
  const context = await browser.newContext({ viewport: { width, height: 900 }, deviceScaleFactor: 1 });
  // Public routes: first-visit dialogs acknowledged so the page, not a modal, is what is reviewed.
  await acknowledgeDialogs(context);
  await context.route(FAKE_HOST, (route) => route.fulfill({ status: 503, contentType: "application/json", body: "{}" }));
  const queue = [...routes];
  const workers = Array.from({ length: CONCURRENCY }, async () => {
    const page = await context.newPage();
    while (queue.length) {
      const route = queue.shift();
      const rec = { route, width, status: null, pageErrors: [], consoleErrors: [], fixtureNoise: 0, apiNoise: 0, overflowPx: null, file: null };
      attach(page, rec);
      try {
        const res = await page.goto(base + route, { waitUntil: "networkidle", timeout: 45000 });
        rec.status = res?.status() ?? null;
        const dir = path.join(screensDir, routeSlug(route));
        fs.mkdirSync(dir, { recursive: true });
        await shoot(page, rec, path.join(dir, `${width}.png`));
      } catch (e) {
        rec.pageErrors.push(`navigation: ${String(e?.message || e).split("\n")[0].slice(0, 200)}`);
      }
      page.removeAllListeners("pageerror");
      page.removeAllListeners("console");
      records.push(rec);
    }
    await page.close();
  });
  await Promise.all(workers);
  await context.close();

  // The first-visit dialogs themselves (age gate + cookie consent) on the home page.
  {
    const ctx = await browser.newContext({ viewport: { width, height: 900 }, deviceScaleFactor: 1 });
    await ctx.route(FAKE_HOST, (route) => route.fulfill({ status: 503, contentType: "application/json", body: "{}" }));
    const page = await ctx.newPage();
    const rec = { route: "/ (first visit: age gate + cookie consent)", width, status: null, pageErrors: [], consoleErrors: [], fixtureNoise: 0, apiNoise: 0, overflowPx: null, file: null };
    attach(page, rec);
    try {
      const res = await page.goto(base + "/", { waitUntil: "networkidle", timeout: 45000 });
      rec.status = res?.status() ?? null;
      const dir = path.join(screensDir, "home__first-visit");
      fs.mkdirSync(dir, { recursive: true });
      await shoot(page, rec, path.join(dir, `${width}.png`));
    } catch (e) {
      rec.pageErrors.push(`navigation: ${String(e?.message || e).split("\n")[0].slice(0, 200)}`);
    }
    records.push(rec);
    await ctx.close();
  }

  // Gated pages through the auth fixture (E2E build only; on the production
  // build /cart bounces to /login and the views are recorded as skipped).
  {
    const ctx = await browser.newContext({ viewport: { width, height: 900 }, deviceScaleFactor: 1 });
    const page = await ctx.newPage();
    const gated = [];
    const mk = (label) => { const r = { route: label, width, status: null, pageErrors: [], consoleErrors: [], fixtureNoise: 0, apiNoise: 0, overflowPx: null, file: null, gated: true }; gated.push(r); return r; };
    try {
      await acknowledgeDialogs(ctx);
      await installAuth(page);
      await seedCart(page, base);
      let rec = mk("/cart (authed)");
      attach(page, rec);
      const res = await page.goto(base + "/cart", { waitUntil: "networkidle", timeout: 45000 });
      rec.status = res?.status() ?? null;
      if (!/\/cart$/.test(page.url())) {
        rec.skipped = `dist is not the E2E build; landed on ${new URL(page.url()).pathname}`;
        console.log(`${width}px gated views skipped: ${rec.skipped}`);
      } else {
        fs.mkdirSync(path.join(screensDir, "cart"), { recursive: true });
        await shoot(page, rec, path.join(screensDir, "cart", `${width}.png`));
        page.removeAllListeners("pageerror"); page.removeAllListeners("console");
        rec = mk("/checkout step 1 (authed)"); attach(page, rec);
        const r2 = await page.goto(base + "/checkout", { waitUntil: "networkidle", timeout: 45000 });
        rec.status = r2?.status() ?? null;
        await page.locator("#ct-first").waitFor({ timeout: 15000 });
        fs.mkdirSync(path.join(screensDir, "checkout__step-1"), { recursive: true });
        await shoot(page, rec, path.join(screensDir, "checkout__step-1", `${width}.png`));
        page.removeAllListeners("pageerror"); page.removeAllListeners("console");
        rec = mk("/checkout step 2 (authed)"); attach(page, rec);
        rec.status = r2?.status() ?? null;
        await fillCheckoutStep1(page);
        await continueToPayment(page);
        fs.mkdirSync(path.join(screensDir, "checkout__step-2"), { recursive: true });
        await shoot(page, rec, path.join(screensDir, "checkout__step-2", `${width}.png`));
      }
    } catch (e) {
      (gated[gated.length - 1] || mk("/cart (authed)")).pageErrors.push(`gated flow: ${String(e?.message || e).split("\n")[0].slice(0, 200)}`);
    }
    records.push(...gated);
    await ctx.close();
  }
  console.log(`${width}px: ${records.filter((r) => r.width === width).length} view(s)`);
}
await browser.close();

const failing = records.filter((r) => r.pageErrors.length || (!r.gated && !r.route.includes("first visit") && (r.status == null || r.status >= 400)));
const overflow = records.filter((r) => (r.overflowPx ?? 0) > 1);
const consoleErrors = records.filter((r) => r.consoleErrors.length);
const summary = {
  base, generatedAt: new Date().toISOString(), seconds: Math.round((Date.now() - t0) / 1000),
  widths: WIDTHS, routes: routes.length, views: records.length,
  failing: failing.map((r) => ({ route: r.route, width: r.width, status: r.status, pageErrors: r.pageErrors })),
  overflow: overflow.map((r) => ({ route: r.route, width: r.width, px: r.overflowPx })),
  consoleErrors: consoleErrors.map((r) => ({ route: r.route, width: r.width, errors: r.consoleErrors })),
  skipped: records.filter((r) => r.skipped).map((r) => ({ route: r.route, width: r.width, why: r.skipped })),
  records,
};
fs.writeFileSync(path.join(outDir, "screens.json"), JSON.stringify(summary, null, 2));
console.log(`\n${records.length} views in ${summary.seconds}s → ${path.join(outDir, "screens.json")}; failing ${failing.length}; overflow ${overflow.length}; console errors ${consoleErrors.length}`);
for (const f of failing) console.error(`  ✗ ${f.route} @${f.width}: status ${f.status} ${f.pageErrors.join(" | ")}`);
for (const o of overflow) console.log(`  ⚠ overflow ${o.route} @${o.width}: ${o.px}px`);
process.exit(failing.length ? 1 : 0);
