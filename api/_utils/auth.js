/* eslint-env node */
/**
 * api/_utils/auth.js
 * Centralized server-side authentication helpers for Vercel serverless functions.
 *
 * Usage:
 *   import { requireAdmin, requirePartner, getUserFromReq } from "../_utils/auth.js";
 *
 *   const user = await requireAdmin(req, res);
 *   if (!user) return; // response already sent
 */

import { supabaseServer } from "../../lib/supabaseServer.js";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function getBearerToken(req) {
  const auth = req.headers?.authorization || req.headers?.Authorization;
  if (!auth) return null;
  const tokenMatch = String(auth).match(/^Bearer\s+(.+)$/i);
  return tokenMatch ? tokenMatch[1] : null;
}

function adminEmailAllowlist() {
  const raw = process.env.ADMIN_EMAILS || process.env.VITE_ADMIN_EMAILS || "";
  return raw
    .split(",")
    .map((emailAddress) => emailAddress.trim().toLowerCase())
    .filter(Boolean);
}

function json(res, status, body) {
  res.statusCode = status;
  res.setHeader("Content-Type", "application/json");
  res.end(JSON.stringify(body));
}

// ---------------------------------------------------------------------------
// Core: resolve Supabase user from Bearer token
// ---------------------------------------------------------------------------

/**
 * Resolve the Supabase user from the Authorization header.
 * Returns null if no token or token is invalid.
 */
export async function getUserFromReq(req) {
  const token = getBearerToken(req);
  if (!token) return null;

  try {
    const { data, error } = await supabaseServer.auth.getUser(token);
    if (error) return null;
    return data?.user || null;
  } catch {
    return null;
  }
}

// ---------------------------------------------------------------------------
// Guards (call in serverless handler; return null if response already sent)
// ---------------------------------------------------------------------------

/**
 * Require a valid authenticated Supabase user.
 * On failure: sends 401 and returns null.
 */
export async function requireUser(req, res) {
  const user = await getUserFromReq(req);
  if (!user) {
    json(res, 401, { error: "Unauthorized" });
    return null;
  }
  return user;
}

/**
 * Require the caller to be an admin (email must be in ADMIN_EMAILS env var).
 * On failure: sends 401 or 403 and returns null.
 */
export async function requireAdmin(req, res) {
  const user = await getUserFromReq(req);
  if (!user) {
    json(res, 401, { error: "Unauthorized" });
    return null;
  }

  const allow = adminEmailAllowlist();
  const email = String(user.email || "").toLowerCase();

  if (!allow.length || !allow.includes(email)) {
    json(res, 403, { error: "Forbidden" });
    return null;
  }

  return user;
}

/**
 * Require the caller to be an approved partner (checks Supabase profile row).
 * On failure: sends 401 or 403 and returns null.
 */
export async function requirePartner(req, res) {
  const user = await getUserFromReq(req);
  if (!user) {
    json(res, 401, { error: "Unauthorized" });
    return null;
  }

  // Fetch partner status from profile table (server-side enforcement).
  const { data: profile } = await supabaseServer
    .from("profiles")
    .select("account_tier, partner_status")
    .eq("id", user.id)
    .maybeSingle();

  const tier = String(profile?.account_tier || "").toLowerCase();
  const status = String(profile?.partner_status || "").toLowerCase();

  const isApproved =
    tier === "partner" ||
    tier === "wholesale" ||
    tier.startsWith("partner_") ||
    status === "approved" ||
    status === "active";

  if (!isApproved) {
    json(res, 403, { error: "Forbidden: partner access required" });
    return null;
  }

  return { ...user, profile };
}
