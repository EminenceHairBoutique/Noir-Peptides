/*
  scripts/test-card-nesting.mjs   (opt cycle 12 — scorecard 4.9 / 4.7)
  The shop card used to be one big <Link> with the certificate chip — another
  <a> — inside it: invalid HTML (an interactive element inside an interactive
  element) that screen readers announced as one concatenated name, on 15
  cards in every build once the certificates were mirrored. Now the card is
  an <article>, the product NAME is the (stretched) link and the chip is a
  sibling control. This gate renders a card with a certificate and asserts:
  no <a> nested in an <a>, exactly two links (name + certificate), the name
  link's text is the product name, and the shop reads ONE certificate map.
  Run: node scripts/test-card-nesting.mjs   (in npm run test:unit)
*/
import { renderToStaticMarkup } from "react-dom/server";
import { createElement } from "react";
import { StaticRouter } from "react-router";
import fs from "node:fs";
import { bundleComponents } from "./_render-jsx.mjs";

let failures = 0;
const ok = (c, m) => { if (c) console.log(`  ✓ ${m}`); else { failures++; console.error(`  ✗ ${m}`); } };

const { ProductCard } = await bundleComponents('export { default as ProductCard } from "../src/components/ProductCard.jsx";\n', "card");
const product = { id: "bpc-157", slug: "bpc-157", name: "BPC-157", price: 44, stock_status: "in_stock", category_slug: "tissue-repair-research" };
const cert = { id: "seed-1", product_id: "bpc-157", lot_number: "JAN-169304", lot: "JAN-169304", purity_percent: 99.68, hplc: "99.680%", ms_confirmed: true, is_published: true, file_url: "/coas/janoshik/bpc-157.jpg", tested_at: "2026-01-20" };
const html = renderToStaticMarkup(createElement(StaticRouter, { location: "/shop" }, createElement(ProductCard, { product, latestCoa: cert })));

console.log("Card markup with a published certificate:");
{
  // Walk the markup: an <a …> opened while another <a> is still open = nesting.
  let depth = 0, nested = false, links = 0;
  for (const m of html.matchAll(/<a\b|<\/a>/g)) {
    if (m[0] === "<a") { links++; if (depth > 0) nested = true; depth++; } else depth--;
  }
  ok(!nested, "no <a> is nested inside another <a>");
  ok(links === 2, `exactly two links: the product name and the certificate (found ${links})`);
  ok(/^<article\b/.test(html), "the card root is an <article>, not a link");
  const nameLink = html.match(/<h3[^>]*>\s*<a [^>]*href="\/products\/bpc-157"[^>]*>([^<]+)<\/a>/);
  ok(Boolean(nameLink) && nameLink[1].trim() === "BPC-157", "the product name is the card link (href /products/bpc-157)");
  ok(/after:absolute after:inset-0/.test(html), "the name link is stretched over the card (pseudo-element)");
  ok(/href="\/coas\/janoshik\/bpc-157\.jpg"[^>]*class="[^"]*relative z-10/.test(html) || /class="[^"]*relative z-10[^"]*"[^>]*href="\/coas\/janoshik\/bpc-157\.jpg"/.test(html), "the certificate link sits above the stretched link (relative z-10)");
  ok(!/stopPropagation/.test(fs.readFileSync("src/components/ProductCard.jsx", "utf8")), "no click-propagation hack remains");
}

console.log("\nShop reads one certificate source:");
{
  const shop = fs.readFileSync("src/pages/Shop.jsx", "utf8");
  ok(!/getAllCoas/.test(shop), "Shop.jsx no longer issues a second coas query");
  ok(/const coaProductIds = useMemo\(\(\) => new Set\(Object\.keys\(latestCoaMap/.test(shop), "the COA facet / compare column derive from latestCoaMap");
}

if (failures) { console.error(`\n${failures} card-nesting check(s) FAILED`); process.exit(1); }
console.log("\nAll card-nesting checks passed.");
