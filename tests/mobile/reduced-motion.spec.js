// tests/mobile/reduced-motion.spec.js   (opt cycle 10 — scorecards 4.9 / 4.10)
// With prefers-reduced-motion: reduce, nothing animates after load: no CSS
// keyframe animation is running and framer-motion (MotionConfig
// reducedMotion="user") does not run its entrance transforms.
import { test, expect } from "@playwright/test";

test.use({ viewport: { width: 390, height: 844 } });

for (const route of ["/", "/shop", "/product/bpc-157"]) {
  test(`${route} runs no animation under reduced motion`, async ({ page }) => {
    // Emulated per page (a context-level `test.use({ reducedMotion })` did not
    // take effect under this project's device profile).
    await page.emulateMedia({ reducedMotion: "reduce" });
    await page.addInitScript(() => localStorage.setItem("np_age_ack_v1", "1"));
    await page.goto(route, { waitUntil: "networkidle" });
    await page.waitForTimeout(800);
    const state = await page.evaluate(() => ({
      reduce: matchMedia("(prefers-reduced-motion: reduce)").matches,
      running: document.getAnimations().filter((a) => a.playState === "running").map((a) => {
        const el = a.effect?.target;
        return `${a.constructor.name}:${a.animationName || a.id || ""} on ${el?.tagName?.toLowerCase() || "?"}.${(el?.className || "").toString().split(" ").slice(0, 2).join(".")} (computed animation-name: ${el ? getComputedStyle(el).animationName : "?"})`;
      }),
    }));
    expect(state.reduce, "prefers-reduced-motion: reduce is emulated").toBe(true);
    expect(state.running, "animations still running").toEqual([]);
  });
}

test("with motion allowed the hero backdrop does animate (control)", async ({ browser }) => {
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 } });
  const page = await ctx.newPage();
  await page.emulateMedia({ reducedMotion: "no-preference" });
  await page.addInitScript(() => localStorage.setItem("np_age_ack_v1", "1"));
  await page.goto("/", { waitUntil: "networkidle" });
  const running = await page.evaluate(() => document.getAnimations().filter((a) => a.playState === "running").length);
  expect(running).toBeGreaterThan(0);
  await ctx.close();
});

// Opt cycle 12: the hand-written scrolls (route change, checkout step change)
// honour the setting too — under reduce every window.scrollTo is instant.
test("route-change scroll is instant under reduced motion", async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.addInitScript(() => {
    window.localStorage.setItem("np_age_ack_v1", "1");
    window.localStorage.setItem("np_cookie_consent", JSON.stringify({ necessary: true, analytics: false, marketing: false, timestamp: Date.now() }));
    window.__scrollCalls = [];
    const orig = window.scrollTo.bind(window);
    window.scrollTo = (...args) => { window.__scrollCalls.push(args[0] && typeof args[0] === "object" ? args[0].behavior || "unset" : "positional"); return orig(...args); };
  });
  await page.goto("/shop", { waitUntil: "networkidle" });
  await page.getByRole("link", { name: /^BPC-157$/ }).first().click();
  await expect(page).toHaveURL(/\/products?\/bpc-157/);
  await page.waitForTimeout(300);
  const calls = await page.evaluate(() => window.__scrollCalls);
  expect(calls.length, "the route change scrolled").toBeGreaterThan(0);
  expect(calls.filter((b) => b === "smooth"), "no smooth scroll under reduced motion").toEqual([]);
});
