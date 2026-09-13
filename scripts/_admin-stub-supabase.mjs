// scripts/_admin-stub-supabase.mjs
// In-memory stand-in for lib/supabaseServer.js used by
// scripts/test-admin-labs.mjs. Reproduces the PostgREST builder surface the
// admin endpoints use (select/insert/update/eq/order/limit/maybeSingle/then)
// over fixture tables, plus two switches:
//   FAULTS.missingColumnsOnce — the next select naming a 0032 column fails
//                               with 42703 (pre-migration database);
//   FAULTS.missingTable       — selects on `labs` fail like a missing table.
export const FIXTURES = { coas: [], labs: [], audit_logs: [] };
export const FAULTS = { missingColumnsOnce: false, missingTable: false };
export const LOG = []; // every write, for assertions
export const STORAGE = {}; // bucket → { path: byteLength } (opt cycle 10: COA uploads)

let nextId = 100;
function builder(table) {
  const filters = [];
  let mode = "select", payload = null, cols = "*", limit = null;
  const rows = () => (FIXTURES[table] || []).filter((r) => filters.every((f) => f(r)));
  const run = () => {
    if (table === "labs" && FAULTS.missingTable) {
      return { data: null, error: { code: "42P01", message: 'relation "public.labs" does not exist' } };
    }
    if (mode === "select" && FAULTS.missingColumnsOnce && /lab_id|lab_lookup_code|purity_operator/.test(cols)) {
      FAULTS.missingColumnsOnce = false;
      return { data: null, error: { code: "42703", message: "column coas.lab_id does not exist" } };
    }
    if (mode === "upsert") {
      const row = { id: nextId++, created_at: "2026-09-13", ...payload };
      (FIXTURES[table] ||= []).push(row);
      LOG.push({ table, op: "upsert", row });
      return { data: [row], error: null };
    }
    if (mode === "insert") {
      const row = { id: nextId++, created_at: "2026-09-13", ...payload };
      (FIXTURES[table] ||= []).push(row);
      LOG.push({ table, op: "insert", row });
      return { data: [row], error: null };
    }
    if (mode === "update") {
      const hit = rows();
      for (const r of hit) Object.assign(r, payload);
      LOG.push({ table, op: "update", payload, count: hit.length });
      return { data: hit, error: null };
    }
    let out = rows();
    if (limit != null) out = out.slice(0, limit);
    return { data: out, error: null };
  };
  const api = {
    select(c) { if (c) cols = c; return api; },
    insert(p) { mode = "insert"; payload = p; return api; },
    upsert(p) { mode = "upsert"; payload = p; return api; },
    update(p) { mode = "update"; payload = p; return api; },
    eq(col, val) { filters.push((r) => String(r[col]) === String(val)); return api; },
    order() { return api; },
    limit(n) { limit = n; return api; },
    async maybeSingle() { const r = run(); return { data: r.data ? r.data[0] || null : null, error: r.error }; },
    then(resolve, reject) { return Promise.resolve(run()).then(resolve, reject); },
  };
  return api;
}
// Storage stand-in (opt cycle 10): upload() records the object, createSignedUrl()
// signs only objects that exist, remove() forgets them.
function storageBucket(bucket) {
  const objects = (STORAGE[bucket] ||= {});
  return {
    async upload(path, body, opts = {}) {
      if (objects[path] && !opts.upsert) return { data: null, error: { message: "The resource already exists", statusCode: "409" } };
      objects[path] = Buffer.isBuffer(body) ? body.length : String(body).length;
      LOG.push({ table: `storage:${bucket}`, op: "upload", path, bytes: objects[path], contentType: opts.contentType || null });
      return { data: { path }, error: null };
    },
    async createSignedUrl(path, ttl) {
      if (!objects[path]) return { data: null, error: { message: "Object not found", statusCode: "404" } };
      return { data: { signedUrl: `https://stub.supabase.co/storage/v1/object/sign/${bucket}/${path}?token=stub-${ttl}` }, error: null };
    },
    async remove(paths) { for (const p of paths) delete objects[p]; return { data: paths.map((p) => ({ name: p })), error: null }; },
  };
}
export const supabaseServer = { from: (table) => builder(table), storage: { from: (bucket) => storageBucket(bucket) } };
