/*
  Build-time SEO generator for Vite SPA deployments on Vercel.

  - Reads dist/index.html
  - Writes dist/<route>/index.html for important routes (products, catalog, legal)
  - Generates dist/sitemap.xml and dist/robots.txt

  COMPLIANCE: All generated copy is research-use only. Product JSON-LD uses
  Product schema only — no Drug schema, no medicalCondition, no medical claims.

  Run via package.json: "vite build && node scripts/generate-static-seo.mjs"
*/

import fs from "node:fs/promises";
import path from "node:path";
import { execFileSync } from "node:child_process";
import { deriveCoaStats, groupByProduct } from "../src/lib/coaStats.js";
import { fileURLToPath } from "node:url";
import { researchArticles } from "../src/data/research.js";
import {
  getAllProducts,
  getCategories,
  getProductsInCategory,
} from "../src/data/tier1Catalog.js";
import { FAQS, FAQ_HEADING, FAQ_INTRO } from "../src/data/faqs.js";
import {
  ABOUT_COPY,
  CONTACT_COPY,
  DEALS_SHELL,
  TEST_RESULTS_SHELL,
} from "../src/data/pageCopy.js";
import {
  RESEARCH_USE_POLICY_DOC,
  FDA_DISCLAIMER_DOC,
  SHIPPING_REFUNDS_DOC,
  TERMS_DOC,
  PRIVACY_DOC,
  COA_POLICY_DOC,
  QUALITY_DOC,
} from "../src/config/legalCopy.js";

const ROOT = process.cwd();
const DIST_DIR = path.join(ROOT, "dist");

const SITE_NAME = "Noir Peptides";
const DEFAULT_DESCRIPTION =
  "Batch-documented peptide reference materials for laboratory research. COA available. For research use only. Not for human or veterinary use.";

const PRODUCTION_DEFAULT = "https://www.noirpeptides.com";

// ── Resolve a SAFE absolute site URL ────────────────────────────────────────
// The guard's purpose is to never ship localhost/empty canonicals or OG URLs.
// A misconfigured VITE_SITE_URL (the live site had it set to localhost:3000) is
// recoverable: rather than HARD-FAIL the build — which bricks the Vercel
// deploy — we warn loudly and fall back to the production domain so canonicals
// stay correct AND the deploy succeeds. Set SEO_STRICT_SITE_URL=1 to restore the
// fail-the-build behavior (useful in CI that should block on a misconfig).
function isLocalAddress(u) {
  return /localhost|127\.0\.0\.1|0\.0\.0\.0|\[::1\]/i.test(u);
}

