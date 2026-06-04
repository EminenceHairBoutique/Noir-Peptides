// api/contact.js
// Contact / inbound-message endpoint. Emails the team (Resend) and records the
// message in contact_requests. This endpoint has NO model call — it was renamed
// from the old "concierge" name to reflect that it is a contact form handler.
// The AI concierge lives at api/ai/concierge.js.

import { sendConciergeRequestEmail } from "../lib/email.js";
import { supabaseServer } from "../lib/supabaseServer.js";
import { checkRateLimit } from "./_utils/rateLimit.js";
import { readJsonBody } from "./_utils/body.js";
import { validateBody } from "./_utils/validate.js";

export default async function handler(req, res) {
  if (req.method === "OPTIONS") {
    res.status(200).end();
    return;
  }

  if (req.method !== "POST") {
    res.status(405).send("Method not allowed");
    return;
  }

  // Rate limit: 3 contact requests per IP per minute.
  const allowed = await checkRateLimit(req, res, {
    endpoint: "contact",
    max: 3,
    windowMs: 60_000,
  });
  if (!allowed) return;

  const data = await readJsonBody(req);
  if (!data) {
    res.status(400).send("Invalid JSON payload");
    return;
  }

  const type = String(data.type || "contact");
  // Accept both the wrapped { type, payload } shape and a flat body.
  const payload = data.payload || data;

  // Basic honeypot spam protection.
  if (payload.website) {
    res.status(200).json({ ok: true });
    return;
  }

  const email = String(payload.email || "").trim();
  const fullName = String(payload.fullName || payload.name || "").trim();
  const { ok, errors } = validateBody(
    { email, fullName },
    {
      email: { type: "string", required: true, email: true, max: 320 },
      fullName: { type: "string", required: true, min: 2, max: 200 },
    }
  );
  if (!ok) {
    res.status(400).json({ error: "Invalid request", details: errors });
    return;
  }

  // Record the message (best-effort — never blocks the email send).
  try {
    await supabaseServer.from("contact_requests").insert({
      type,
      email,
      full_name: fullName,
      message: String(payload.message || "").slice(0, 5000) || null,
      payload,
    });
  } catch {
    /* ignore */
  }

  try {
    await sendConciergeRequestEmail({ type, payload });
    res.status(200).json({ ok: true });
  } catch (err) {
    console.error("contact error", err);
    res.status(500).send(err?.message || "Failed to send contact request");
  }
}
