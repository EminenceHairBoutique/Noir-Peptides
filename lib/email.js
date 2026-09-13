import { Resend } from "resend";
import { supabaseServer } from "./supabaseServer.js";
import { lineName, lineQty, lineUnitCents, lineSku } from "./orderLines.js";

const resend = process.env.RESEND_API_KEY
  ? new Resend(process.env.RESEND_API_KEY)
  : null;

function requireResend() {
  if (!resend) {
    throw new Error(
      "Missing RESEND_API_KEY. Set it in your environment variables to send emails."
    );
  }
  return resend;
}

const esc = (v) => String(v ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
const money = (cents, currency = "usd") => `$${(Number(cents || 0) / 100).toFixed(2)}${currency && currency.toLowerCase() !== "usd" ? ` ${currency.toUpperCase()}` : ""}`;

/**
 * Opt c5 (4.11 / 4.5): the buyer's only receipt — and the record a
 * chargeback is argued with. Pure: renders what it is given, never queries.
 * Line items + quantities + unit prices, total, ship-to snapshot, shipping
 * method, and the research-use line. Everything user-supplied is escaped.
 */
export function orderConfirmationHtml({ orderNumber, amount, currency = "usd", items = [], shippingAddress = null, shippingMethod = null, customerName = "" }) {
  const rows = (Array.isArray(items) ? items : []).map((it) => {
    const unit = lineUnitCents(it);
    return `<tr>
          <td style="padding:6px 4px;border-bottom:1px solid #eee;">${esc(lineName(it))}${lineSku(it) ? ` <span style="color:#888;font-size:11px;">(${esc(lineSku(it))})</span>` : ""}</td>
          <td style="padding:6px 4px;border-bottom:1px solid #eee;text-align:right;">${lineQty(it)}</td>
          <td style="padding:6px 4px;border-bottom:1px solid #eee;text-align:right;">${unit == null ? "—" : esc(money(unit, currency))}</td>
        </tr>`;
  }).join("");
  const a = shippingAddress || {};
  const shipTo = [customerName, a.line1, a.line2, [a.city, a.state].filter(Boolean).join(", ") + (a.postal_code ? ` ${a.postal_code}` : ""), a.country]
    .map((x) => String(x || "").trim()).filter(Boolean).map(esc).join("<br/>");
  return `
      <div style="font-family: Arial, sans-serif; max-width: 600px;">
        <h2>Thank you for your order</h2>

        <p>Your order <strong>${esc(orderNumber)}</strong> has been confirmed.</p>

        ${rows ? `<table style="width:100%;border-collapse:collapse;font-size:13px;">
          <thead><tr>
            <th style="text-align:left;padding:6px 4px;border-bottom:1px solid #ddd;">Item</th>
            <th style="text-align:right;padding:6px 4px;border-bottom:1px solid #ddd;">Qty</th>
            <th style="text-align:right;padding:6px 4px;border-bottom:1px solid #ddd;">Unit</th>
          </tr></thead>
          <tbody>${rows}</tbody>
        </table>` : ""}

        <p><strong>Total paid:</strong> ${esc(money(amount, currency))}</p>
        ${shipTo ? `<p><strong>Ship to:</strong><br/>${shipTo}</p>` : ""}
        ${shippingMethod ? `<p><strong>Shipping:</strong> ${esc(shippingMethod)}</p>` : ""}

        <p>
          Your order is now being processed and will ship within
          <strong>2–3 business days</strong>. You will receive another email
          once your order ships.
        </p>

        <hr />

        <p style="font-size: 12px; color: #666;">
          Noir Peptides · Lyophilized research reference materials · Batch traceable
        </p>
        <p style="font-size: 12px; color: #888;">
          For research use only. Not for human or veterinary use. Not intended
          to diagnose, treat, cure, or prevent any disease.
        </p>
      </div>
    `;
}

export async function sendOrderConfirmationEmail({ to, orderNumber, amount, currency, items, shippingAddress, shippingMethod, customerName }) {
  return requireResend().emails.send({
    from: "Noir Peptides <orders@noirpeptides.com>",
    to,
    reply_to: "support@noirpeptides.com",
    subject: `Order ${orderNumber} confirmed — Noir Peptides`,
    html: orderConfirmationHtml({ orderNumber, amount, currency, items, shippingAddress, shippingMethod, customerName }),
  });
}

const STATUS_PHRASE = {
  processing: "is now being processed",
  shipped: "has shipped",
  delivered: "was delivered",
  canceled: "was canceled",
  refunded: "was refunded",
};

/** Pure renderer for the status ("shipped") email — tested in scripts/test-order-email.mjs (opt c10). */
export function orderStatusHtml({ orderNumber, status, trackingUrl }) {
  const phrase = STATUS_PHRASE[status] || `was updated to ${esc(status)}`;
  // Only an https tracking link is ever rendered (the admin route enforces
  // https:// too; this is the second lock).
  const track = typeof trackingUrl === "string" && /^https:\/\//i.test(trackingUrl) ? esc(trackingUrl) : null;
  return `
      <div style="font-family: Arial, sans-serif; max-width: 600px;">
        <h2>Order update</h2>
        <p>Your order <strong>${esc(orderNumber)}</strong> ${phrase}.</p>
        ${track ? `<p><a href="${track}" target="_blank" rel="noopener noreferrer">Track your shipment</a></p>` : ""}
        <hr />
        <p style="font-size: 12px; color: #888;">
          For research use only. Not for human or veterinary use.
        </p>
      </div>
    `;
}

export async function sendOrderStatusEmail({ to, orderNumber, status, trackingUrl }) {
  if (!resend || !to) return null;
  return resend.emails.send({
    from: "Noir Peptides <orders@noirpeptides.com>",
    to,
    reply_to: "support@noirpeptides.com",
    subject: `Order ${orderNumber} update — Noir Peptides`,
    html: orderStatusHtml({ orderNumber, status, trackingUrl }),
  });
}

/**
 * Attestation receipt (opt c10, C8/4.11): the researcher's record of
 * what they certified, when, and under which version — no product names, no
 * marketing, nothing beyond the record itself. Pure renderer, tested.
 */
export function attestationReceiptHtml({ version, recordedAt, legalName, statements }) {
  const when = recordedAt ? new Date(recordedAt) : null;
  const stamp = when && !Number.isNaN(when.getTime()) ? when.toISOString().slice(0, 19).replace("T", " ") + " UTC" : "";
  const list = Array.isArray(statements) && statements.length
    ? `<ol style="padding-left: 18px;">${statements.map((t) => `<li>${esc(String(t))}</li>`).join("")}</ol>`
    : "";
  return `
      <div style="font-family: Arial, sans-serif; max-width: 600px;">
        <h2>Research-use attestation on record</h2>
        <p>${legalName ? `${esc(legalName)}, your` : "Your"} research-use attestation${version ? ` (version <strong>${esc(version)}</strong>)` : ""} was recorded${stamp ? ` on ${stamp}` : ""}.</p>
        ${list}
        <p>Keep this message: it is your copy of the record. If you did not make this attestation, reply to this email.</p>
        <hr />
        <p style="font-size: 12px; color: #888;">
          For research use only. Not for human or veterinary use.
        </p>
      </div>
    `;
}

// Opt c11 (4.14d): saved-cart reminder — DRAFT TEMPLATE ONLY. Nothing
// sends it: there is no sender function and no scheduler in this repo (the
// only cron is the read-only live probe). Logistics copy: item count and a
// link back to the cart; no product names, no offer, no urgency.
export function cartReminderHtml({ itemCount, cartUrl }) {
  const n = Math.max(0, Math.floor(Number(itemCount) || 0));
  const safeUrl = typeof cartUrl === "string" && /^https:\/\//.test(cartUrl) ? cartUrl : "";
  const what = n === 1 ? "1 item is" : `${n} items are`;
  return `
      <div style="font-family: Arial, sans-serif; max-width: 600px;">
        <h2>Your cart is saved</h2>
        <p>${esc(what)} waiting in your cart at Noir Peptides. Return whenever you are ready; prices and availability are confirmed at checkout.</p>
        ${safeUrl ? `<p><a href="${esc(safeUrl)}">Return to your cart</a></p>` : ""}
        <p>If you did not start this cart, you can ignore this message.</p>
        <hr />
        <p style="font-size: 12px; color: #888;">
          For research use only. Not for human or veterinary use.
        </p>
      </div>
    `;
}

export async function sendAttestationReceiptEmail({ to, version, recordedAt, legalName, statements }) {
  if (!resend || !to) return null;
  return resend.emails.send({
    from: "Noir Peptides <orders@noirpeptides.com>",
    to,
    reply_to: "support@noirpeptides.com",
    subject: `Your research-use attestation is on record — Noir Peptides`,
    html: attestationReceiptHtml({ version, recordedAt, legalName, statements }),
  });
}

export async function sendBackInStockEmail({ to, productName, sizeLabel, productSlug }) {
  if (!resend || !to) return null;
  const site = (process.env.SITE_URL || process.env.VITE_SITE_URL || "https://www.noirpeptides.com").replace(/\/+$/, "");
  const url = productSlug ? `${site}/product/${productSlug}` : `${site}/shop`;
  const what = sizeLabel ? `${productName} (${sizeLabel})` : productName;
  return resend.emails.send({
    from: "Noir Peptides <orders@noirpeptides.com>",
    to,
    reply_to: "support@noirpeptides.com",
    subject: `Back in stock: ${what} — Noir Peptides`,
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px;">
        <h2>Back in stock</h2>
        <p><strong>${what}</strong> is available again.</p>
        <p>You asked us to let you know — quantities are batch-limited, so this
        is a one-time notice.</p>
        <p><a href="${url}" target="_blank" rel="noopener noreferrer">View the material</a></p>
        <hr />
        <p style="font-size: 12px; color: #888;">
          For research use only. Not for human or veterinary use. You received
          this because you requested a restock notice on our site; you won't be
          emailed about this item again.
        </p>
      </div>
    `,
  });
}

export async function sendConciergeRequestEmail({
  type,
  payload,
  to = "support@noirpeptides.com",
}) {
  const safeType = String(type || "request").replace(/[^a-z0-9_-]/gi, "");

  const rawUploads = Array.isArray(payload?.referenceUploads)
    ? payload.referenceUploads
    : [];

  const safeFilename = (name = "reference.jpg") => {
    const cleaned = String(name || "reference.jpg")
      .replace(/\s+/g, "-")
      .replace(/[^a-z0-9._-]+/gi, "")
      .replace(/-+/g, "-")
      .slice(0, 80);
    return cleaned && cleaned.includes(".")
      ? cleaned
      : `${cleaned || "reference"}.jpg`;
  };

  const normalizeBase64 = (content = "") => {
    const contentString = String(content || "").trim();
    if (!contentString) return "";
    const idx = contentString.indexOf("base64,");
    return idx >= 0
      ? contentString.slice(idx + "base64,".length)
      : contentString;
  };

  const escapeHtml = (htmlString = "") =>
    String(htmlString || "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#039;");

  const slugLabel = (labelString = "") =>
    String(labelString || "")
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/-+/g, "-")
      .replace(/^-|-$/g, "")
      .slice(0, 24);

  const attachments = [];
  const includedUploads = [];
  const includedLinks = [];
  let totalApproxBytes = 0;

  const SIGNED_LINK_TTL_SECONDS = 60 * 60 * 24 * 7; // 7 days
  const DEFAULT_UPLOAD_BUCKET =
    process.env.SUPABASE_RESEARCH_UPLOAD_BUCKET || "research-uploads";

  for (const u of rawUploads.slice(0, 6)) {
    const labelRaw = String(u?.label || "").trim();
    const prefix = labelRaw ? slugLabel(labelRaw) : "";
    const baseName = u?.filename || `reference-${attachments.length + 1}.jpg`;
    const filename = safeFilename(prefix ? `${prefix}-${baseName}` : baseName);
    const content = normalizeBase64(u?.content);

    if (content) {
      const approxBytes = Math.floor((content.length * 3) / 4);
      if (approxBytes > 6 * 1024 * 1024) continue;
      if (totalApproxBytes + approxBytes > 12 * 1024 * 1024) break;

      totalApproxBytes += approxBytes;
      attachments.push({
        filename,
        content,
        contentType: u?.contentType || "image/jpeg",
      });
      includedUploads.push({ label: labelRaw, filename });
      continue;
    }

    const path = String(u?.path || "").trim();
    if (!path) continue;

    const bucket =
      String(u?.bucket || DEFAULT_UPLOAD_BUCKET).trim() || DEFAULT_UPLOAD_BUCKET;
    try {
      const { data, error } = await supabaseServer.storage
        .from(bucket)
        .createSignedUrl(path, SIGNED_LINK_TTL_SECONDS);
      if (error || !data?.signedUrl) {
        includedLinks.push({ label: labelRaw, filename, url: null, path, bucket });
      } else {
        includedLinks.push({
          label: labelRaw,
          filename,
          url: data.signedUrl,
          path,
          bucket,
        });
      }
    } catch {
      includedLinks.push({ label: labelRaw, filename, url: null, path, bucket });
    }
  }

  const entries = Object.entries(payload || {})
    .filter(
      ([k, v]) =>
        k !== "website" &&
        k !== "referenceUploads" &&
        v != null &&
        String(v).trim() !== ""
    )
    .map(([k, v]) => [k, String(v)])
    .slice(0, 80);

  const rows = entries
    .map(
      ([k, v]) => `
        <tr>
          <td style="padding: 8px 10px; border: 1px solid #1e2d40; font-weight: 600; background: #0d1420; color:#e8edf5;">${k}</td>
          <td style="padding: 8px 10px; border: 1px solid #1e2d40; color:#e8edf5;">${v
            .replace(/</g, "&lt;")
            .replace(/>/g, "&gt;")}</td>
        </tr>
      `
    )
    .join("");

  const subjectMap = {
    contact: "New Contact Message",
    order: "Order Question",
    coa: "COA / Batch Documentation Request",
    bulk: "Bulk / Research-Supply Inquiry",
    transit: "Damaged or Incorrect Order",
    newsletter: "New Catalog Updates Signup",
    partner_application: "Wholesale / Institutional Supply Application",
  };

  const subject = subjectMap[safeType] || "New Research Inquiry";

  const uploadsHtml = (() => {
    const parts = [];

    if (includedUploads.length) {
      parts.push(`
        <div style="margin: 14px 0 0; color: #8a9ab3;">
          <strong>Reference files attached:</strong>
          <ul style="margin: 8px 0 0; padding-left: 18px;">
            ${includedUploads
              .map(
                (i) =>
                  `<li>${i.label ? `<strong>${escapeHtml(i.label)}:</strong> ` : ""}${escapeHtml(i.filename)}</li>`
              )
              .join("")}
          </ul>
        </div>
      `);
    }

    if (includedLinks.length) {
      parts.push(`
        <div style="margin: 14px 0 0; color: #8a9ab3;">
          <strong>Reference files (secure links):</strong>
          <ul style="margin: 8px 0 0; padding-left: 18px;">
            ${includedLinks
              .map((i) => {
                const label = i.label
                  ? `<strong>${escapeHtml(i.label)}:</strong> `
                  : "";
                const text = `${label}${escapeHtml(i.filename)}`;
                if (i.url) {
                  return `<li><a href="${i.url}" target="_blank" rel="noopener noreferrer">${text}</a></li>`;
                }
                return `<li>${text} <span style="color:#999;">(unable to generate signed link; bucket=${escapeHtml(i.bucket)} path=${escapeHtml(i.path)})</span></li>`;
              })
              .join("")}
          </ul>
          <p style="margin: 8px 0 0; font-size: 12px; color: #777;">
            Links expire in ${Math.round(SIGNED_LINK_TTL_SECONDS / 86400)} days.
          </p>
        </div>
      `);
    }

    if (!parts.length) {
      return `<p style="margin: 14px 0 0; color: #8a9ab3;"><strong>Reference files:</strong> none</p>`;
    }

    return parts.join("\n");
  })();

  return requireResend().emails.send({
    from: "Noir Peptides <support@noirpeptides.com>",
    to,
    reply_to: payload?.email || "support@noirpeptides.com",
    subject,
    ...(attachments.length ? { attachments } : {}),
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 720px; line-height: 1.45;">
        <p style="font-size: 12px; letter-spacing: 0.18em; text-transform: uppercase; color: #8a9ab3;">
          Noir Peptides • ${safeType}
        </p>

        <h2 style="margin: 10px 0 6px; font-weight: 500;">${subject}</h2>
        <p style="color: #8a9ab3; margin: 0 0 18px;">Submitted from the website form.</p>

        <table style="width: 100%; border-collapse: collapse; font-size: 14px;">
          ${rows || ""}
        </table>

        ${uploadsHtml}

        <p style="margin-top: 18px; font-size: 12px; color: #8a9ab3;">
          Reply to the researcher using the email above. If this looks like
          spam, check the hidden honeypot field.
        </p>
        <p style="font-size: 11px; color: #999;">
          For research use only. Not for human or veterinary use.
        </p>
      </div>
    `,
  });
}
