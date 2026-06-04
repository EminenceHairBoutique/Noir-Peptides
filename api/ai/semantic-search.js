/**
 * api/ai/semantic-search.js
 * Catalog + research semantic search.
 *
 * Anthropic has no first-party embeddings API, so embeddings come from Voyage AI
 * (Anthropic's recommendation) and are matched with pgvector. This is shipped
 * BEHIND A FLAG: when VOYAGE_API_KEY (or the embeddings store) is unavailable,
 * the endpoint degrades gracefully to keyword search. Populate the store with
 * scripts/embed-backfill.mjs once the provider is wired.
 */

import { supabaseServer } from "../../lib/supabaseServer.js";
import { requireUser } from "../_utils/auth.js";
import { checkRateLimit } from "../_utils/rateLimit.js";
import { readJsonBody, jsonResponse as json } from "../_utils/body.js";

const VOYAGE_MODEL = process.env.VOYAGE_MODEL || "voyage-3";

async function embedQuery(text) {
  if (!process.env.VOYAGE_API_KEY) return null;
  try {
    const res = await fetch("https://api.voyageai.com/v1/embeddings", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${process.env.VOYAGE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ input: [text], model: VOYAGE_MODEL, input_type: "query" }),
    });
    if (!res.ok) return null;
    const data = await res.json();
    return data?.data?.[0]?.embedding || null;
  } catch {
    return null;
  }
}

async function semanticSearch(embedding, limit) {
  // Requires the match_embeddings() RPC + a populated embeddings table.
  const { data, error } = await supabaseServer.rpc("match_embeddings", {
    query_embedding: embedding,
    match_count: limit,
  });
  if (error || !Array.isArray(data)) return null;
  return data.map((r) => ({
    type: r.content_type,
    ref_id: r.ref_id,
    snippet: r.content,
    score: r.similarity,
  }));
}

async function keywordSearch(query, limit) {
  const like = `%${query.replace(/[%_]/g, "")}%`;
  const results = [];

  const { data: products } = await supabaseServer
    .from("products")
    .select("slug, name, short_description")
    .or(`name.ilike.${like},description.ilike.${like},short_description.ilike.${like}`)
    .limit(limit);
  for (const p of products || []) {
    results.push({ type: "compound", ref_id: p.slug, snippet: p.short_description || p.name });
  }

  const { data: articles } = await supabaseServer
    .from("research_articles")
    .select("slug, title, summary")
    .eq("published", true)
    .or(`title.ilike.${like},summary.ilike.${like}`)
    .limit(limit);
  for (const a of articles || []) {
    results.push({ type: "article", ref_id: a.slug, snippet: a.summary || a.title });
  }

  return results.slice(0, limit);
}

export default async function handler(req, res) {
  if (req.method !== "POST") return json(res, 405, { error: "Method not allowed" });

  const allowed = await checkRateLimit(req, res, {
    endpoint: "ai-semantic-search",
    max: 30,
    windowMs: 60_000,
  });
  if (!allowed) return;

  const user = await requireUser(req, res);
  if (!user) return;

  const body = await readJsonBody(req);
  const query = String(body?.query || "").slice(0, 500).trim();
  if (!query) return json(res, 400, { error: "A search query is required." });

  const limit = Math.max(1, Math.min(20, Number(body?.limit) || 8));

  // Try semantic first; fall back to keyword on any miss.
  let results = null;
  let mode = "keyword";
  const embedding = await embedQuery(query);
  if (embedding) {
    results = await semanticSearch(embedding, limit);
    if (results) mode = "semantic";
  }
  if (!results) results = await keywordSearch(query, limit);

  return json(res, 200, { mode, results });
}
