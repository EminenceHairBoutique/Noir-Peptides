// api/coa-file/[name].js   (opt cycle 10 — addendum C8)
// GET /api/coa-file/<id>.<ext> → 302 to a short-lived signed URL for the
// certificate stored in the private bucket. PUBLISHED certificates only; an
// unpublished or missing one is a 404 with no hint. Nothing is cached.
import { checkRateLimit } from "../_utils/rateLimit.js";
import { supabaseServer } from "../../lib/supabaseServer.js";
import { jsonResponse as json } from "../_utils/body.js";
import { COA_BUCKET, SIGNED_URL_TTL_SECONDS, parseFileName } from "../../lib/coaFiles.js";

export default async function handler(req, res) {
  if (req.method !== "GET" && req.method !== "HEAD") return json(res, 405, { error: "Method not allowed" });
  if (!(await checkRateLimit(req, res, { endpoint: "coa-file", max: 120, windowMs: 60_000 }))) return;
  const parsed = parseFileName(req.query?.name ?? String(req.url || "").split("/").pop().split("?")[0]);
  if (!parsed) return json(res, 404, { error: "Not found" });

  const { data: coa } = await supabaseServer.from("coas").select("id, is_published, file_path").eq("id", parsed.id).maybeSingle();
  if (!coa || !coa.is_published || !coa.file_path) return json(res, 404, { error: "Not found" });

  const { data, error } = await supabaseServer.storage.from(COA_BUCKET).createSignedUrl(coa.file_path, SIGNED_URL_TTL_SECONDS);
  if (error || !data?.signedUrl) return json(res, 404, { error: "Not found" });
  res.statusCode = 302;
  res.setHeader("Location", data.signedUrl);
  res.setHeader("Cache-Control", "private, no-store");
  res.end();
}
