/**
 * api/_utils/body.js
 * Shared JSON body reader for the serverless endpoints. Handles the three
 * shapes seen across Vercel / local dev: pre-parsed object, raw string, and an
 * unread request stream. Returns null on invalid JSON.
 */
export async function readJsonBody(req) {
  const raw = req.body;
  if (raw && typeof raw === "object" && !Buffer.isBuffer(raw)) return raw;
  if (typeof raw === "string") {
    try {
      return JSON.parse(raw);
    } catch {
      return null;
    }
  }
  if (Buffer.isBuffer(raw)) {
    try {
      return JSON.parse(raw.toString("utf8") || "{}");
    } catch {
      return null;
    }
  }
  const chunks = [];
  for await (const chunk of req) chunks.push(chunk);
  if (!chunks.length) return {};
  try {
    return JSON.parse(Buffer.concat(chunks).toString("utf8"));
  } catch {
    return null;
  }
}

/**
 * Raw request body as a Buffer, capped. Handles the same shapes as
 * readJsonBody (Buffer, string, unread stream). Above `maxBytes` reading
 * stops and { tooLarge: true } is returned — the caller answers 413 and
 * nothing is buffered beyond the cap. (opt cycle 10, C8: COA file upload)
 */
export async function readRawBody(req, { maxBytes = 4 * 1024 * 1024 } = {}) {
  const raw = req.body;
  if (Buffer.isBuffer(raw)) return raw.length > maxBytes ? { buffer: null, tooLarge: true } : { buffer: raw, tooLarge: false };
  if (typeof raw === "string") { const b = Buffer.from(raw); return b.length > maxBytes ? { buffer: null, tooLarge: true } : { buffer: b, tooLarge: false }; }
  const chunks = [];
  let total = 0;
  for await (const chunk of req) {
    const b = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
    total += b.length;
    if (total > maxBytes) return { buffer: null, tooLarge: true };
    chunks.push(b);
  }
  return { buffer: Buffer.concat(chunks), tooLarge: false };
}

export function jsonResponse(res, status, body) {
  res.statusCode = status;
  res.setHeader("Content-Type", "application/json");
  res.end(JSON.stringify(body));
}
