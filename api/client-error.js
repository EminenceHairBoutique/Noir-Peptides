// api/client-error.js
// First-party client error telemetry sink. The browser reporter
// (src/lib/errorReporter.js) POSTs sanitized error events here; we write them
// to client_errors with the service role (the table has no public RLS
// policies, so this endpoint is the only writer).
//
// Abuse posture: rate-limited per IP, every field length-capped server-side,
// and events with the same fingerprint within 24h collapse into one row
// (hits++) so a hot bug — or a hostile client — can't flood the table.
// The fingerprint is computed HERE from the sanitized fields; client-supplied
// fingerprints are ignored.

import crypto from "node:crypto";
import { supabaseServer } from "../lib/supabaseServer.js";
import { getUserFromReq } from "./_utils/auth.js";
import { checkRateLimit } from "./_utils/rateLimit.js";
import { validateBody } from "./_utils/validate.js";
import { readJsonBody, jsonResponse as json } from "./_utils/body.js";

const SOURCES = ["window", "promise", "boundary"];
const DEDUPE_WINDOW_MS = 24 * 60 * 60 * 1000;

export default async function handler(req, res) {
  if (req.method !== "POST") return json(res, 405, { error: "Method not allowed" });

  const allowed = await checkRateLimit(req, res, {
    endpoint: "client-error",
    max: 10,
    windowMs: 60_000,
  });
  if (!allowed) return;

  const body = await readJsonBody(req);
  const { ok, errors, value } = validateBody(body, {
    message: { type: "string", required: true, max: 500 },
    stack: { type: "string", max: 4000 },
    source: { type: "string", enum: SOURCES },
    path: { type: "string", max: 512 },
  });
  if (!ok) return json(res, 400, { error: "Invalid request", details: errors });

  const message = value.message.trim().slice(0, 500);
  const stack = value.stack ? String(value.stack).slice(0, 4000) : null;
  const source = value.source || "window";
  const path = value.path ? String(value.path).slice(0, 512) : null;
  const userAgent = req.headers["user-agent"]
    ? String(req.headers["user-agent"]).slice(0, 500)
    : null;

  // Optional identity: if the reporter sent a bearer token, attribute the
  // event; anonymous events are fully accepted (errors happen pre-login too).
  const user = await getUserFromReq(req);

  // Group by what identifies the bug (message + top stack frame + source),
  // not by who hit it or where.
  const fingerprint = crypto
    .createHash("sha256")
    .update(`${message}\n${(stack || "").split("\n").slice(0, 2).join("\n")}\n${source}`)
    .digest("hex")
    .slice(0, 32);

  try {
    const since = new Date(Date.now() - DEDUPE_WINDOW_MS).toISOString();
    const { data: existing } = await supabaseServer
      .from("client_errors")
      .select("id, hits")
      .eq("fingerprint", fingerprint)
      .eq("resolved", false)
      .gte("last_seen_at", since)
      .order("last_seen_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (existing) {
      await supabaseServer
        .from("client_errors")
        .update({
          hits: Number(existing.hits || 1) + 1,
          last_seen_at: new Date().toISOString(),
          // Keep the freshest context for the recurring bug.
          path,
          user_id: user?.id || undefined,
        })
        .eq("id", existing.id);
    } else {
      const { error } = await supabaseServer.from("client_errors").insert({
        fingerprint,
        message,
        stack,
        source,
        path,
        user_agent: userAgent,
        user_id: user?.id || null,
      });
      if (error) throw error;
    }

    // 204: the reporter is fire-and-forget; nothing to parse.
    res.statusCode = 204;
    return res.end();
  } catch (err) {
    // Telemetry must never look like an outage to the client.
    console.error("client-error sink failed:", err?.message || err);
    res.statusCode = 204;
    return res.end();
  }
}
