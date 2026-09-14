// api/admin/coa-upload.js   (opt cycle 10 — addendum C8: COA file upload)
// POST the certificate's bytes (PDF or JPEG) with header x-coa-id → stored in
// the private `coa-files` bucket; the row gets file_path + the stable
// /api/coa-file/<id>.<ext> URL. Server-enforced admin, rate-limited (the first
// admin route to be: a file sink is worth the ceiling), size-capped BEFORE
// buffering, content-sniffed (the file name and Content-Type are not trusted).
import { requireAdmin } from "../_utils/auth.js";
import { checkRateLimit } from "../_utils/rateLimit.js";
import { supabaseServer } from "../../lib/supabaseServer.js";
import { readRawBody, jsonResponse as json } from "../_utils/body.js";
import { failSafely } from "../../lib/apiError.js";
import { COA_BUCKET, MAX_COA_FILE_BYTES, sniffCoaFile, parseCoaId, objectPathFor, publicFileUrlFor } from "../../lib/coaFiles.js";

// The body is the file itself — no JSON parsing.
export const config = { api: { bodyParser: false } };

export default async function handler(req, res) {
  const admin = await requireAdmin(req, res);
  if (!admin) return;
  if (req.method !== "POST") return json(res, 405, { error: "Method not allowed" });
  if (!(await checkRateLimit(req, res, { endpoint: "admin-coa-upload", max: 30, windowMs: 60_000 }))) return;

  const id = parseCoaId(req.headers?.["x-coa-id"]);
  if (!id) return json(res, 400, { error: "x-coa-id (the certificate's numeric id) is required" });

  const { buffer, tooLarge } = await readRawBody(req, { maxBytes: MAX_COA_FILE_BYTES });
  if (tooLarge) return json(res, 413, { error: `The file is larger than ${MAX_COA_FILE_BYTES / 1024 / 1024} MB` });
  const kind = sniffCoaFile(buffer);
  if (!kind) return json(res, 415, { error: "Only PDF or JPEG certificates are accepted (checked by content, not by file name)" });

  const { data: coa } = await supabaseServer.from("coas").select("id, is_published, file_path").eq("id", id).maybeSingle();
  if (!coa) return json(res, 404, { error: "Not found" });

  const objectPath = objectPathFor(id, buffer, kind.ext);
  const up = await supabaseServer.storage.from(COA_BUCKET).upload(objectPath, buffer, { contentType: kind.contentType, upsert: true });
  if (up?.error) return failSafely(res, { status: 500, code: "coa_upload_failed", message: "Could not store the certificate file.", error: up.error, context: "admin/coa-upload:store" });

  const { data: updated, error } = await supabaseServer
    .from("coas")
    .update({ file_path: objectPath, file_url: publicFileUrlFor(id, kind.ext) })
    .eq("id", id)
    .select("id, file_url, file_path, is_published")
    .maybeSingle();
  if (error) return failSafely(res, { status: 500, code: "coa_upload_link_failed", message: "The file was stored but the certificate could not be updated.", error, context: "admin/coa-upload:link" });
  // Opt cycle 12: a replaced certificate's previous object is removed (best
  // effort) — every re-upload used to orphan a private object forever.
  const previous = coa.file_path;
  if (previous && previous !== objectPath) {
    const rm = await supabaseServer.storage.from(COA_BUCKET).remove([previous]).catch((e) => ({ error: e }));
    if (rm?.error) console.warn("coa-upload: previous object not removed", String(rm.error?.message || rm.error).slice(0, 120));
  }
  return json(res, 200, { coa: updated, bytes: buffer.length, type: kind.contentType, replaced: Boolean(previous && previous !== objectPath) });
}
