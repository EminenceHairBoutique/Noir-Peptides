import { useEffect } from "react";
import { useLocation } from "react-router-dom";

const SITE_NAME = "Noir Peptides";
const DEFAULT_DESCRIPTION =
  "Batch-documented peptide reference materials for laboratory research. COA available. For research use only. Not for human or veterinary use.";
const DEFAULT_IMAGE_PATH = "/assets/noir/noir-og.png";

const PRODUCTION_SITE_URL = "https://www.noirpeptides.com";

// Never emit a localhost/loopback canonical or OG URL at runtime. If the build
// was shipped with a misconfigured VITE_SITE_URL, prefer the live origin (when
// it isn't itself localhost) and otherwise fall back to the production domain.
function getSiteUrl() {
  const raw = String(import.meta?.env?.VITE_SITE_URL || "").trim();
  const isLocal = (val) => /localhost|127\.0\.0\.1|0\.0\.0\.0|\[::1\]/i.test(val);

  if (raw && /^https?:\/\//i.test(raw) && !isLocal(raw)) {
    return raw.replace(/\/+$/, "");
  }

  if (typeof window !== "undefined" && window.location?.origin) {
    const origin = window.location.origin;
    if (!isLocal(origin)) return origin.replace(/\/+$/, "");
  }

  return PRODUCTION_SITE_URL;
}

function toAbsoluteUrl(pathOrUrl) {
  const site = getSiteUrl();
  const val = String(pathOrUrl || "").trim();
  if (!val) return site;
  if (/^https?:\/\//i.test(val)) return val;
  return `${site}${val.startsWith("/") ? "" : "/"}${val}`;
}

function upsertMeta({ selector, attrs, content }) {
  if (!content) return;
  let el = document.querySelector(selector);
  if (!el) {
    el = document.createElement("meta");
    Object.entries(attrs).forEach(([k, v]) => el.setAttribute(k, v));
    document.head.appendChild(el);
  }
  el.setAttribute("content", content);
}

function upsertLink({ rel, href }) {
  if (!href) return;
  let el = document.querySelector(`link[rel='${rel}']`);
  if (!el) {
    el = document.createElement("link");
    el.setAttribute("rel", rel);
    document.head.appendChild(el);
  }
  el.setAttribute("href", href);
}

/**
 * Write JSON-LD, PRESERVING the richer build-time graph on first load.
 *
 * The prerenderer emits a full @graph per route (Organization + WebSite +
 * WebPage + Product/Article + BreadcrumbList). Page components pass a single
 * bare node. Blindly overwriting therefore DESTROYED the graph on hydration —
 * measured: a PDP went from [Organization, WebSite, WebPage, Product] to just
 * [Product], and a research article lost its BreadcrumbList entirely. Google
 * indexes the rendered DOM, so the build-time structured data was being thrown
 * away.
 *
 * Rule: if the script already holds a graph FOR THIS URL (matched on the
 * WebPage/Article/Product @id, so a stale graph from a previous SPA navigation
 * never leaks), keep it — merging in the runtime node only if its @type is not
 * already represented. Otherwise replace, which is the correct behavior for
 * client-side navigation.
 */
function setJsonLd(jsonLd) {
  const script = document.getElementById("ld-json");
  if (!script) return;
  try {
    const next = mergeWithBuildTimeGraph(jsonLd, script.textContent);
    script.textContent = JSON.stringify(next).replace(/</g, "\\u003c");
  } catch {
    // ignore
  }
}

function mergeWithBuildTimeGraph(runtime, existingText) {
  if (!existingText) return runtime;
  let existing;
  try {
    existing = JSON.parse(existingText);
  } catch {
    return runtime;
  }
  const graph = existing?.["@graph"];
  if (!Array.isArray(graph) || graph.length === 0) return runtime;

  // Does the existing graph describe the page we are on right now?
  const here = typeof window !== "undefined" ? window.location.pathname : "";
  const describesThisPage = graph.some((n) => {
    const id = typeof n?.["@id"] === "string" ? n["@id"] : "";
    if (!id) return false;
    try {
      const p = new URL(id, window.location.origin).pathname.replace(/\/$/, "");
      return p === here.replace(/\/$/, "");
    } catch {
      return false;
    }
  });
  if (!describesThisPage) return runtime; // stale graph from a prior route

  // Keep the build-time graph; add the runtime node only if it contributes a
  // type the graph does not already carry.
  const runtimeNodes = Array.isArray(runtime?.["@graph"])
    ? runtime["@graph"]
    : runtime && runtime["@type"]
      ? [runtime]
      : [];
  const present = new Set(graph.map((n) => n?.["@type"]).filter(Boolean));
  const additions = runtimeNodes.filter((n) => n?.["@type"] && !present.has(n["@type"]));
  return additions.length ? { ...existing, "@graph": [...graph, ...additions] } : existing;
}

function buildDefaultJsonLd({ url, name, description, image }) {
  const siteUrl = getSiteUrl();
  const logo = toAbsoluteUrl(image || DEFAULT_IMAGE_PATH);

  return {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "Organization",
        "@id": `${siteUrl}/#organization`,
        name: SITE_NAME,
        url: `${siteUrl}/`,
        logo,
      },
      {
        "@type": "WebSite",
        "@id": `${siteUrl}/#website`,
        url: `${siteUrl}/`,
        name: SITE_NAME,
        publisher: { "@id": `${siteUrl}/#organization` },
      },
      {
        "@type": "WebPage",
        "@id": `${url}#webpage`,
        url,
        name,
        description,
        isPartOf: { "@id": `${siteUrl}/#website` },
        about: { "@id": `${siteUrl}/#organization` },
      },
    ],
  };
}

