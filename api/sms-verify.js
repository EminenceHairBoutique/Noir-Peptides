/* eslint-env node */

// Twilio Verify: check SMS verification code
// Required env vars:
// - TWILIO_ACCOUNT_SID
// - TWILIO_AUTH_TOKEN
// - TWILIO_VERIFY_SERVICE_SID

import { supabaseServer } from "../lib/supabaseServer.js";
import { checkRateLimit } from "./_utils/rateLimit.js";

async function readJson(req) {
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
  if (digits.length === 10) return "+1" + digits;
  if (digits.length === 11 && digits.startsWith("1")) return "+" + digits;

  return null;
}

async function twilioVerifyCheck({ to, code }) {
  const accountSid = process.env.TWILIO_ACCOUNT_SID;
  const authToken = process.env.TWILIO_AUTH_TOKEN;
  const serviceSid = process.env.TWILIO_VERIFY_SERVICE_SID;

  if (!accountSid || !authToken || !serviceSid) {
    throw new Error("Twilio Verify is not configured");
  }

  const auth = Buffer.from(`${accountSid}:${authToken}`).toString("base64");
  const url = `https://verify.twilio.com/v2/Services/${serviceSid}/VerificationCheck`;

  const body = new URLSearchParams({ To: to, Code: code });

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
    const msg = data?.message || data?.detail || "Verification failed";
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

  // Rate limit: 5 SMS verify attempts per IP per minute.
  const allowed = await checkRateLimit(req, res, {
    endpoint: "sms-verify",
    max: 5,
    windowMs: 60_000,
  });
  if (!allowed) return;

  const payload = await readJson(req);
  if (!payload) {
    res.status(400).json({ error: "Invalid JSON payload" });
    return;
  }

  // Optional honeypot
  if (payload.website) {
    res.status(200).json({ ok: true });
    return;
  }

  const phone = normalizePhone(payload.phone);
  const code = String(payload.code || "").trim();
  const consent = payload.consent ?? null;
  const source = String(payload.source || "sms_discount_modal").trim();
  const path = String(payload.path || "").trim();
  const utm = payload.utm || null;

  if (!phone) {
    res.status(400).json({ error: "Please enter a valid phone number." });
    return;
  }

  if (!code || code.length < 4) {
    res.status(400).json({ error: "Please enter the verification code." });
    return;
  }

  try {
    const tw = await twilioVerifyCheck({ to: phone, code });
    const approved = String(tw?.status || "").toLowerCase() === "approved";

    if (!approved) {
      res.status(400).json({ ok: false, verified: false, error: "Incorrect code. Please try again." });
      return;
    }

    // Store verified SMS subscriber (optional)
    try {
      await supabaseServer.from("sms_signups").insert([
        {
          phone,
          source,
          path: path || null,
          utm,
          consent,
          verified_at: new Date().toISOString(),
        },
      ]);
    } catch (e) {
      // If the table doesn't exist yet or RLS blocks it, don't fail verification
      console.warn("sms_signups insert skipped:", e?.message || e);
    }

    res.status(200).json({
      ok: true,
      verified: true,
      discountCode: "WELCOME10",
    });
  } catch (err) {
    console.error("Twilio verify error:", err?.message || err);
    res.status(500).json({ error: err?.message || "Verification failed" });
  }
}
