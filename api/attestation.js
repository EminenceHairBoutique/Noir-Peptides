/* eslint-env node */
// api/attestation.js
// Records a research-use attestation with a server-derived audit trail
// (IP + user-agent come from request headers, not the client, so the consent
// record is defensible). Writes both the profile snapshot and an append-only
// row in attestation_audit. Requires a valid Supabase bearer token.

import { supabaseServer } from "../lib/supabaseServer.js";
import { requireUser } from "./_utils/auth.js";

function clientIp(req) {
  const xff = req.headers["x-forwarded-for"];
  if (xff) return String(xff).split(",")[0].trim();
  return (
    req.headers["x-real-ip"] ||
    req.socket?.remoteAddress ||
    null
  );
}

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const user = await requireUser(req, res);
  if (!user) return; // 401 already sent

  try {
    const { version, statements, legalName } = req.body || {};

    if (!version || !Array.isArray(statements) || !legalName) {
      return res.status(400).json({ error: "Missing attestation fields" });
    }
    if (!statements.length) {
      return res.status(400).json({ error: "No statements affirmed" });
    }

    const ip = clientIp(req);
    const userAgent = req.headers["user-agent"] || null;
    const completedAt = new Date().toISOString();

    // 1) Append-only audit row (the defensible consent record).
    const { error: auditError } = await supabaseServer
      .from("attestation_audit")
      .insert({
        user_id: user.id,
        version: String(version),
        statements,
        legal_name: String(legalName).slice(0, 200),
        ip_address: ip,
        user_agent: userAgent ? String(userAgent).slice(0, 500) : null,
      });
    if (auditError) throw auditError;

    // 2) Profile snapshot the auth wall reads.
    const { error: profileError } = await supabaseServer
      .from("profiles")
      .update({
        attestation_completed_at: completedAt,
        attestation_version: String(version),
        attestation_statements: statements,
        attestation_ip: ip,
        attestation_user_agent: userAgent ? String(userAgent).slice(0, 500) : null,
        attestation_legal_name: String(legalName).slice(0, 200),
      })
      .eq("id", user.id);
    if (profileError) throw profileError;

    return res.status(200).json({
      ok: true,
      attestation_completed_at: completedAt,
      attestation_version: String(version),
    });
  } catch (err) {
    console.error("Attestation error:", err?.message || err);
    return res.status(500).json({ error: "Failed to record attestation" });
  }
}
