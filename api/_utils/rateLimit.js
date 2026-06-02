/* eslint-env node */
/**
 * api/_utils/rateLimit.js
 * Distributed rate limiting for Vercel serverless API endpoints.
 *
 * Uses Supabase as the backing store so limits apply across all invocations
 * (unlike in-memory maps which only work within a single cold-start instance).
 *
 * Fails OPEN: if Supabase is unavailable or the table does not exist yet,
 * the request is allowed through. This prevents legitimate customers from
 * being blocked by infrastructure issues.
 *
 * SQL setup: run SUPABASE_RATE_LIMITS.sql in your Supabase SQL editor.
 *
 * Usage:
 *   import { checkRateLimit } from "../_utils/rateLimit.js";
 *
 *   const allowed = await checkRateLimit(req, res, { max: 5, windowMs: 60_000 });
 *   if (!allowed) return; // 429 already sent
 */

import { supabaseServer } from "../../lib/supabaseServer.js";

const DEFAULT_WINDOW_MS = 60_000; // 1 minute
const DEFAULT_MAX = 10; // 10 requests per window

/**
 * Extract the real client IP from the request, respecting Vercel's
 * x-forwarded-for header.
 */
function getClientIp(req) {
  const forwarded = req.headers?.["x-forwarded-for"];
  if (forwarded) {
    return String(forwarded).split(",")[0].trim();
  }
  return (
    req.socket?.remoteAddress ||
    req.connection?.remoteAddress ||
    "unknown"
  );
}

/**
 * Check and enforce a rate limit for a request.
 *
 * @param {object} req        - Node.js / Vercel request object
 * @param {object} res        - Node.js / Vercel response object
 * @param {object} [options]
 * @param {number} [options.max=10]           - Maximum allowed requests per window
 * @param {number} [options.windowMs=60000]   - Time window in milliseconds
 * @param {string} [options.endpoint="api"]   - Logical endpoint name (used as part of key)
 *
 * @returns {Promise<boolean>} true if allowed, false if rate-limited (429 already sent)
 */

// Max length for the endpoint segment of the DB key (matches the `key` column size).
const MAX_ENDPOINT_LENGTH = 64;

export async function checkRateLimit(req, res, options = {}) {
  const max = Number(options.max ?? DEFAULT_MAX);
  const windowMs = Number(options.windowMs ?? DEFAULT_WINDOW_MS);
  const endpoint = String(options.endpoint || "api").slice(0, MAX_ENDPOINT_LENGTH);

  const ip = getClientIp(req);
  const key = `${endpoint}:${ip}`;
  const windowStart = new Date(Date.now() - windowMs).toISOString();

  try {
    // Fetch existing record for this key within the current window.
    const { data, error } = await supabaseServer
      .from("rate_limits")
      .select("id, request_count, window_start")
      .eq("key", key)
      .maybeSingle();

    if (error) {
      // Table likely doesn't exist yet — fail open.
      return true;
    }

    const now = new Date().toISOString();

    if (!data || new Date(data.window_start) < new Date(windowStart)) {
      // No record or the window has expired — (re)create at count = 1.
      await supabaseServer.from("rate_limits").upsert(
        { key, request_count: 1, window_start: now },
        { onConflict: "key" }
      );
      return true;
    }

    if (data.request_count >= max) {
      // Limit exceeded — return 429.
      res.status(429).json({
        error: "Too many requests. Please wait a moment and try again.",
      });
      return false;
    }

    // Increment the count within the current window.
    await supabaseServer
      .from("rate_limits")
      .update({ request_count: data.request_count + 1 })
      .eq("key", key);

    return true;
  } catch {
    // Any unexpected error — fail open to avoid blocking legitimate users.
    return true;
  }
}
