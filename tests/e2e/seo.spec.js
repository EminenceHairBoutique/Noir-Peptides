import { test, expect } from "@playwright/test";

/**
 * SEO integrity coverage (the localhost-canonical leak regression guard).
 * Runs against the production build served by `vite preview`.
 */

test("home canonical + og:url are absolute and never localhost", async ({
  page,
}) => {
  await page.goto("/");
  const canonical = await page
    .locator("link[rel='canonical']")
    .getAttribute("href");
  const ogUrl = await page
    .locator("meta[property='og:url']")
    .getAttribute("content");

  for (const url of [canonical, ogUrl]) {
    expect(url, "URL should be present").toBeTruthy();
    expect(url).toMatch(/^https?:\/\//);
    expect(url).not.toMatch(/localhost|127\.0\.0\.1/);
  }
});

test("robots.txt disallows the gated storefront and has no localhost", async ({
  request,
}) => {
  const res = await request.get("/robots.txt");
  expect(res.ok()).toBeTruthy();
  const body = await res.text();
  expect(body).not.toMatch(/localhost|127\.0\.0\.1/);
  for (const path of ["/shop", "/checkout", "/account", "/products", "/coa"]) {
    expect(body).toContain(`Disallow: ${path}`);
  }
});

test("sitemap.xml is present, absolute, and localhost-free", async ({
  request,
}) => {
  const res = await request.get("/sitemap.xml");
  expect(res.ok()).toBeTruthy();
  const body = await res.text();
  expect(body).not.toMatch(/localhost|127\.0\.0\.1/);
  expect(body).toContain("https://");
});
