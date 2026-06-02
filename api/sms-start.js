/* eslint-env node */

// Twilio Verify: start SMS verification
// Required env vars:
// - TWILIO_ACCOUNT_SID
// - TWILIO_AUTH_TOKEN
// - TWILIO_VERIFY_SERVICE_SID

import { checkRateLimit } from "./_utils/rateLimit.js";

async function readJson(req) {
  // Vercel may provide req.body already parsed
  if (req.body && typeof req.body === "object") return req.body;

  const chunks = [];
  for await (const chunk of req) chunks.push(chunk);
  const raw = Buffer.concat(chunks).toString("utf8") || "{}";

  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

function normalizePhone(input) {
  const raw = String(input || "").trim();
  if (!raw) return null;

  let s = raw.replace(/[^\d+]/g, "");
  if (s.startsWith("00")) s = "+" + s.slice(2);

  if (s.startsWith("+")) {
    const digits = s.slice(1).replace(/\D/g, "");
    if (digits.length < 6 || digits.length > 15) return null;
    return "+" + digits;
  }

  const digits = s.replace(/\D/g, "");
  // Convenience for US numbers
  if (digits.length === 10) return "+1" + digits;
  if (digits.length === 11 && digits.startsWith("1")) return "+" + digits;

  return null;
}

async function twilioVerifyStart({ to }) {
  const accountSid = process.env.TWILIO_ACCOUNT_SID;
  const authToken = process.env.TWILIO_AUTH_TOKEN;
  const serviceSid = process.env.TWILIO_VERIFY_SERVICE_SID;

  if (!accountSid || !authToken || !serviceSid) {
    throw new Error("Twilio Verify is not configured");
  }

  const auth = Buffer.from(`${accountSid}:${authToken}`).toString("base64");
  const url = `https://verify.twilio.com/v2/Services/${serviceSid}/Verifications`;

  const body = new URLSearchParams({ To: to, Channel: "sms" });

  const resp = await fetch(url, {
    method: "POST",
    headers: {
      Authorization: `Basic ${auth}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body,
  });

  const data = await resp.json().catch(() => ({}));
  if (!resp.ok) {
    const msg = data?.message || data?.detail || "Failed to send code";
    throw new Error(msg);
  }

  return data;
}

export default async function handler(req, res) {
  if (req.method === "OPTIONS") {
    res.status(200).end();
    return;
  }

  if (req.method !== "POST") {
    res.status(405).json({ error: "Method not allowed" });
    return;
  }

  // Rate limit: 3 SMS verification starts per IP per minute.
  // This prevents SMS bombing / abuse of the Twilio account.
  const allowed = await checkRateLimit(req, res, {
    endpoint: "sms-start",
    max: 3,
    windowMs: 60_000,
  });
  if (!allowed) return;

  const payload = await readJson(req);
  if (!payload) {
    res.status(400).json({ error: "Invalid JSON payload" });
    return;
  }

  // Optional honeypot (spam bots)
  if (payload.website) {
    res.status(200).json({ ok: true });
    return;
  }

  const phone = normalizePhone(payload.phone);
  const consent = Boolean(payload.consent);

  if (!phone) {
    res.status(400).json({ error: "Please enter a valid phone number." });
    return;
  }

  if (!consent) {
    res
      .status(400)
      .json({ error: "Please confirm you consent to receive SMS messages." });
    return;
  }

  try {
    const tw = await twilioVerifyStart({ to: phone });

    res.status(200).json({
      ok: true,
      status: tw.status || "pending",
      to: phone,
    });
  } catch (err) {
    console.error("Twilio start error:", err?.message || err);
    res.status(500).json({ error: err?.message || "Failed to send code" });
  }
}
