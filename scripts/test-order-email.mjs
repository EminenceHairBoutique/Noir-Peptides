/*
  scripts/test-order-email.mjs   (opt cycle 5 — scorecards 4.11 / 4.5)
  The order confirmation is the buyer's only receipt and the record a
  chargeback is argued with. Renders the REAL orderConfirmationHtml builder
  (lib/email.js) with both line-item shapes and proves: every line with
  quantity and unit price, the total, the ship-to snapshot, the shipping
  method, the research-use line, escaping of user-supplied text, and honest
  omission when data is absent. Also proves fulfilment passes the data.

  Run: node scripts/test-order-email.mjs   (wired into npm run test:unit)
*/
import { readFileSync } from "node:fs";
process.env.VITE_SUPABASE_URL ||= "https://placeholder.supabase.co";
process.env.VITE_SUPABASE_ANON_KEY ||= "placeholder";
process.env.SUPABASE_SERVICE_ROLE_KEY ||= "placeholder";
const { orderConfirmationHtml } = await import("../lib/email.js");

let failures = 0;
const ok = (cond, msg) => {
  if (cond) console.log(`  ✓ ${msg}`);
  else { failures++; console.error(`  ✗ ${msg}`); }
};
const html = orderConfirmationHtml({
  orderNumber: "NP-2026-0091",
  amount: 12995,
  currency: "usd",
  items: [
    { name: "BPC-157 · 5 mg", sku: "BPC157-5", quantity: 2, unit_dollars: 44 },                    // BTCPay shape
    { description: "TB-500 · 5 mg", quantity: 1, price: { unit_amount: 4195, product: { metadata: { sku: "TB500-5" } } } }, // Stripe shape
  ],
  shippingAddress: { line1: "12 Lab Row", line2: "Suite <b>4</b>", city: "Austin", state: "TX", postal_code: "78701", country: "US" },
  shippingMethod: "expedited",
  customerName: "A. Researcher & Co",
});
console.log("Receipt:");
ok(/NP-2026-0091/.test(html), "order number present");
ok(/BPC-157 · 5 mg/.test(html) && /\(BPC157-5\)/.test(html), "BTCPay-shaped line: name + SKU");
ok(/TB-500 · 5 mg/.test(html) && /\(TB500-5\)/.test(html), "Stripe-shaped line: name + SKU from price metadata");
ok(/>2<\/td>/.test(html) && /\$44\.00/.test(html), "quantity 2 and unit $44.00 for the first line");
ok(/>1<\/td>/.test(html) && /\$41\.95/.test(html), "quantity 1 and unit $41.95 for the second line");
ok(/Total paid:<\/strong> \$129\.95/.test(html), "total paid $129.95");
ok(/Ship to:/.test(html) && /12 Lab Row/.test(html) && /Austin, TX 78701/.test(html) && /<br\/>US/.test(html), "ship-to snapshot rendered");
ok(/Shipping:<\/strong> expedited/.test(html), "shipping method rendered");
ok(/A\. Researcher &amp; Co/.test(html) && /Suite &lt;b&gt;4&lt;\/b&gt;/.test(html), "user-supplied text is escaped");
ok(!/<b>4<\/b>/.test(html), "no raw HTML from the address reaches the email");
ok(/For research use only\. Not for human or veterinary use\./.test(html), "research-use line present");
ok(/2–3 business days/.test(html), "processing window kept");

console.log("\nHonest omission:");
const bare = orderConfirmationHtml({ orderNumber: "NP-1", amount: 500 });
ok(!/<table/.test(bare), "no item table when there are no items");
ok(!/Ship to:/.test(bare) && !/Shipping:/.test(bare), "no ship-to / shipping lines when absent");
ok(/Total paid:<\/strong> \$5\.00/.test(bare), "total still rendered");
const noUnit = orderConfirmationHtml({ orderNumber: "NP-2", amount: 100, items: [{ name: "X", quantity: 1 }] });
ok(/>—<\/td>/.test(noUnit), "unknown unit price renders as a dash, never a fabricated number");
const eur = orderConfirmationHtml({ orderNumber: "NP-3", amount: 1000, currency: "eur" });
ok(/\$10\.00 EUR/.test(eur), "non-USD currency is labelled");

console.log("\nWiring:");
const ful = readFileSync(new URL("../lib/payments/fulfillment.js", import.meta.url), "utf8");
ok(/sendOrderConfirmationEmail\(\{\s*to: email,\s*orderNumber,\s*amount: amountTotalCents,\s*currency,\s*items,\s*shippingAddress,\s*shippingMethod: consent\?\.shipping_method \|\| null,\s*customerName,\s*\}\)/.test(ful), "fulfilment passes items, ship-to, method and name");
const email = readFileSync(new URL("../lib/email.js", import.meta.url), "utf8");
ok(/html: orderConfirmationHtml\(/.test(email), "sendOrderConfirmationEmail renders through the pure builder");

console.log(failures ? `\n${failures} assertion(s) failed` : "\nAll order-email assertions passed");
process.exit(failures ? 1 : 0);
