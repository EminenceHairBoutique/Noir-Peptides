/*
  scripts/embed-backfill.mjs
  Ingestion / backfill job for the pgvector semantic-search store.

  Embeds compounds (products), research articles, COAs, and FAQ entries with
  Voyage AI and upserts them into public.embeddings. This is its own task with
  an explicit dependency: it is a no-op unless VOYAGE_API_KEY is set (and the
  Supabase service-role env is configured). The semantic-search endpoint
  degrades to keyword search until this has been run.

  Usage:
    VOYAGE_API_KEY=... VITE_SUPABASE_URL=... SUPABASE_SERVICE_ROLE_KEY=... \
      node scripts/embed-backfill.mjs
*/

import { createClient } from "@supabase/supabase-js";

const VOYAGE_API_KEY = process.env.VOYAGE_API_KEY;
const VOYAGE_MODEL = process.env.VOYAGE_MODEL || "voyage-3";

if (!VOYAGE_API_KEY) {
  console.error("[embed] VOYAGE_API_KEY not set — nothing to do. Skipping.");
  process.exit(0);
}
if (!process.env.VITE_SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
  console.error("[embed] Supabase service-role env not set. Aborting.");
  process.exit(1);
}

const supabase = createClient(
  process.env.VITE_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function embedBatch(texts) {
  const res = await fetch("https://api.voyageai.com/v1/embeddings", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${VOYAGE_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ input: texts, model: VOYAGE_MODEL, input_type: "document" }),
  });
  if (!res.ok) throw new Error(`Voyage error ${res.status}: ${await res.text()}`);
  const data = await res.json();
  return data.data.map((d) => d.embedding);
}

async function gatherItems() {
  const items = [];

  const { data: products } = await supabase
    .from("products")
    .select("slug, name, subtitle, description");
  for (const p of products || []) {
    items.push({
      content_type: "compound",
      ref_id: p.slug,
      content: [p.name, p.subtitle, p.description].filter(Boolean).join(". "),
    });
  }

  const { data: articles } = await supabase
    .from("research_articles")
    .select("slug, title, summary, body")
    .eq("published", true);
  for (const a of articles || []) {
    items.push({
      content_type: "article",
      ref_id: a.slug,
      content: [a.title, a.summary, a.body].filter(Boolean).join(". ").slice(0, 8000),
    });
  }

  const { data: coas } = await supabase
    .from("coas")
    .select("id, product_id, batch_number, purity_percent, hplc, mass_spec");
  for (const c of coas || []) {
    items.push({
      content_type: "coa",
      ref_id: String(c.id),
      content: `COA batch ${c.batch_number} for ${c.product_id}: purity ${c.purity_percent}%. ${c.hplc || ""} ${c.mass_spec || ""}`.trim(),
    });
  }

  return items;
}

async function main() {
  const items = await gatherItems();
  if (!items.length) {
    console.log("[embed] no items to embed.");
    return;
  }
  console.log(`[embed] embedding ${items.length} items via ${VOYAGE_MODEL}…`);

  const BATCH = 64;
  let done = 0;
  for (let i = 0; i < items.length; i += BATCH) {
    const slice = items.slice(i, i + BATCH);
    const embeddings = await embedBatch(slice.map((s) => s.content));
    const rows = slice.map((s, j) => ({ ...s, embedding: embeddings[j] }));
    const { error } = await supabase
      .from("embeddings")
      .upsert(rows, { onConflict: "content_type,ref_id" });
    if (error) throw error;
    done += rows.length;
    console.log(`[embed] upserted ${done}/${items.length}`);
  }
  console.log("[embed] done.");
}

main().catch((err) => {
  console.error("[embed] failed:", err?.message || err);
  process.exit(1);
});
