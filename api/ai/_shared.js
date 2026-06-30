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
import {
  GUARDRAIL,
  RUO_REDIRECT,
  looksLikeDosingRequest,
  outputViolatesRUO,
} from "./guardrail.js";

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

// The RUO guardrail (GUARDRAIL / RUO_REDIRECT) and the dosing/therapeutic
// detectors (looksLikeDosingRequest / outputViolatesRUO) live in ./guardrail.js
// as pure, unit-testable functions. Re-export them so existing importers of
// _shared.js keep working unchanged.
export { GUARDRAIL, RUO_REDIRECT, looksLikeDosingRequest, outputViolatesRUO };

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
