// api/attestation.js
// Records a research-use attestation with a server-derived audit trail
// (IP + user-agent come from request headers, not the client, so the consent
// record is defensible). Writes both the profile snapshot and an append-only
// row in attestation_audit. Requires a valid Supabase bearer token.
//
// Enforcement (server-trusted):
//   - `version` MUST equal the current ATTESTATION_VERSION.
//   - EVERY required statement ID must be present and explicitly affirmed.
//   - The stored statement TEXT is the server's canonical text — client-
//     supplied text is ignored entirely.
// Privacy note: we deliberately record only IP + user-agent + timestamp.
// No browser fingerprinting (it would create GDPR/CCPA exposure that works
// against the compliance goal).

import { supabaseServer } from "../lib/supabaseServer.js";
import { requireUser } from "./_utils/auth.js";
import { checkRateLimit } from "./_utils/rateLimit.js";
import {
  ATTESTATION_VERSION,
  REQUIRED_STATEMENT_IDS,
  STATEMENT_TEXT_BY_ID,
} from "../lib/attestationStatements.js";

function clientIp(req) {
  const xff = req.headers["x-forwarded-for"];
  if (xff) return String(xff).split(",")[0].trim();
  return req.headers["x-real-ip"] || req.socket?.remoteAddress || null;
}

// Normalize the client's affirmations into a Set of affirmed statement IDs.
// Accepts either the array shape [{ id, agreed|value|checked: true }, ...] or
// a plain object map { id: true, ... }. Only explicit boolean `true` counts.
function affirmedIdSet(statements) {
  const affirmed = new Set();
  if (Array.isArray(statements)) {
    for (const s of statements) {
      if (!s || typeof s !== "object") continue;
      const agreed = s.agreed === true || s.value === true || s.checked === true;
      if (agreed && typeof s.id === "string") affirmed.add(s.id);
    }
  } else if (statements && typeof statements === "object") {
    for (const [id, val] of Object.entries(statements)) {
      if (val === true) affirmed.add(id);
    }
  }
  return affirmed;
}

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  // Rate limit: a small number of attestation writes per IP per minute.
  const allowed = await checkRateLimit(req, res, {
    endpoint: "attestation",
    max: 10,
    windowMs: 60_000,
  });
  if (!allowed) return;

  const user = await requireUser(req, res);
  if (!user) return; // 401 already sent

  try {
    const { version, statements, legalName } = req.body || {};

    if (!legalName || String(legalName).trim().length < 2) {
      return res.status(400).json({ error: "A full legal name is required." });
    }

    // 1) Version must match the current canonical version exactly.
    if (String(version || "") !== ATTESTATION_VERSION) {
      return res.status(400).json({
        error: `Stale or invalid attestation version. Expected ${ATTESTATION_VERSION}.`,
      });
    }

    // 2) Every required statement must be explicitly affirmed.
    const affirmed = affirmedIdSet(statements);
    const missing = REQUIRED_STATEMENT_IDS.filter((id) => !affirmed.has(id));
    if (missing.length > 0) {
      return res.status(400).json({
        error: "All research-use statements must be affirmed.",
        missing,
      });
    }

    // 3) Build the canonical record from SERVER text (ignore client text).
    const canonicalStatements = REQUIRED_STATEMENT_IDS.map((id) => ({
      id,
      text: STATEMENT_TEXT_BY_ID[id],
      agreed: true,
    }));

    const ip = clientIp(req);
    const userAgent = req.headers["user-agent"] || null;
    const completedAt = new Date().toISOString();
    const safeName = String(legalName).trim().slice(0, 200);
    const safeUa = userAgent ? String(userAgent).slice(0, 500) : null;

    // 4) Append-only audit row (the defensible consent record).
    const { error: auditError } = await supabaseServer
      .from("attestation_audit")
      .insert({
        user_id: user.id,
        version: ATTESTATION_VERSION,
        statements: canonicalStatements,
        legal_name: safeName,
        ip_address: ip,
        user_agent: safeUa,
      });
    if (auditError) throw auditError;

    // 5) Profile snapshot the auth wall reads.
    const { error: profileError } = await supabaseServer
      .from("profiles")
      .update({
        attestation_completed_at: completedAt,
        attestation_version: ATTESTATION_VERSION,
        attestation_statements: canonicalStatements,
        attestation_ip: ip,
        attestation_user_agent: safeUa,
        attestation_legal_name: safeName,
      })
      .eq("id", user.id);
    if (profileError) throw profileError;

    return res.status(200).json({
      ok: true,
      attestation_completed_at: completedAt,
      attestation_version: ATTESTATION_VERSION,
    });
  } catch (err) {
    console.error("Attestation error:", err?.message || err);
    return res.status(500).json({ error: "Failed to record attestation" });
  }
}
