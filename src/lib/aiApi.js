// src/lib/aiApi.js
// Authenticated client for the guardrail'd /api/ai/* endpoints. The bearer
// token comes from the Supabase session (the endpoints call requireUser). All
// AI safety (RUO guardrail, refusals, post-processing) lives server-side; this
// only transports the request and normalizes graceful-degradation states.
import { supabase } from "./supabaseClient";

async function authHeaders() {
  let token = null;
  try {
    const { data } = await supabase.auth.getSession();
    token = data?.session?.access_token || null;
  } catch {
    token = null;
  }
  return { "Content-Type": "application/json", ...(token ? { Authorization: `Bearer ${token}` } : {}) };
}

/**
 * POST to an AI endpoint.
 * @returns {Promise<{reply:string, refused:boolean, notConfigured:boolean}>}
 * Throws on 4xx/5xx other than 503 (which means "AI not configured").
 */
export async function askAi(path, body) {
  const res = await fetch(path, {
    method: "POST",
    headers: await authHeaders(),
    body: JSON.stringify(body || {}),
  });
  if (res.status === 503) return { reply: "", refused: false, notConfigured: true };
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data?.error || `Request failed (${res.status})`);
  return { reply: data.reply || "", refused: Boolean(data.refused), notConfigured: false };
}

/**
 * POST to an AI endpoint and return the raw JSON (for non-chat shapes like
 * semantic search). Returns { notConfigured: true } on 503.
 */
export async function postAiRaw(path, body) {
  const res = await fetch(path, {
    method: "POST",
    headers: await authHeaders(),
    body: JSON.stringify(body || {}),
  });
  if (res.status === 503) return { notConfigured: true };
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data?.error || `Request failed (${res.status})`);
  return data;
}