function resolveSiteUrl() {
  const raw = String(process.env.VITE_SITE_URL || process.env.SITE_URL || "")
    .trim()
    .replace(/\/+$/, "");

  if (raw && /^https?:\/\//i.test(raw) && !isLocalAddress(raw)) return raw;

  const strict = /^(1|true|yes)$/i.test(process.env.SEO_STRICT_SITE_URL || "");
  if (strict) {
    throw new Error(
      `[seo] VITE_SITE_URL is "${raw || "(empty)"}" — empty, local, or not absolute. ` +
        `Set it to the public production domain (e.g. ${PRODUCTION_DEFAULT}). ` +
        `(SEO_STRICT_SITE_URL is on, so the build fails instead of falling back.)`
    );
  }

  if (raw) {
    console.warn(
      `[seo] WARNING: VITE_SITE_URL is "${raw}" (empty, local, or not absolute). ` +
        `Falling back to ${PRODUCTION_DEFAULT} so the deploy is not blocked and no ` +
        `localhost canonicals are emitted. Set VITE_SITE_URL in Vercel to your real domain.`
    );
  }
  return PRODUCTION_DEFAULT;
}

const SITE_URL = resolveSiteUrl();

const DEFAULT_OG_IMAGE = `${SITE_URL}/assets/noir/noir-og.png`;

const SEO_BEGIN = "<!-- SEO:BEGIN -->";
const SEO_END = "<!-- SEO:END -->";

// ── Deterministic <lastmod> from git ──────────────────────────────────────
// Derived from the commit time of each route's SOURCE-OF-TRUTH file. Never a
// synthetic "today" stamp: a build-date lastmod tells crawlers every page
// changed on every deploy, which is false and wastes crawl budget.
//
// SHALLOW-CLONE HAZARD (this fails SILENTLY if unguarded): in a `--depth 1`
// clone — which `actions/checkout@v4` and most CI/hosting providers do by
// default — `git log -1 -- <file>` resolves EVERY file to the single grafted
// HEAD commit, so every route would share one identical, wrong date. We detect
// that and OMIT lastmod entirely rather than emit a uniform fabricated date;
// <lastmod> is optional in the sitemap protocol, so omission is valid.
//
// TZ=UTC0 normalizes the offset: %cI emits the committer's local offset, so
// slicing the raw string to YYYY-MM-DD can land on the wrong day.
const gitDateCache = new Map();

function isShallowRepo() {
  try {
    return (
      execFileSync("git", ["rev-parse", "--is-shallow-repository"], {
        encoding: "utf8",
        stdio: ["ignore", "pipe", "ignore"],
      }).trim() === "true"
    );
  } catch {
    return true; // no git available → treat as untrustworthy
  }
}

const SHALLOW = isShallowRepo();

function gitLastModified(file) {
  if (SHALLOW) return null;
  if (gitDateCache.has(file)) return gitDateCache.get(file);
  let out = null;
  try {
    const iso = execFileSync(
      "git",
      ["log", "-1", "--format=%cd", "--date=iso-strict-local", "--", file],
      { encoding: "utf8", env: { ...process.env, TZ: "UTC0" }, stdio: ["ignore", "pipe", "ignore"] }
    ).trim();
    out = iso ? iso.slice(0, 10) : null;
  } catch {
    out = null;
  }
  gitDateCache.set(file, out);
  return out;
}

/** Map a route to the file that actually determines its content. */
function sourceFileForRoute(pathname) {
  if (pathname === "/" || pathname === "/shop" || pathname.startsWith("/shop/") || pathname.startsWith("/product/")) {
    return "src/data/tier1Catalog.js";
  }
  if (pathname.startsWith("/research")) return "src/data/research.js";
  if (pathname.startsWith("/legal/")) return "src/config/legalCopy.js";
  if (pathname === "/faqs") return "src/data/faqs.js";
  if (pathname === "/about" || pathname === "/contact") return "src/data/pageCopy.js";
  if (pathname === "/deals") return "src/pages/Deals.jsx";
  if (pathname === "/test-results") return "src/pages/TestResults.jsx";
  if (pathname === "/verify-lot") return "src/pages/VerifyLot.jsx";
  if (pathname === "/calculator") return "src/pages/Calculator.jsx";
  return null;
}

function escapeHtml(str) {
  return String(str || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function abs(pathOrUrl) {
  const val = String(pathOrUrl || "").trim();
  if (!val) return "";
  if (/^https?:\/\//i.test(val)) return val;
  return `${SITE_URL}${val.startsWith("/") ? "" : "/"}${val}`;
}

function ensureSiteUrl(pathname) {
  const p = String(pathname || "/");
  if (p === "/") return `${SITE_URL}/`;
  return `${SITE_URL}${p.startsWith("/") ? "" : "/"}${p}`;
}

function replaceSeoBlock(html, newBlock) {
  const start = html.indexOf(SEO_BEGIN);
  const end = html.indexOf(SEO_END);
  if (start === -1 || end === -1 || end <= start) {
    throw new Error(
      "Could not find SEO markers in dist/index.html. Ensure index.html contains <!-- SEO:BEGIN --> and <!-- SEO:END -->."
    );
  }
  return (
    html.slice(0, start + SEO_BEGIN.length) +
    "\n" +
    newBlock.trim() +
    "\n" +
    html.slice(end)
  );
}

function renderJsonLd({ url, title, description, images, product, breadcrumb }) {
  const graph = [
    {
      "@type": "Organization",
      "@id": `${SITE_URL}/#organization`,
      name: SITE_NAME,
      url: `${SITE_URL}/`,
      logo: images?.[0] || DEFAULT_OG_IMAGE,
    },
    {
      "@type": "WebSite",
      "@id": `${SITE_URL}/#website`,
      url: `${SITE_URL}/`,
      name: SITE_NAME,
      publisher: { "@id": `${SITE_URL}/#organization` },
    },
    {
      "@type": "WebPage",
      "@id": `${url}#webpage`,
      url,
      name: title,
      description,
      isPartOf: { "@id": `${SITE_URL}/#website` },
      about: { "@id": `${SITE_URL}/#organization` },
    },
  ];

  if (product) graph.push(product);
  // BreadcrumbList mirrors the trail already rendered in the prerendered body
  // (renderProductBody's <nav aria-label="Breadcrumb">) EXACTLY — same crumbs,
  // same order. Never invents a crumb the page does not show.
  if (breadcrumb) graph.push(breadcrumb);

  return { "@context": "https://schema.org", "@graph": graph };
}

/**
 * Build a BreadcrumbList from an ordered [{name, item}] trail.
 * Only ever called with crumbs the page actually renders.
 */
function renderBreadcrumb(trail) {
  return {
    "@type": "BreadcrumbList",
    "@id": `${trail[trail.length - 1].item}#breadcrumb`,
    itemListElement: trail.map((c, i) => ({
      "@type": "ListItem",
      position: i + 1,
      name: c.name,
      item: c.item,
    })),
  };
}

/** FAQPage built strictly from the shared FAQ data — no invented Q&A. */
function renderFaqPageJsonLd(url) {
  return {
    "@type": "FAQPage",
    "@id": `${url}#faq`,
    mainEntity: FAQS.map((f) => ({
      "@type": "Question",
      name: f.q,
      acceptedAnswer: { "@type": "Answer", text: f.a },
    })),
  };
}

// Article + BreadcrumbList graph for the public research/education pages (the
// GEO/AI-search surface). Never Drug/MedicalEntity schema.
function renderArticleJsonLd({ url, title, description }) {
  return {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "Organization",
        "@id": `${SITE_URL}/#organization`,
        name: SITE_NAME,
        url: `${SITE_URL}/`,
        logo: DEFAULT_OG_IMAGE,
      },
      {
        // WebSite node added so the Article's isPartOf reference resolves —
        // it previously pointed at an @id that was absent from this graph.
        "@type": "WebSite",
        "@id": `${SITE_URL}/#website`,
        url: `${SITE_URL}/`,
        name: SITE_NAME,
        publisher: { "@id": `${SITE_URL}/#organization` },
      },
      {
        "@type": "Article",
        "@id": `${url}#article`,
        headline: title,
        description,
        url,
        image: DEFAULT_OG_IMAGE,
        author: { "@id": `${SITE_URL}/#organization` },
        publisher: { "@id": `${SITE_URL}/#organization` },
        isPartOf: { "@id": `${SITE_URL}/#website` },
        inLanguage: "en-US",
      },
      {
        "@type": "BreadcrumbList",
        itemListElement: [
          { "@type": "ListItem", position: 1, name: "Home", item: `${SITE_URL}/` },
          { "@type": "ListItem", position: 2, name: "Research", item: `${SITE_URL}/research` },
          { "@type": "ListItem", position: 3, name: title, item: url },
        ],
      },
    ],
  };
}

// Product structured data for each product page. Product schema ONLY — never
// Drug / MedicalEntity / medicalCondition. offers carry price + availability.
function renderProductJsonLd(p) {
  const url = ensureSiteUrl(`/product/${p.slug}`);
  const availability =
    p.stock_status === "out_of_stock"
      ? "https://schema.org/OutOfStock"
      : "https://schema.org/InStock";
  const offers = p.variants.map((v) => ({
    "@type": "Offer",
    sku: v.sku,
    name: `${p.name} ${v.size_label}`,
    price: Number(v.price).toFixed(2),
    priceCurrency: "USD",
    availability,
    itemCondition: "https://schema.org/NewCondition",
    url,
  }));
  const prices = p.variants.map((v) => Number(v.price));
  const product = {
    "@type": "Product",
    "@id": `${url}#product`,
    name: `${p.name} — Research Reference Material`,
    description: p.description,
    category: p.category_name,
    sku: p.variants[0]?.sku,
    brand: { "@type": "Brand", name: SITE_NAME },
    image: DEFAULT_OG_IMAGE,
    offers:
      offers.length === 1
        ? offers[0]
        : {
            "@type": "AggregateOffer",
            priceCurrency: "USD",
            lowPrice: Math.min(...prices).toFixed(2),
            highPrice: Math.max(...prices).toFixed(2),
            offerCount: offers.length,
            availability,
            offers,
          },
    additionalProperty: [
      {
        "@type": "PropertyValue",
        name: "Intended use",
        value: "Research use only — not for human or veterinary use",
      },
    ],
  };
  return renderJsonLd({
    url,
    title: `${p.name} — Research Reference Material`,
    description: p.description,
    images: [DEFAULT_OG_IMAGE],
    product,
  });
}

// ── Crawlable static BODY content ───────────────────────────────────────────
// Injected into #root in the prerendered HTML. The SPA mounts with
// createRoot().render(), which REPLACES #root's children on load — so crawlers
// and no-JS clients get full server-side content while users get the live app.
// (Not hydrateRoot, so there is no hydration-mismatch concern.) Keep it plain
// semantic HTML; styling comes from the hydrated app.
const RUO_LINE =
  "For research use only. Not for human or veterinary use.";

function fmtUsd(n) {
  const s = Number(n).toFixed(2);
  return `$${s.endsWith(".00") ? s.slice(0, -3) : s}`;
}

function renderProductBody(p, related = []) {
  const from = Math.min(...p.variants.map((v) => Number(v.price)));
  const sizes = p.variants
    .map((v) => `<li>${escapeHtml(v.size_label)} — ${fmtUsd(v.price)}</li>`)
    .join("");
  return [
    "<main>",
    `<nav aria-label="Breadcrumb"><a href="/">Home</a> / <a href="/shop">Shop</a> / ` +
      `<a href="/shop/${escapeHtml(p.category_slug)}">${escapeHtml(p.category_name)}</a></nav>`,
    `<h1>${escapeHtml(p.name)} — Research Reference Material</h1>`,
    `<p>From ${fmtUsd(from)}</p>`,
    `<p>${escapeHtml(p.description)}</p>`,
    `<h2>Available sizes</h2><ul>${sizes}</ul>`,
    // Task 5 — internal linking for crawl depth. Real, already-public catalog
    // data (same category, excluding self); no invented relationships.
    related.length
      ? `<h2>More in ${escapeHtml(p.category_name)}</h2><ul>${related
          .map(
            (r) =>
              `<li><a href="/product/${escapeHtml(r.slug)}">${escapeHtml(r.name)}</a> — from ${fmtUsd(
                r.fromPrice
              )}</li>`
          )
          .join("")}</ul>`
      : "",
    `<p><strong>${RUO_LINE}</strong></p>`,
    renderFooterNav(),
    "</main>",
  ].join("");
}

function renderListBody(heading, intro, prods, trail) {
  const crumbs = trail
    ? `<nav aria-label="Breadcrumb">${trail
        .map((c, i) => `${i ? " / " : ""}<a href="${escapeHtml(c.href)}">${escapeHtml(c.name)}</a>`)
        .join("")}</nav>`
    : "";
  const items = prods
    .map(
      (p) =>
        `<li><a href="/product/${escapeHtml(p.slug)}">${escapeHtml(p.name)}</a> — from ${fmtUsd(
          p.fromPrice
        )}</li>`
    )
    .join("");
  return [
    "<main>",
    crumbs,
    `<h1>${escapeHtml(heading)}</h1>`,
    `<p>${escapeHtml(intro)}</p>`,
    `<ul>${items}</ul>`,
    `<p><strong>${RUO_LINE}</strong></p>`,
    renderFooterNav(),
    "</main>",
  ].join("");
}

// Homepage crawlable body. (Historical note: this comment once claimed "every
// other public route got body injection" — that was false. As of the Aug-28
// crawlability pass, EVERY emitted route gets a body except the four in
// PRERENDER_EMPTY_ALLOWLIST; scripts/test-prerender-coverage.mjs enforces it.) Copy here is reused verbatim from the live PublicLanding
// hero and the existing category data — no new claims, no "Performance" (that
// tagline is being retired), RUO-safe throughout. React replaces this on
// hydration; the same treatment on shop/category/product routes is CLS-clean.
function renderHomeBody(categories) {
  const catLinks = categories
    .map((c) => `<li><a href="/shop/${escapeHtml(c.slug)}">${escapeHtml(c.name)}</a></li>`)
    .join("");
  return [
    "<main>",
    "<h1>Noir Peptides — Research-Grade Peptide Reference Materials</h1>",
    "<p>A research-grade peptide reference catalog for qualified purchasers. " +
      "Access requires an account and a completed research-use attestation.</p>",
    "<p>Batch-documented peptide reference materials for laboratory research. " +
      "Per-batch certificate of analysis available.</p>",
    `<nav aria-label="Research catalog"><ul>` +
      `<li><a href="/shop">Research Catalog</a></li>${catLinks}</ul></nav>`,
    `<p><strong>${RUO_LINE}</strong></p>`,
    renderFooterNav(),
    "</main>",
  ].join("");
}

// ── Shared crawlable-body helpers ─────────────────────────────────────────
// A compact footer nav emitted on every prerendered informational page so any
// public page is <=2 clicks from every other (crawl depth). Links only — no
// copy, nothing fabricated.
const FOOTER_NAV = [
  { href: "/shop", label: "Research Catalog" },
  { href: "/research", label: "Research & Education" },
  { href: "/test-results", label: "Test Results (COA Library)" },
  { href: "/verify-lot", label: "Verify a Lot" },
  { href: "/about", label: "About" },
  { href: "/faqs", label: "FAQ" },
  { href: "/contact", label: "Contact" },
  { href: "/legal/research-use-policy", label: "Research-Use Policy" },
  { href: "/legal/fda-disclaimer", label: "FDA Disclaimer" },
  { href: "/legal/shipping", label: "Shipping & Refunds" },
  { href: "/legal/terms", label: "Terms & Conditions" },
  { href: "/legal/privacy", label: "Privacy Policy" },
];

function renderFooterNav() {
  const links = FOOTER_NAV.map(
    (l) => `<li><a href="${escapeHtml(l.href)}">${escapeHtml(l.label)}</a></li>`
  ).join("");
  return `<nav aria-label="Site"><ul>${links}</ul></nav>`;
}

/** Wrap page blocks in <main> with the RUO line + footer nav on every page. */
function wrapBody(blocks) {
  return ["<main>", ...blocks, `<p><strong>${RUO_LINE}</strong></p>`, renderFooterNav(), "</main>"].join("");
}

/**
 * Render the plain-text legal/policy documents (src/config/legalCopy.js) to
 * semantic HTML. Mirrors src/components/LegalDoc.jsx: "# h1", "## h2",
 * "- " lists, "N. " ordered lists, blank-line-separated paragraphs. Same
 * source string, so the crawlable body and the React page cannot drift.
 */
function renderLegalDocBody(doc) {
  const lines = String(doc || "").replace(/\r\n/g, "\n").split("\n");
  const out = [];
  let para = [];
  let list = null; // { ordered: boolean, items: string[] }

  const flushPara = () => {
    if (para.length) {
      out.push(`<p>${escapeHtml(para.join(" "))}</p>`);
      para = [];
    }
  };
  const flushList = () => {
    if (list) {
      const tag = list.ordered ? "ol" : "ul";
      out.push(`<${tag}>${list.items.map((i) => `<li>${escapeHtml(i)}</li>`).join("")}</${tag}>`);
      list = null;
    }
  };
  const flushAll = () => {
    flushPara();
    flushList();
  };

  for (const raw of lines) {
    const line = raw.trim();
    if (line === "") {
      flushAll();
      continue;
    }
    if (line.startsWith("## ")) {
      flushAll();
      out.push(`<h2>${escapeHtml(line.slice(3))}</h2>`);
      continue;
    }
    if (line.startsWith("# ")) {
      flushAll();
      out.push(`<h1>${escapeHtml(line.slice(2))}</h1>`);
      continue;
    }
    if (line.startsWith("- ")) {
      flushPara();
      if (!list || list.ordered) {
        flushList();
        list = { ordered: false, items: [] };
      }
      list.items.push(line.slice(2));
      continue;
    }
    const om = line.match(/^(\d+)\.\s+(.*)$/);
    if (om) {
      flushPara();
      if (!list || !list.ordered) {
        flushList();
        list = { ordered: true, items: [] };
      }
      list.items.push(om[2]);
      continue;
    }
    flushList();
    para.push(line);
  }
  flushAll();
  return wrapBody(out);
}

function renderAboutBody() {
  const pillars = ABOUT_COPY.pillars
    .map((p) => `<h3>${escapeHtml(p.title)}</h3><p>${escapeHtml(p.body)}</p>`)
    .join("");
  const cta = ABOUT_COPY.ctaLinks
    .map((l) => `<li><a href="${escapeHtml(l.href)}">${escapeHtml(l.label)}</a></li>`)
    .join("");
  return wrapBody([
    `<h1>${escapeHtml(ABOUT_COPY.heading)}</h1>`,
    `<p>${escapeHtml(ABOUT_COPY.intro)}</p>`,
    `<h2>${escapeHtml(ABOUT_COPY.standardOverline)}</h2>`,
    `<p>${escapeHtml(ABOUT_COPY.standard)}</p>`,
    pillars,
    `<h2>${escapeHtml(ABOUT_COPY.ctaHeading)}</h2><ul>${cta}</ul>`,
  ]);
}

function renderFaqsBody() {
  const items = FAQS.map(
    (f) => `<h2>${escapeHtml(f.q)}</h2><p>${escapeHtml(f.a)}</p>`
  ).join("");
  return wrapBody([
    `<h1>${escapeHtml(FAQ_HEADING)}</h1>`,
    `<p>${escapeHtml(FAQ_INTRO)}</p>`,
    items,
  ]);
}

function renderContactBody() {
  const lists = CONTACT_COPY.lists
    .map(
      (l) =>
        `<h2>${escapeHtml(l.heading)}</h2><ul>${l.items
          .map((i) => `<li>${escapeHtml(i)}</li>`)
          .join("")}</ul>`
    )
    .join("");
  return wrapBody([
    `<h1>${escapeHtml(CONTACT_COPY.heading)}</h1>`,
    `<p>${escapeHtml(CONTACT_COPY.intro)}</p>`,
    `<p>${escapeHtml(CONTACT_COPY.noGuidance)}</p>`,
    lists,
  ]);
}

/**
 * DB-driven pages: prerender the STATIC explanatory shell + navigation ONLY.
 * Never any row data — no synthetic offers, no synthetic COA rows. Live rows
 * render after hydration from Supabase.
 */
function renderShellBody(shell, extraBlocks = []) {
  return wrapBody([
    `<h1>${escapeHtml(shell.heading)}</h1>`,
    `<p>${escapeHtml(shell.intro)}</p>`,
    ...(shell.sectionHeading ? [`<h2>${escapeHtml(shell.sectionHeading)}</h2>`] : []),
    ...extraBlocks,
  ]);
}

function renderResearchIndexBody(articles) {
  const items = articles
    .map(
      (a) =>
        `<li><a href="/research/${escapeHtml(a.slug)}">${escapeHtml(a.title)}</a> — ${escapeHtml(a.summary)}</li>`
    )
    .join("");
  return wrapBody([
    "<h1>Research &amp; Education</h1>",
    `<p>${escapeHtml(
      "Educational articles on certificates of analysis, HPLC purity, and how peptide reference materials are studied in the laboratory."
    )}</p>`,
    `<ul>${items}</ul>`,
  ]);
}

function renderArticleBody(a) {
  const sections = (a.sections || [])
    .map((sec) => `<h2>${escapeHtml(sec.heading)}</h2><p>${escapeHtml(sec.body)}</p>`)
    .join("");
  return wrapBody([
    `<h1>${escapeHtml(a.title)}</h1>`,
    `<p>${escapeHtml(a.summary)}</p>`,
    sections,
  ]);
}

// ── W2/W4: build-time published-COA fetch for the trust surface ──────────
// The /test-results counters and per-product batch tables must be present in
// the PRERENDERED HTML, so when the build environment has Supabase access
// (Vercel deploys do; the sandbox/CI may not) we fetch published rows once via
// the anon REST API (published COAs are public-read by policy, migration
// 0013/0014). With no credentials or on any failure we emit the static shell
// only and SAY SO — never fabricated rows, never placeholder numbers.
async function fetchPublishedCoasAtBuild() {
  const url = String(process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL || "").replace(/\/+$/, "");
  const key = process.env.VITE_SUPABASE_ANON_KEY || "";
  if (!url || !key) {
    console.warn("[seo] no Supabase env at build — /test-results prerenders the static shell only (no counters/batch rows)");
    return null;
  }
  try {
    const res = await fetch(
      `${url}/rest/v1/coas?select=id,product_id,batch_number,lot_number,lab_name,file_url,cas_number,purity_percent,hplc,mass_spec,ms_confirmed,tested_at,is_published&is_published=eq.true&order=tested_at.desc.nullslast&limit=500`,
      { headers: { apikey: key, Authorization: `Bearer ${key}` } }
    );
    if (!res.ok) throw new Error(`coas fetch ${res.status}`);
    const rows = await res.json();
    if (!Array.isArray(rows)) throw new Error("malformed coas response");
    console.log(`[seo] fetched ${rows.length} published COA row(s) for the trust-surface prerender`);
    return rows;
  } catch (e) {
    console.warn(`[seo] COA fetch failed (${e.message}) — /test-results prerenders the static shell only`);
    return null;
  }
}

function fmtIsoDay(d) {
  return d ? String(d).slice(0, 10) : "";
}

/** W2 counters as static, crawlable HTML. Suppressed entirely at zero. */
function renderCoaStatsBlock(stats) {
  if (!stats || stats.totalCerts === 0) return "";
  const metric = (val, label) => `<div><strong>${escapeHtml(String(val))}</strong> ${escapeHtml(label)}</div>`;
  const extra = [];
  if (stats.avgPurity !== null) {
    extra.push(
      `<p>Average assay purity ${escapeHtml(String(stats.avgPurity))}% across ${escapeHtml(String(stats.purityLots))} published lots.</p>`
    );
  }
  if (stats.msConfirmedLots > 0) {
    extra.push(
      `<p>Analytical panel: HPLC purity on ${escapeHtml(String(stats.hplcLots))} lots; mass-spec identity confirmed on ${escapeHtml(String(stats.msConfirmedLots))}.</p>`
    );
  }
  return (
    `<section aria-label="Certificate library summary">` +
    metric(stats.productsWithCerts, "products with published certificates") +
    metric(stats.totalCerts, "published certificates (batches)") +
    (stats.latestTestedAt ? metric(fmtIsoDay(stats.latestTestedAt), "date of most recent certificate") : "") +
    extra.join("") +
    `</section>`
  );
}

/** W4 batch table as static, crawlable HTML. Null CAS/values render empty cells. */
function renderBatchTableHtml(rows, productName) {
  const tr = (c) => {
    const lot = c.lot_number || c.batch_number || "";
    const ms = c.ms_confirmed === true ? "Confirmed" : c.ms_confirmed === false ? "Not confirmed" : c.mass_spec || "";
    const pdf = c.file_url ? `<a href="${escapeHtml(c.file_url)}">PDF</a>` : "";
    return (
      `<tr><th scope="row">${escapeHtml(lot)}</th>` +
      `<td>${c.purity_percent != null ? escapeHtml(`${c.purity_percent}%`) : ""}</td>` +
      `<td>${escapeHtml(c.cas_number || "")}</td>` +
      `<td>${escapeHtml(fmtIsoDay(c.tested_at))}</td>` +
      `<td>${escapeHtml(c.lab_name || "")}</td>` +
      `<td>${escapeHtml(c.hplc || "")}</td>` +
      `<td>${escapeHtml(ms)}</td>` +
      `<td>${pdf}</td></tr>`
    );
  };
  return (
    `<table><caption>Published certificate history for ${escapeHtml(productName)}</caption>` +
    `<thead><tr><th scope="col">Lot</th><th scope="col">Purity %</th><th scope="col">CAS</th>` +
    `<th scope="col">Test date</th><th scope="col">Lab</th><th scope="col">HPLC</th>` +
    `<th scope="col">MS identity</th><th scope="col">Certificate</th></tr></thead>` +
    `<tbody>${rows.map(tr).join("")}</tbody></table>`
  );
}

function injectBody(html, bodyHtml) {
  if (!bodyHtml) return html;
  return html.replace('<div id="root"></div>', `<div id="root">${bodyHtml}</div>`);
}

function renderSeoMeta({
  pathname,
  title,
  description,
  images = [],
  ogType = "website",
  noindex = false,
  jsonLd,
}) {
  const url = ensureSiteUrl(pathname);
  const cleanTitle = String(title || "").trim() || SITE_NAME;
  const finalTitle = cleanTitle.includes(SITE_NAME)
    ? cleanTitle
    : `${cleanTitle} | ${SITE_NAME}`;
  const finalDescription = String(description || DEFAULT_DESCRIPTION).trim();

  const imgList = (Array.isArray(images) ? images : []).map(abs).filter(Boolean);
  const finalImages = imgList.length ? imgList : [DEFAULT_OG_IMAGE];

  const robotsContent = noindex
    ? "noindex,nofollow"
    : "index,follow,max-snippet:-1,max-image-preview:large,max-video-preview:-1";

  const lines = [];
  lines.push(`  <title>${escapeHtml(finalTitle)}</title>`);
  lines.push(
    `  <meta name="description" content="${escapeHtml(finalDescription)}" />`
  );
  lines.push(`  <link rel="canonical" href="${escapeHtml(url)}" />`);
  lines.push(
    `  <meta property="og:site_name" content="${escapeHtml(SITE_NAME)}" />`
  );
  lines.push(`  <meta property="og:title" content="${escapeHtml(finalTitle)}" />`);
  lines.push(
    `  <meta property="og:description" content="${escapeHtml(finalDescription)}" />`
  );
  for (const img of finalImages) {
    lines.push(`  <meta property="og:image" content="${escapeHtml(img)}" />`);
  }
  lines.push(`  <meta property="og:type" content="${escapeHtml(ogType)}" />`);
  lines.push(`  <meta property="og:url" content="${escapeHtml(url)}" />`);
  lines.push(`  <meta name="twitter:card" content="summary_large_image" />`);
  lines.push(`  <meta name="twitter:title" content="${escapeHtml(finalTitle)}" />`);
  lines.push(
    `  <meta name="twitter:description" content="${escapeHtml(finalDescription)}" />`
  );
  lines.push(
    `  <meta name="twitter:image" content="${escapeHtml(finalImages[0])}" />`
  );
  lines.push(`  <meta name="robots" content="${escapeHtml(robotsContent)}" />`);
  if (jsonLd) {
    const safeJson = JSON.stringify(jsonLd).replace(/</g, "\\u003c");
    lines.push('  <script type="application/ld+json" id="ld-json">');
    lines.push(`    ${safeJson}`);
    lines.push("  </script>");
  }
  return lines.join("\n");
}

// Claim-safe FAQ for the home page (no human-use/efficacy claims).
const HOME_FAQ = {
  "@type": "FAQPage",
  mainEntity: [
    {
      "@type": "Question",
      name: "Are Noir Peptides products for human use?",
      acceptedAnswer: {
        "@type": "Answer",
        text: "No. All products are supplied for laboratory research use only and are not for human or veterinary use.",
      },
    },
    {
      "@type": "Question",
      name: "Are these products drugs or supplements?",
      acceptedAnswer: {
        "@type": "Answer",
        text: "No. They are research reference materials, not drugs, supplements, food, or cosmetics, and are not intended to diagnose, treat, cure, or prevent any condition.",
      },
    },
    {
      "@type": "Question",
      name: "What is a Certificate of Analysis (COA)?",
      acceptedAnswer: {
        "@type": "Answer",
        text: "A batch-specific document reporting analytical testing — identity and purity (HPLC/MS) — for the material as supplied.",
      },
    },
  ],
};

// ════════════════════════════════════════════════════════════════════════
// PRERENDER_EMPTY_ALLOWLIST — routes that are EMITTED but intentionally ship
// an empty <div id="root">. These are interactive/auth surfaces with no static
// informational content worth crawling:
//   /login, /register  — auth forms (also noindex)
//   /calculator        — a pure client-side input/output tool
//   /verify-lot        — a lookup form; results come from a live API
// Enforced by scripts/test-prerender-coverage.mjs: any OTHER route shipping an
// empty root fails the gate. Add to this list only with a deliberate reason.
// ════════════════════════════════════════════════════════════════════════
export const PRERENDER_EMPTY_ALLOWLIST = ["/login", "/register", "/calculator", "/verify-lot"];

async function main() {
  await fs.mkdir(DIST_DIR, { recursive: true });

  const indexPath = path.join(DIST_DIR, "index.html");
  const baseHtml = await fs.readFile(indexPath, "utf8");

  // WHAT THIS SCRIPT EMITS (keep this accurate — do not "fix" toward an
  // auth-wall model; the catalog IS meant to be indexable).
  //   INDEXABLE, with crawlable <main> body content:
  //     - home (/), the shop index and all category pages, every product page,
  //       the education pages (/research/*, /calculator, /deals, /test-results),
  //       /about /faqs /contact /verify-lot, and the /legal/* pages.
  //     Catalog reads are public at the data layer (migration 0013), so these
  //     render for anonymous visitors and crawlers. PURCHASE stays gated
  //     (checkout requires auth + a current attestation, enforced server-side).
  //   NOINDEX (emitted but marked noindex,nofollow — thin/transactional):
  //     - /login and /register only.
  //   NOT emitted here (SPA-only, Disallowed in robots.txt): account, cart,
  //     checkout, success/cancel, admin, auth callbacks.
  // Product/list bodies are mirrored from the SAME source as the SQL seed
  // (src/data/tier1Catalog.js) so the static HTML and the DB never drift.
  const homeCategories = getCategories();

  // W2/W4: published COA rows for the trust-surface prerender (null when the
  // build has no database access — shell-only, honestly logged).
  const coaRows = await fetchPublishedCoasAtBuild();
  const coaStats = coaRows ? deriveCoaStats(coaRows) : null;
  const coaGroups = coaRows ? groupByProduct(coaRows) : new Map();
  const productsBySlug = getAllProducts();

  const staticRoutes = [
    // ── Public + indexable ──
    {
      pathname: "/",
      title: "Noir Peptides | Research-Grade Peptide Materials",
      description: DEFAULT_DESCRIPTION,
      bodyHtml: renderHomeBody(homeCategories),
    },
    {
      pathname: "/about",
      title: "About Noir Peptides | Research Material Supplier",
      description:
        "How Noir Peptides sources, documents, and batch-verifies peptide reference materials for laboratory research. For research use only. Not for human or veterinary use.",
      bodyHtml: renderAboutBody(),
    },
    {
      pathname: "/faqs",
      title: "FAQ | Ordering, Documentation & Shipping",
      description:
        "Answers on batch documentation, certificates of analysis, storage, ordering, and shipping for Noir Peptides research reference materials. For research use only.",
      bodyHtml: renderFaqsBody(),
    },
    {
      pathname: "/contact",
      title: "Contact Noir Peptides | Research Support",
      description:
        "Contact Noir Peptides for documentation requests, order support, and qualified-purchaser enquiries. For research use only. Not for human or veterinary use.",
      bodyHtml: renderContactBody(),
    },
    {
      // CONTRADICTION RESOLVED (Aug-28): this route was emitted index,follow
      // AND listed in the sitemap, while src/pages/VerifyLot.jsx passes
      // noindex to <SEO> and robots.txt blocked it via the "/verify" prefix.
      // It is a lookup FORM with no static content (see
      // PRERENDER_EMPTY_ALLOWLIST), so the component's noindex is correct and
      // the generator now agrees: noindex + excluded from the sitemap. It stays
      // CRAWLABLE in robots.txt on purpose — a Disallow would stop crawlers
      // ever seeing the noindex directive.
      noindex: true,
      pathname: "/verify-lot",
      title: "Verify a Lot | Batch Documentation Lookup",
      description:
        "Look up the certificate of analysis and batch documentation for a Noir Peptides research material lot. For research use only.",
      bodyHtml: undefined /* interactive lookup — see PRERENDER_EMPTY_ALLOWLIST */,
    },
    {
      pathname: "/legal/research-use-policy",
      title: "Research-Use Policy",
      description:
        "Noir Peptides research-use policy. Products are supplied strictly for laboratory and research use by qualified purchasers.",
      bodyHtml: renderLegalDocBody(RESEARCH_USE_POLICY_DOC),
    },
    {
      pathname: "/legal/fda-disclaimer",
      title: "FDA Disclaimer",
      description:
        "Noir Peptides products are not FDA approved and are not intended to diagnose, treat, cure, or prevent any disease. For research use only.",
      bodyHtml: renderLegalDocBody(FDA_DISCLAIMER_DOC),
    },
    {
      pathname: "/legal/terms",
      title: "Terms & Conditions",
      description:
        "Terms and conditions for Noir Peptides. Research use only. Not for human or veterinary use.",
      bodyHtml: renderLegalDocBody(TERMS_DOC),
    },
    {
      pathname: "/legal/privacy",
      title: "Privacy Policy",
      description: "Privacy policy for Noir Peptides.",
      bodyHtml: renderLegalDocBody(PRIVACY_DOC),
    },
    {
      pathname: "/legal/shipping",
      title: "Shipping & Refunds Policy",
      description:
        "Noir Peptides shipping and refunds policy. Research use only. All sales final once shipped.",
      bodyHtml: renderLegalDocBody(SHIPPING_REFUNDS_DOC),
    },
    {
      pathname: "/legal/returns",
      title: "Shipping & Refunds Policy",
      description:
        "Noir Peptides returns policy. Due to chain-of-custody and product integrity, all sales are final once shipped.",
      bodyHtml: renderLegalDocBody(SHIPPING_REFUNDS_DOC),
    },

    {
      // Prerendered 404. Vercel's SPA rewrite returns 200 for unknown paths
      // (soft-404), so this page is BOTH noindex,nofollow AND emits explicit
      // "not found" copy, giving crawlers an unambiguous signal even when the
      // HTTP status cannot be 404. See the PR for the residual limitation.
      pathname: "/404",
      title: "Page Not Found",
      description: "This page does not exist.",
      noindex: true,
      bodyHtml: wrapBody([
        "<h1>Page Not Found</h1>",
        "<p>This page does not exist. Use the links below to continue.</p>",
      ]),
    },

    // ── Public auth screens — reachable but noindex (thin content) ──
    {
      pathname: "/login",
      title: "Log In",
      description: "Log in to the Noir Peptides research catalog.",
      noindex: true,
    },
    {
      pathname: "/register",
      title: "Create Account",
      description:
        "Create a Noir Peptides account and complete the research-use attestation.",
      noindex: true,
    },
  ];

  // Public, indexable education pages (no price, no buy button) — the only SEO
  // surface compatible with the auth wall. These funnel to registration.
  const researchRoutes = [
    {
      pathname: "/research",
      bodyHtml: renderResearchIndexBody(researchArticles),
      title: "Research & Education",
      description:
        "Educational articles on certificates of analysis, HPLC purity, and how peptide reference materials are studied in the laboratory. For research use only.",
    },
    {
      pathname: "/calculator",
      title: "Reconstitution Concentration Calculator",
      description:
        "A pure mass-per-volume (mg ÷ mL) laboratory aliquoting reference for research reference material. For research use only.",
    },
    {
      // DB-driven: static shell + nav only. Live offers render after hydration;
      // no synthetic rows are ever prerendered.
      pathname: "/deals",
      bodyHtml: renderShellBody(DEALS_SHELL),
      title: "Deals & Bundle Pricing",
      description:
        "Current promo codes and volume bundle pricing for research reference materials. For research use only. Not for human or veterinary use.",
    },
    {
      // DB-driven: static shell + nav only. Published COAs render after
      // hydration; no synthetic COA rows are ever prerendered.
      pathname: "/test-results",
      bodyHtml: renderShellBody(TEST_RESULTS_SHELL, [
        // W2 counters + W4 batch rows: present in crawlable HTML when the
        // build fetched real published rows; absent otherwise (never faked).
        ...(coaStats ? [renderCoaStatsBlock(coaStats)] : []),
        ...[...coaGroups.entries()].map(([pid, rows]) => {
          const prod = productsBySlug.find((pp) => pp.id === pid);
          const name = prod?.name || pid;
          const link = prod ? `<p><a href="/test-results/${escapeHtml(prod.slug)}">Full batch history for ${escapeHtml(name)}</a></p>` : "";
          return `<h2>${escapeHtml(name)}</h2>` + renderBatchTableHtml(rows, name) + link;
        }),
      ]),
      title: "Test Results — Certificate of Analysis Library",
      description:
        "Batch-specific certificates of analysis (HPLC purity + mass-spec identity) for Noir Peptides research reference materials. Verify any lot. For research use only. Not for human or veterinary use.",
    },
    ...researchArticles.map((a) => ({
      pathname: `/research/${a.slug}`,
      bodyHtml: renderArticleBody(a),
      title: a.title,
      description: a.summary,
      ogType: "article",
      jsonLd: renderArticleJsonLd({
        url: ensureSiteUrl(`/research/${a.slug}`),
        title: a.title,
        description: a.summary,
      }),
    })),
  ];

  // ── Public catalog (indexable) ──
  // Catalog reads are public at the data layer (migration 0013), so the shop
  // index, every category, and every product page are prerendered with real
  // title/description/canonical/OG + Product JSON-LD (offers/price/availability)
  // and crawlable body content. PURCHASE stays gated (checkout requires auth +
  // a current attestation, enforced server-side). Data is mirrored from the
  // same source as the SQL seed (src/data/tier1Catalog.js) so HTML and DB never
  // drift.
  const catalogProducts = getAllProducts();
  const catalogCategories = getCategories();

  const shopRoutes = [
    {
      pathname: "/shop",
      title: "Research Peptide Catalog",
      description:
        "Browse batch-documented peptide reference materials for laboratory research. Per-batch COA available. For research use only. Not for human or veterinary use.",
      bodyHtml: renderListBody(
        "Research Peptide Catalog",
        "Batch-documented peptide reference materials for laboratory research. For research use only. Not for human or veterinary use.",
        catalogProducts
      ),
    },
    ...catalogCategories.map((cat) => ({
      pathname: `/shop/${cat.slug}`,
      title: `${cat.name} — Research Reference Materials`,
      description: `${cat.description} For research use only. Not for human or veterinary use.`,
      bodyHtml: renderListBody(
        cat.name,
        cat.description,
        getProductsInCategory(cat.slug),
        [
          { name: "Home", href: "/" },
          { name: "Shop", href: "/shop" },
          { name: cat.name, href: `/shop/${cat.slug}` },
        ]
      ),
      // Mirrors the trail rendered immediately above.
      breadcrumb: [
        { name: "Home", item: `${SITE_URL}/` },
        { name: "Shop", item: ensureSiteUrl("/shop") },
        { name: cat.name, item: ensureSiteUrl(`/shop/${cat.slug}`) },
      ],
    })),
  ];

  const productRoutes = catalogProducts.map((p) => ({
    pathname: `/product/${p.slug}`,
    title: `${p.name} — Research Reference Material`,
    description: `${p.blurb} For research use only. Not for human or veterinary use.`,
    ogType: "product",
    images: [DEFAULT_OG_IMAGE],
    jsonLd: renderProductJsonLd(p),
    // Mirrors renderProductBody's <nav aria-label="Breadcrumb"> exactly:
    // Home / Shop / <Category>. The product name is the <h1>, not a crumb.
    breadcrumb: [
      { name: "Home", item: `${SITE_URL}/` },
      { name: "Shop", item: ensureSiteUrl("/shop") },
      { name: p.category_name, item: ensureSiteUrl(`/shop/${p.category_slug}`) },
    ],
    bodyHtml: renderProductBody(
      p,
      getProductsInCategory(p.category_slug).filter((r) => r.slug !== p.slug).slice(0, 6)
    ),
  }));

  // W4: prerendered per-product batch-history permalinks — emitted ONLY for
  // products that actually have published certificates at build time (a
  // permalink page with no data would be thin and, with no DB at build,
  // unknowable). The SPA route covers every slug at runtime regardless.
  const batchHistoryRoutes = [...coaGroups.entries()]
    .map(([pid, rows]) => {
      const prod = productsBySlug.find((pp) => pp.id === pid);
      if (!prod) return null;
      return {
        pathname: `/test-results/${prod.slug}`,
        title: `${prod.name} — Batch Test History`,
        description: `Published batch-specific certificates of analysis for ${prod.name}: lot numbers, HPLC purity, mass-spec identity, and test dates. For research use only. Not for human or veterinary use.`,
        bodyHtml: wrapBody([
          // Visible trail mirrors the BreadcrumbList JSON-LD below — the
          // structured data never claims markup the page does not render.
          `<nav aria-label="Breadcrumb"><a href="/">Home</a> / <a href="/test-results">Test Results</a> / ${escapeHtml(prod.name)}</nav>`,
          `<h1>${escapeHtml(prod.name)} — Batch Test History</h1>`,
          `<p>Every published certificate for this material, newest first.</p>`,
          renderBatchTableHtml(rows, prod.name),
          `<p><a href="/product/${escapeHtml(prod.slug)}">View the product page</a></p>`,
        ]),
        breadcrumb: [
          { name: "Home", item: `${SITE_URL}/` },
          { name: "Test Results", item: ensureSiteUrl("/test-results") },
          { name: prod.name, item: ensureSiteUrl(`/test-results/${prod.slug}`) },
        ],
      };
    })
    .filter(Boolean);
  if (batchHistoryRoutes.length) {
    console.log(`[seo] emitting ${batchHistoryRoutes.length} batch-history permalink route(s)`);
  }

  const routes = [
    ...staticRoutes,
    ...researchRoutes,
    ...shopRoutes,
    ...productRoutes,
    ...batchHistoryRoutes,
  ];

  for (const route of routes) {
    const pathname = route.pathname;
    const url = ensureSiteUrl(pathname);
    const images = route.images || [DEFAULT_OG_IMAGE];

    const jsonLd =
      route.jsonLd ||
      renderJsonLd({
        url,
        title: route.title,
        description: route.description,
        images: images.map(abs),
      });

    // Attach the FAQPage to the home page graph.
    if (pathname === "/" && Array.isArray(jsonLd["@graph"])) {
      jsonLd["@graph"].push(HOME_FAQ);
    }

    // /faqs gets a FAQPage built strictly from the shared FAQ data.
    if (pathname === "/faqs" && Array.isArray(jsonLd["@graph"])) {
      jsonLd["@graph"].push(renderFaqPageJsonLd(url));
    }

    // BreadcrumbList for any route that declares a trail it actually renders.
    if (route.breadcrumb && Array.isArray(jsonLd["@graph"])) {
      jsonLd["@graph"].push(renderBreadcrumb(route.breadcrumb));
    }

    const seoBlock = renderSeoMeta({
      pathname,
      title: route.title,
      description: route.description,
      images,
      ogType: route.ogType,
      noindex: Boolean(route.noindex),
      jsonLd,
    });

    const withSeo = replaceSeoBlock(baseHtml, seoBlock);
    const finalHtml = injectBody(withSeo, route.bodyHtml);

    const outFile =
      pathname === "/"
        ? path.join(DIST_DIR, "index.html")
        : path.join(DIST_DIR, pathname.replace(/^\//, ""), "index.html");

    await fs.mkdir(path.dirname(outFile), { recursive: true });
    await fs.writeFile(outFile, finalHtml, "utf8");
  }

  // The public catalog (shop, categories, products) + education + legal pages
  // are indexable. Only private / commerce-action / auth routes are disallowed
  // (no index value; keep crawlers out of user-specific and transactional flows).
  const robots = [
    "User-agent: *",
    "Allow: /",
    "",
    "# Private, transactional, and auth routes (no index value)",
    "Disallow: /api/",
    "Disallow: /home",
    "Disallow: /account",
    "Disallow: /cart",
    "Disallow: /checkout",
    "Disallow: /success",
    "Disallow: /cancel",
    "Disallow: /admin",
    "Disallow: /privacy-choices",
    "Disallow: /login",
    "Disallow: /register",
    // Exact-path rules ($ anchors them). "Disallow: /verify" was a PREFIX
    // rule that also blocked /verify-lot — an indexable, prerendered page
    // that is in the sitemap. Anchor it so only /verify itself is blocked.
    "Disallow: /verify$",
    "Disallow: /forgot-password",
    "Disallow: /reset-password",
    "Disallow: /auth/",
    "",
    `Sitemap: ${SITE_URL}/sitemap.xml`,
    "",
  ].join("\n");
  await fs.writeFile(path.join(DIST_DIR, "robots.txt"), robots, "utf8");

  const sitemapRoutes = routes
    .filter((r) => !r.noindex)
    .map((r) => {
      const src = sourceFileForRoute(r.pathname);
      return { loc: ensureSiteUrl(r.pathname), lastmod: src ? gitLastModified(src) : null };
    })
    .sort((a, b) => a.loc.localeCompare(b.loc));

  const sitemap =
    `<?xml version="1.0" encoding="UTF-8"?>\n` +
    `<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n` +
    sitemapRoutes
      .map(
        (r) =>
          `  <url>\n    <loc>${escapeHtml(r.loc)}</loc>` +
          (r.lastmod ? `\n    <lastmod>${r.lastmod}</lastmod>` : "") +
          `\n  </url>`
      )
      .join("\n") +
    `\n</urlset>\n`;
  await fs.writeFile(path.join(DIST_DIR, "sitemap.xml"), sitemap, "utf8");

  console.log(`[seo] wrote ${routes.length} route HTML files`);
  console.log(`[seo] wrote sitemap.xml (${sitemapRoutes.length} urls)`);
  console.log(`[seo] wrote robots.txt`);
}

// Run only when invoked directly (`node scripts/generate-static-seo.mjs`).
// Tests import PRERENDER_EMPTY_ALLOWLIST from this module; without this guard
// that import would re-run the entire generator as a side effect.
const invokedDirectly =
  process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);

if (invokedDirectly) {
  main().catch((err) => {
    console.error("[seo] generation failed:", err);
    process.exit(1);
  });
}
