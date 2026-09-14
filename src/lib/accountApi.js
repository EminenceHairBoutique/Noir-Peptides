// src/lib/accountApi.js — authenticated GET against the account endpoints
// (opt cycle 12). Mirrors src/lib/adminApi.js: the Supabase session token is
// the bearer; without a session the call resolves to null (never throws).
import { supabase } from "./supabaseClient";

export async function accountGet(path) {
  if (!supabase) return null;
  const token = (await supabase.auth.getSession()).data?.session?.access_token;
  if (!token) return null;
  const res = await fetch(path, { headers: { Authorization: `Bearer ${token}` } });
  if (!res.ok) return null;
  return res.json().catch(() => null);
}
