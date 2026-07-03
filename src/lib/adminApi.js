// src/lib/adminApi.js
// Authenticated fetch helpers for the admin endpoints. The bearer token is
// attached from the Supabase session; the SERVER (requireAdmin) is the real
// gate — this is convenience, not a security boundary.
import { supabase } from "./supabaseClient";

async function authHeaders(extra = {}) {
  let token = null;
  try {
    const { data } = await supabase.auth.getSession();
    token = data?.session?.access_token || null;
  } catch {
    token = null;
  }
  return { ...extra, ...(token ? { Authorization: `Bearer ${token}` } : {}) };
}

async function parse(res) {
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data?.error || `Request failed (${res.status})`);
  return data;
}

export async function adminGet(path) {
  const res = await fetch(path, { headers: await authHeaders() });
  return parse(res);
}

export async function adminSend(path, method, body) {
  const res = await fetch(path, {
    method,
    headers: await authHeaders({ "Content-Type": "application/json" }),
    body: JSON.stringify(body || {}),
  });
  return parse(res);
}
