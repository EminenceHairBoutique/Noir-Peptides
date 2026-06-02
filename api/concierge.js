/* eslint-env node */

import { sendConciergeRequestEmail } from "../lib/email.js";
import { checkRateLimit } from "./_utils/rateLimit.js";

async function readJson(req) {
  // Vercel may provide req.body already parsed
  if (req.body && typeof req.body === "object") return req.body;

  // Node stream fallback
  const chunks = [];
  for await (const chunk of req) chunks.push(chunk);
  const raw = Buffer.concat(chunks).toString("utf8") || "{}";
  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

export default async function handler(req, res) {
  if (req.method === "OPTIONS") {
    res.status(200).end();
    return;
  }

  if (req.method !== "POST") {
    res.status(405).send("Method not allowed");
    return;
  }

  // Rate limit: 3 concierge requests per IP per minute.
  const allowed = await checkRateLimit(req, res, {
    endpoint: "concierge",
    max: 3,
    windowMs: 60_000,
  });
  if (!allowed) return;

  const data = await readJson(req);
  if (!data) {
    res.status(400).send("Invalid JSON payload");
    return;
  }

  const type = String(data.type || "");
  const payload = data.payload || {};

  // Basic honeypot spam protection
  if (payload.website) {
    res.status(200).json({ ok: true });
    return;
  }

  // Minimal required fields
  const email = String(payload.email || "").trim();
  const fullName = String(payload.fullName || payload.name || "").trim();
  if (!email || !fullName) {
    res.status(400).send("Missing required fields: fullName and email");
    return;
  }

  try {
    await sendConciergeRequestEmail({ type, payload });
    res.status(200).json({ ok: true });
  } catch (err) {
    console.error("concierge error", err);
    res.status(500).send(err?.message || "Failed to send concierge request");
  }
}
