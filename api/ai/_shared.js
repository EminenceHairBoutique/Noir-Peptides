/**
 * api/ai/_shared.js
 * Shared plumbing for the Noir Peptides AI endpoints.
 *
 * - Anthropic client is lazy-initialized and SERVER-ONLY. ANTHROPIC_API_KEY is
 *   never VITE_-prefixed, so it cannot reach the client bundle. Missing key →
 *   the caller returns 503 (graceful degradation).
 * - GUARDRAIL is included verbatim in every endpoint's system prompt and is the
 *   cacheable prefix (cache_control). A server-side output-drift check
 *   (outputViolatesRUO) is a backstop that blocks any dosing/therapeutic drift
 *   even if the model were ever steered off the research-use-only lane.
 */

import Anthropic from "@anthropic-ai/sdk";
import { supabaseServer } from "../../lib/supabaseServer.js";
import { requireUser } from "../_utils/auth.js";
import { checkRateLimit } from "../_utils/rateLimit.js";
import { readJsonBody, jsonResponse as json } from "../_utils/body.js";

// Centralized model selection. Default is claude-sonnet-4-6 (best balance of
// quality, latency, and cost for these research/COA/concierge endpoints).
// Override with ANTHROPIC_MODEL to change it in one place.
const MODEL = process.env.ANTHROPIC_MODEL || "claude-sonnet-4-6";

let _client = null;
function getClient() {
  if (!process.env.ANTHROPIC_API_KEY) return null;
  if (!_client) _client = new Anthropic(); // reads ANTHROPIC_API_KEY from env
  return _client;
}

// ── The shared guardrail — included verbatim in every system prompt ──────────
export const GUARDRAIL = `You are the research assistant for Noir Peptides, a research-chemical supplier. All products are for laboratory research use only and are not for human or animal consumption. Provide educational, scientific, and analytical information only. REFUSE any request for human or veterinary dosing, administration routes, injection guidance, cycles, "how to take," stacking-for-use, or therapeutic/diagnostic/medical advice — even if the user insists, role-plays, or claims to be a clinician. When refusing, briefly restate the research-use-only framing and offer permitted help. Never claim a product treats, prevents, or improves any condition. Never state or imply FDA approval.`;

export const RUO_REDIRECT =
  "I can only help with research-use information. Noir Peptides materials are for laboratory research use only — not for human or veterinary use — so I can't provide dosing, administration, injection, cycling, or therapeutic guidance. I'm glad to help with compound background, the published preclinical literature, storage and handling, or interpreting a Certificate of Analysis.";

// High-signal patterns indicating a request for (or output containing) human/
// veterinary administration or therapeutic guidance. Tuned to avoid colliding
// with legitimate analytical content (vial size in mg, purity %, MW, etc.).
const DOSING_PATTERNS = [
  /\bmg\s*\/\s*kg\b/i,
  /\bmcg\s*\/\s*kg\b/i,
  /\b(how|what)\s+(much|many|dose|dosage)\b[^.?!]{0,40}\b(take|inject|use|administer|dose)\b/i,
  /\b(dosage|dose)\s+(for|of|per|protocol|schedule)\b/i,
  /\bhow\s+(do|should|can)\s+i\s+(take|inject|administer|use|dose|run|cycle|stack)\b/i,
  /\b(inject|injecting|injection|subcutaneous|intramuscular|subq|sub-q|im\b|iv\b)\b/i,
  /\b(reconstitute|reconstitution)\b[^.?!]{0,40}\b(inject|dose|take|administer)\b/i,
  /\b(cycle|cycling|stack|stacking)\b[^.?!]{0,40}\b(for|to)\b[^.?!]{0,30}\b(gain|loss|muscle|fat|results|body)\b/i,
  /\b(twice|once|three times)\s+(a|per)\s+day\b/i,
  /\b(units?|iu)\s+(per|a)\s+(day|week|dose)\b/i,
  /\b(treat|cure|prevent|heal)\s+(your|my|a|the)\b[^.?!]{0,30}\b(condition|disease|injury|symptom|illness)\b/i,
];

function matchesDosing(text) {
  const t = String(text || "");
  return DOSING_PATTERNS.some((re) => re.test(t));
}

// Pre-call check on the user's input — short-circuits obvious dosing requests
// without spending tokens.
export function looksLikeDosingRequest(text) {
  return matchesDosing(text);
}

