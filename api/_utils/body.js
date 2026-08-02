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

export function jsonResponse(res, status, body) {
  res.statusCode = status;
  res.setHeader("Content-Type", "application/json");
  res.end(JSON.stringify(body));
}
