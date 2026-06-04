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
  const staticRoutes = [
    // ── Public + indexable ──
    {
      pathname: "/",
      title: "Noir Peptides | Research-Grade Peptide Materials",
      description: DEFAULT_DESCRIPTION,
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
    ...researchArticles.map((a) => ({
      pathname: `/research/${a.slug}`,
      title: a.title,
      description: a.summary,
      ogType: "article",
    })),
  ];

  // The gated storefront is intentionally not prerendered. Direct requests fall
  // through Vercel's SPA rewrite to the root document; the client guard then
  // redirects unauthenticated visitors to /login.
  const routes = [...staticRoutes, ...researchRoutes];

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

    const seoBlock = renderSeoMeta({
      pathname,
      title: route.title,
      description: route.description,
      images,
      ogType: route.ogType,
      noindex: Boolean(route.noindex),
      jsonLd,
    });

    const finalHtml = replaceSeoBlock(baseHtml, seoBlock);

    const outFile =
      pathname === "/"
        ? path.join(DIST_DIR, "index.html")
        : path.join(DIST_DIR, pathname.replace(/^\//, ""), "index.html");

    await fs.mkdir(path.dirname(outFile), { recursive: true });
    await fs.writeFile(outFile, finalHtml, "utf8");
  }

  // Gated storefront is behind the auth wall — keep it out of the index.
  const robots = [
    "User-agent: *",
    "Allow: /$",
    "Allow: /legal/",
    "Allow: /research",
    "",
    "Disallow: /api/",
    "Disallow: /home",
    "Disallow: /shop",
    "Disallow: /catalog",
    "Disallow: /product",
    "Disallow: /products",
    "Disallow: /coa",
    "Disallow: /quality",
    "Disallow: /about",
    "Disallow: /faq",
    "Disallow: /contact",
    "Disallow: /account",
    "Disallow: /cart",
    "Disallow: /checkout",
    "Disallow: /success",
    "Disallow: /cancel",
    "Disallow: /admin",
    "Disallow: /privacy-choices",
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
