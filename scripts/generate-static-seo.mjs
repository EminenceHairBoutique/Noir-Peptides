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
import { researchArticles } from "../src/data/research.js";
import {
  getAllProducts,
  getCategories,
  getProductsInCategory,
} from "../src/data/tier1Catalog.js";

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

function renderJsonLd({ url, title, description, images, product }) {
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

  return { "@context": "https://schema.org", "@graph": graph };
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

function renderProductBody(p) {
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
    `<p><strong>${RUO_LINE}</strong></p>`,
    "</main>",
  ].join("");
}

function renderListBody(heading, intro, prods) {
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
    `<h1>${escapeHtml(heading)}</h1>`,
    `<p>${escapeHtml(intro)}</p>`,
    `<ul>${items}</ul>`,
    `<p><strong>${RUO_LINE}</strong></p>`,
    "</main>",
  ].join("");
}

// Homepage crawlable body. Every other public route got body injection; the
// homepage shipped an empty <div id="root">, so crawlers saw no content above
// the hydrated app. Copy here is reused verbatim from the live PublicLanding
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
    "</main>",
  ].join("");
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

async function main() {
  await fs.mkdir(DIST_DIR, { recursive: true });

  const indexPath = path.join(DIST_DIR, "index.html");
  const baseHtml = await fs.readFile(indexPath, "utf8");

  // AUTH WALL / INDEXABILITY SPLIT
  // Only the public tier (landing + legal) is prerendered and indexable. The
  // entire gated storefront (catalog, products, COAs, account, cart, checkout)
  // is intentionally NOT emitted as crawlable HTML and is marked noindex — it
  // lives behind the authentication wall and Supabase RLS. Auth screens are
  // emitted but noindex (thin/duplicate content).
  const homeCategories = getCategories();
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
    },
    {
      pathname: "/faqs",
      title: "FAQ | Ordering, Documentation & Shipping",
      description:
        "Answers on batch documentation, certificates of analysis, storage, ordering, and shipping for Noir Peptides research reference materials. For research use only.",
    },
    {
      pathname: "/contact",
      title: "Contact Noir Peptides | Research Support",
      description:
        "Contact Noir Peptides for documentation requests, order support, and qualified-purchaser enquiries. For research use only. Not for human or veterinary use.",
    },
    {
      pathname: "/verify-lot",
      title: "Verify a Lot | Batch Documentation Lookup",
      description:
        "Look up the certificate of analysis and batch documentation for a Noir Peptides research material lot. For research use only.",
    },
    {
      pathname: "/legal/research-use-policy",
      title: "Research-Use Policy",
      description:
        "Noir Peptides research-use policy. Products are supplied strictly for laboratory and research use by qualified purchasers.",
    },
    {
      pathname: "/legal/fda-disclaimer",
      title: "FDA Disclaimer",
      description:
        "Noir Peptides products are not FDA approved and are not intended to diagnose, treat, cure, or prevent any disease. For research use only.",
    },
    {
      pathname: "/legal/terms",
      title: "Terms & Conditions",
      description:
        "Terms and conditions for Noir Peptides. Research use only. Not for human or veterinary use.",
    },
    {
      pathname: "/legal/privacy",
      title: "Privacy Policy",
      description: "Privacy policy for Noir Peptides.",
    },
    {
      pathname: "/legal/shipping",
      title: "Shipping & Refunds Policy",
      description:
        "Noir Peptides shipping and refunds policy. Research use only. All sales final once shipped.",
    },
    {
      pathname: "/legal/returns",
      title: "Shipping & Refunds Policy",
      description:
        "Noir Peptides returns policy. Due to chain-of-custody and product integrity, all sales are final once shipped.",
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
      pathname: "/deals",
      title: "Deals & Bundle Pricing",
      description:
        "Current promo codes and volume bundle pricing for research reference materials. For research use only. Not for human or veterinary use.",
    },
    {
      pathname: "/test-results",
      title: "Test Results — Certificate of Analysis Library",
      description:
        "Batch-specific certificates of analysis (HPLC purity + mass-spec identity) for Noir Peptides research reference materials. Verify any lot. For research use only. Not for human or veterinary use.",
    },
    ...researchArticles.map((a) => ({
      pathname: `/research/${a.slug}`,
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
        getProductsInCategory(cat.slug)
      ),
    })),
  ];

  const productRoutes = catalogProducts.map((p) => ({
    pathname: `/product/${p.slug}`,
    title: `${p.name} — Research Reference Material`,
    description: `${p.blurb} For research use only. Not for human or veterinary use.`,
    ogType: "product",
    images: [DEFAULT_OG_IMAGE],
    jsonLd: renderProductJsonLd(p),
    bodyHtml: renderProductBody(p),
  }));

  const routes = [
    ...staticRoutes,
    ...researchRoutes,
    ...shopRoutes,
    ...productRoutes,
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
    "Disallow: /verify",
    "Disallow: /forgot-password",
    "Disallow: /reset-password",
    "Disallow: /auth/",
    "",
    `Sitemap: ${SITE_URL}/sitemap.xml`,
    "",
  ].join("\n");
  await fs.writeFile(path.join(DIST_DIR, "robots.txt"), robots, "utf8");

  const today = new Date().toISOString().slice(0, 10);
  const sitemapRoutes = routes
    .filter((r) => !r.noindex)
    .map((r) => ensureSiteUrl(r.pathname))
    .sort();

  const sitemap =
    `<?xml version="1.0" encoding="UTF-8"?>\n` +
    `<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n` +
    sitemapRoutes
      .map(
        (loc) =>
          `  <url>\n    <loc>${escapeHtml(loc)}</loc>\n    <lastmod>${today}</lastmod>\n  </url>`
      )
      .join("\n") +
    `\n</urlset>\n`;
  await fs.writeFile(path.join(DIST_DIR, "sitemap.xml"), sitemap, "utf8");

  console.log(`[seo] wrote ${routes.length} route HTML files`);
  console.log(`[seo] wrote sitemap.xml (${sitemapRoutes.length} urls)`);
  console.log(`[seo] wrote robots.txt`);
}

main().catch((err) => {
  console.error("[seo] generation failed:", err);
  process.exit(1);
});
