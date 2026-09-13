// lib/coaFiles.js   (opt cycle 10 — addendum C8: COA file upload)
// The rules for certificate FILES, shared by the admin upload endpoint, the
// public file route and their tests. Files live in a PRIVATE Supabase Storage
// bucket; the row keeps the object path and a STABLE same-origin URL
// (/api/coa-file/<id>.<ext>) that redirects to a short-lived signed URL on
// demand — a signed URL is never stored, because coas.file_url is rendered
// into static HTML at build time and would expire there.
import { createHash } from "node:crypto";

export const COA_BUCKET = "coa-files";
export const MAX_COA_FILE_BYTES = 4 * 1024 * 1024; // Vercel's request-body ceiling is 4.5 MB
export const SIGNED_URL_TTL_SECONDS = 600;

/** Content sniff by magic bytes — the file name and Content-Type header are ignored. */
export function sniffCoaFile(buf) {
  if (!Buffer.isBuffer(buf) || buf.length < 8) return null;
  if (buf.subarray(0, 5).toString("latin1") === "%PDF-") return { ext: "pdf", contentType: "application/pdf" };
  if (buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff) return { ext: "jpg", contentType: "image/jpeg" };
  return null;
}

/** coas.id is a bigint identity; accept only a plain positive integer. */
export function parseCoaId(value) {
  const s = String(value ?? "").trim();
  return /^[1-9]\d{0,17}$/.test(s) ? s : null;
}

/** Object path inside the bucket: content-addressed, so re-uploading the same file is idempotent. */
export function objectPathFor(coaId, buf, ext) {
  const digest = createHash("sha256").update(buf).digest("hex").slice(0, 16);
  return `coas/${coaId}/${digest}.${ext}`;
}

/** The stable URL stored in coas.file_url and rendered by the site. */
export function publicFileUrlFor(coaId, ext) {
  return `/api/coa-file/${coaId}.${ext}`;
}

/** "<id>.<ext>" → { id, ext } or null. */
export function parseFileName(name) {
  const m = /^([1-9]\d{0,17})\.(pdf|jpg)$/.exec(String(name ?? ""));
  return m ? { id: m[1], ext: m[2] } : null;
}