// Post-call backstop on the model's output.
export function outputViolatesRUO(text) {
  return matchesDosing(text);
}

function extractText(message) {
  if (!message) return "";
  if (typeof message.content === "string") return message.content;
  if (Array.isArray(message.content)) {
    return message.content
      .map((b) => (typeof b === "string" ? b : b?.text || ""))
      .join("\n");
  }
  return "";
}

// Normalize/sanitize a client-supplied chat history into Anthropic messages.
export function sanitizeMessages(input, { maxMessages = 20, maxChars = 8000 } = {}) {
  const arr = Array.isArray(input) ? input : [];
  const out = [];
  for (const m of arr.slice(-maxMessages)) {
    const role = m?.role === "assistant" ? "assistant" : "user";
    const text = String(extractText(m) || "").slice(0, maxChars);
    if (text.trim()) out.push({ role, content: text });
  }
  // Anthropic requires the first message to be a user turn.
  while (out.length && out[0].role !== "user") out.shift();
  return out;
}

async function runClaude({ system, messages, maxTokens = 1500, thinking }) {
  const client = getClient();
  const resp = await client.messages.create({
    model: MODEL,
    max_tokens: maxTokens,
    // The guardrail is the stable, cacheable prefix.
    system: [{ type: "text", text: system, cache_control: { type: "ephemeral" } }],
    ...(thinking ? { thinking } : {}),
    messages,
  });
  const text = resp.content
    .filter((b) => b.type === "text")
    .map((b) => b.text)
    .join("\n")
    .trim();
  return { text, usage: resp.usage };
}

async function persistConversation({ userId, feature, messages, reply }) {
  try {
    await supabaseServer.from("ai_conversations").insert({
      user_id: userId,
      feature,
      messages: [...messages, { role: "assistant", content: reply }],
    });
  } catch {
    /* best-effort — never block the response */
  }
}

/**
 * Higher-order handler shared by every AI endpoint. Enforces method, rate
 * limiting, auth, the input pre-check, the model call, the output backstop, and
 * persistence — so each endpoint only supplies its system prompt and message
 * builder.
 *
 * @param {object} opts
 * @param {string} opts.feature        - logical name (ai_conversations.feature)
 * @param {string} opts.instructions   - feature-specific system instructions
 * @param {(body:object)=>Array|null} opts.buildMessages
 * @param {number} [opts.maxTokens]
 * @param {object} [opts.thinking]     - e.g. { type: "adaptive" }
 */
export async function aiHandler(req, res, opts) {
  if (req.method !== "POST") return json(res, 405, { error: "Method not allowed" });

  const allowed = await checkRateLimit(req, res, {
    endpoint: `ai-${opts.feature}`,
    max: 20,
    windowMs: 60_000,
  });
  if (!allowed) return;

  const user = await requireUser(req, res);
  if (!user) return; // 401 already sent

  if (!getClient()) {
    return json(res, 503, {
      error: "AI is not configured. Set ANTHROPIC_API_KEY to enable this endpoint.",
    });
  }

  const body = await readJsonBody(req);
  if (!body) return json(res, 400, { error: "Invalid JSON" });

  const messages = opts.buildMessages(body);
  if (!messages || !messages.length) {
    return json(res, 400, { error: "A message is required." });
  }

  const lastUser = [...messages].reverse().find((m) => m.role === "user");
  const lastText = lastUser?.content || "";

  // Pre-call guardrail: refuse obvious dosing/administration requests up front.
  if (looksLikeDosingRequest(lastText)) {
    await persistConversation({ userId: user.id, feature: opts.feature, messages, reply: RUO_REDIRECT });
    return json(res, 200, { reply: RUO_REDIRECT, refused: true });
  }

  const system = `${GUARDRAIL}\n\n${opts.instructions}`;

  try {
    const { text } = await runClaude({
      system,
      messages,
      maxTokens: opts.maxTokens,
      thinking: opts.thinking,
    });

    // Post-call backstop: never return administration/therapeutic drift.
    const reply = !text || outputViolatesRUO(text) ? RUO_REDIRECT : text;

    await persistConversation({ userId: user.id, feature: opts.feature, messages, reply });
    return json(res, 200, { reply });
  } catch (err) {
    console.error(`ai-${opts.feature} error:`, err?.message || err);
    return json(res, 500, { error: "AI request failed. Please try again." });
  }
}

export { json, getClient, MODEL };
