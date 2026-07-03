// api/ai/compliance-scan.js
// Admin Compliance Copy Scanner (server). Always runs the deterministic RUO
// regex linter (src/lib/complianceScan). When ANTHROPIC_API_KEY is set and
// { deep: true } is requested, it ALSO asks Claude — under the RUO guardrail —
// to surface subtler implied-benefit / human-use / therapeutic phrasing the
// regex can't catch. Degrades gracefully to regex-only when no key is present.
//
// Admin-only (requireAdmin). This scans copy BEFORE publishing; it never
// generates marketing copy.
import { requireAdmin } from "../_utils/auth.js";
import { readJsonBody, jsonResponse as json } from "../_utils/body.js";
import { scanCopy } from "../../src/lib/complianceScan.js";
import { GUARDRAIL } from "./guardrail.js";
import { getClient, MODEL } from "./_shared.js";

const AI_INSTRUCTIONS = `You are a compliance reviewer for a research-use-only (RUO) chemical supplier. You are given website/product COPY. Identify any phrasing that implies human or veterinary use, dosing or administration, or a therapeutic/physiological/disease benefit — anything that could read as a medical claim or use instruction. Do NOT rewrite the copy. Do NOT add new claims. Return ONLY a compact JSON array (no prose) of objects: {"quote": "<the exact offending phrase>", "category": "human-use|dosing|administration|therapeutic-benefit|disease-claim|implied-efficacy", "why": "<short reason>"}. If nothing is problematic, return []. Never output dosing/administration guidance yourself.`;

function extractJsonArray(text) {
  if (!text) return [];
  const start = text.indexOf("[");
  const end = text.lastIndexOf("]");
  if (start === -1 || end === -1 || end <= start) return [];
  try {
    const arr = JSON.parse(text.slice(start, end + 1));
    return Array.isArray(arr) ? arr.slice(0, 50) : [];
  } catch {
    return [];
  }
}

async function aiAugment(text) {
  const client = getClient();
  if (!client) return { available: false, findings: [] };
  try {
    const resp = await client.messages.create({
      model: MODEL,
      max_tokens: 1200,
      system: [{ type: "text", text: `${GUARDRAIL}\n\n${AI_INSTRUCTIONS}`, cache_control: { type: "ephemeral" } }],
      messages: [{ role: "user", content: String(text).slice(0, 8000) }],
    });
    const out = resp.content.filter((b) => b.type === "text").map((b) => b.text).join("\n");
    return { available: true, findings: extractJsonArray(out) };
  } catch (err) {
    return { available: true, error: err?.message || "AI scan failed", findings: [] };
  }
}

export default async function handler(req, res) {
  if (req.method !== "POST") return json(res, 405, { error: "Method not allowed" });

  const admin = await requireAdmin(req, res);
  if (!admin) return;

  const body = await readJsonBody(req);
  const text = String(body?.text || "");
  if (!text.trim()) return json(res, 400, { error: "text is required" });

  // Deterministic baseline — always runs, no external dependency.
  const regex = scanCopy(text);

  // Optional AI deep pass.
  const wantDeep = body?.deep === true;
  const ai = wantDeep ? await aiAugment(text) : { available: Boolean(getClient()), findings: [] };

  return json(res, 200, {
    clean: regex.clean && (ai.findings?.length || 0) === 0,
    regex: { count: regex.count, findings: regex.findings },
    ai: { requested: wantDeep, available: ai.available, error: ai.error || null, findings: ai.findings || [] },
  });
}
