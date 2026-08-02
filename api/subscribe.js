
import { supabaseServer } from "../lib/supabaseServer.js";
import { sendConciergeRequestEmail } from "../lib/email.js";
import { checkRateLimit } from "./_utils/rateLimit.js";
import { validateBody } from "./_utils/validate.js";

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

function isValidEmail(email) {
  const emailAddress = String(email || "").trim();
  // Simple, robust-enough validation
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(emailAddress);
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

  // Rate limit: 5 subscribe attempts per IP per minute.
  const allowed = await checkRateLimit(req, res, {
    endpoint: "subscribe",
    max: 5,
    windowMs: 60_000,
  });
  if (!allowed) return;

  const data = await readJson(req);
  if (!data) {
    res.status(400).send("Invalid JSON payload");
    return;
  }

  // Optional honeypot field (spam bots)
  if (data.website) {
    res.status(200).json({ ok: true });
    return;
  }

  // Bound every field server-side — an unauthenticated endpoint must never
  // write unbounded client strings/objects into the database.
  const { ok, value } = validateBody(data, {
    email: { type: "string", required: true, email: true, max: 320 },
    firstName: { type: "string", max: 120 },
    source: { type: "string", max: 64 },
    path: { type: "string", max: 512 },
  });
  const email = String(value.email || "").trim();
  if (!ok || !email || !isValidEmail(email)) {
    res.status(400).send("Please enter a valid email address.");
    return;
  }
  const firstName = String(value.firstName || "").trim();
  const source = String(value.source || "newsletter").trim() || "newsletter";
  const path = String(value.path || "").trim();
  // utm/consent are free-form jsonb: accept plain objects only, size-capped.
  const boundedJson = (v, maxBytes = 2000) => {
    if (!v || typeof v !== "object" || Array.isArray(v)) return null;
    try {
      const json = JSON.stringify(v);
      return json.length > maxBytes ? null : JSON.parse(json);
    } catch {
      return null;
    }
  };
  const utm = boundedJson(data.utm);
  const consent = boundedJson(data.consent);

  let stored = false;
  let warned = null;

  // 1) Try to store in Supabase (recommended)
  try {
    const { error } = await supabaseServer.from("email_subscribers").insert([
      {
        email,
        first_name: firstName || null,
        source,
        path,
        utm,
        consent,
      },
    ]);

    if (!error) {
      stored = true;
    } else if (String(error.code) === "23505") {
      // Unique violation (email already exists) — treat as ok
      stored = true;
    } else {
      warned = error.message || "Supabase insert failed";
    }
  } catch (e) {
    warned = e?.message || "Supabase unavailable";
  }

  // 2) Optional fallback: email your team (if Resend is configured)
  // Keeps signups from being "lost" if DB isn't ready yet.
  try {
    await sendConciergeRequestEmail({
      type: "newsletter",
      payload: {
        email,
        firstName,
        source,
        path,
        ...(utm ? { utm: JSON.stringify(utm) } : {}),
      },
    });
  } catch {
    // ignore — only works if RESEND_API_KEY is set
  }

  res.status(200).json({ ok: true, stored, ...(warned ? { warned } : {}) });
}