export default function SEO({
  title,
  description,
  image,
  images,
  type = "website",
  noindex = false,
  jsonLd,
}) {
  const location = useLocation();

  useEffect(() => {
    const siteUrl = getSiteUrl();
    const pathname = location?.pathname || "/";

    const cleanTitle = String(title || "").trim();
    const baseTitle = cleanTitle || SITE_NAME;
    const finalTitle = baseTitle.includes(SITE_NAME)
      ? baseTitle
      : `${baseTitle} | ${SITE_NAME}`;

    const finalDescription = String(description || DEFAULT_DESCRIPTION).trim();

    const canonicalUrl =
      pathname === "/" ? `${siteUrl}/` : `${siteUrl}${pathname}`;

    const list =
      Array.isArray(images) && images.length
        ? images
        : image
        ? [image]
        : [DEFAULT_IMAGE_PATH];

    const ogImageAbs = toAbsoluteUrl(list[0] || DEFAULT_IMAGE_PATH);

    document.title = finalTitle;

    upsertLink({ rel: "canonical", href: canonicalUrl });

    upsertMeta({
      selector: "meta[name='description']",
      attrs: { name: "description" },
      content: finalDescription,
    });

    upsertMeta({
      selector: "meta[name='robots']",
      attrs: { name: "robots" },
      content: noindex
        ? "noindex,nofollow"
        : "index,follow,max-snippet:-1,max-image-preview:large,max-video-preview:-1",
    });

    upsertMeta({ selector: "meta[property='og:site_name']", attrs: { property: "og:site_name" }, content: SITE_NAME });
    upsertMeta({ selector: "meta[property='og:title']", attrs: { property: "og:title" }, content: finalTitle });
    upsertMeta({ selector: "meta[property='og:description']", attrs: { property: "og:description" }, content: finalDescription });
    upsertMeta({ selector: "meta[property='og:image']", attrs: { property: "og:image" }, content: ogImageAbs });
    upsertMeta({ selector: "meta[property='og:url']", attrs: { property: "og:url" }, content: canonicalUrl });
    upsertMeta({ selector: "meta[property='og:type']", attrs: { property: "og:type" }, content: type });

    upsertMeta({ selector: "meta[name='twitter:card']", attrs: { name: "twitter:card" }, content: "summary_large_image" });
    upsertMeta({ selector: "meta[name='twitter:title']", attrs: { name: "twitter:title" }, content: finalTitle });
    upsertMeta({ selector: "meta[name='twitter:description']", attrs: { name: "twitter:description" }, content: finalDescription });
    upsertMeta({ selector: "meta[name='twitter:image']", attrs: { name: "twitter:image" }, content: ogImageAbs });

    const schema =
      jsonLd ||
      buildDefaultJsonLd({
        url: canonicalUrl,
        name: finalTitle,
        description: finalDescription,
        image: ogImageAbs,
      });

    setJsonLd(schema);
  }, [title, description, image, JSON.stringify(images || []), type, noindex, location.pathname]);

  return null;
}
