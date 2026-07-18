// src/lib/labelsApi.js
// Client for the admin label endpoints (bearer via adminApi helpers) and the
// public verification endpoint. Server enforcement is the boundary; this is
// convenience only.
import { adminGet, adminSend } from "./adminApi";

export const listLabelConfigs = () => adminGet("/api/admin/labels");
export const getLabelConfig = (id) => adminGet(`/api/admin/labels?id=${encodeURIComponent(id)}`);
export const getLabelHistory = (id) => adminGet(`/api/admin/labels?history=${encodeURIComponent(id)}`);
export const createLabelConfig = (fields) => adminSend("/api/admin/labels", "POST", fields);
export const patchLabelConfig = (id, fields) => adminSend("/api/admin/labels", "PATCH", { id, ...fields });

/** Public: verify a label code (no auth). */
export async function verifyCode(code) {
  const res = await fetch(`/api/verify?code=${encodeURIComponent(code)}`);
  const data = await res.json().catch(() => ({}));
  if (!res.ok) return { state: "unavailable" };
  return data;
}
