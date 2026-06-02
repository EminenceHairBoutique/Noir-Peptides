/* eslint-env node */
import crypto from "crypto";
import { supabaseServer } from "../../lib/supabaseServer.js";

// Private bucket (recommended). Client uploads using a short-lived signed URL.
const DEFAULT_BUCKET = "atelier-uploads";

function safeFilename(name) {
  const original = String(name || "upload");
  // keep extension if present
  const parts = original.split(".");
  const ext = parts.length > 1 ? `.${parts.pop()}` : "";
  const base = parts.join(".");
  const cleaned = base
    .toLowerCase()
    .replace(/[^a-z0-9-_]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 80);
  return `${cleaned || "upload"}${ext}`;
}

function getBearerToken(req) {
  const authHeader = req.headers?.authorization || req.headers?.Authorization || "";
  const authHeaderString = String(authHeader);
  if (!authHeaderString.toLowerCase().startsWith("bearer ")) return null;
  return authHeaderString.slice(7);
}

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    const token = getBearerToken(req);
    if (!token) {
      return res.status(401).json({ error: "Missing auth token" });
    }

    const { data: authData, error: authErr } = await supabaseServer.auth.getUser(token);
    if (authErr || !authData?.user) {
      return res.status(401).json({ error: "Invalid auth token" });
    }

    const userId = authData.user.id;
    const {
      filename,
      contentType,
      size,
      groupId,
      label,
      bucket: bucketFromClient,
    } = req.body || {};

    const bucket = String(bucketFromClient || process.env.SUPABASE_ATELIER_BUCKET || DEFAULT_BUCKET);
    const safeName = safeFilename(filename);
    const fileSize = Number(size || 0);
    const ct = String(contentType || "").toLowerCase();

    // Basic server-side validation (keeps abuse + costs down).
    const maxBytes = 6 * 1024 * 1024; // 6MB
    const allowed = [
      "image/jpeg",
      "image/jpg",
      "image/png",
      "image/webp",
      "image/heic",
      "image/heif",
    ];

    if (!safeName || safeName.length < 3) {
      return res.status(400).json({ error: "Missing filename" });
    }

    if (!allowed.includes(ct)) {
      return res.status(400).json({
        error: "Unsupported file type. Please upload JPG, PNG, WebP, or HEIC.",
      });
    }

    if (fileSize && fileSize > maxBytes) {
      return res.status(400).json({
        error: "File too large. Please keep images under 6MB.",
      });
    }

    const g = String(groupId || "").trim() || crypto.randomUUID();
    const stamp = Date.now();
    const folder = `atelier/${userId}/${g}`;
    const path = `${folder}/${stamp}_${safeName}`;

    // Create signed upload URL (short-lived token).
    const { data, error } = await supabaseServer.storage
      .from(bucket)
      .createSignedUploadUrl(path);

    if (error) {
      return res.status(500).json({ error: error.message || "Failed to create signed upload" });
    }

    // `data` typically includes: signedUrl, path, token
    return res.status(200).json({
      bucket,
      path,
      groupId: g,
      label: label || null,
      ...data,
    });
  } catch (err) {
    return res.status(500).json({ error: err?.message || "Server error" });
  }
}
