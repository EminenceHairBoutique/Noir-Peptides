// scripts/_admin-stub-supabase.mjs
// In-memory stand-in for lib/supabaseServer.js used by
// scripts/test-admin-labs.mjs. Reproduces the PostgREST builder surface the
// admin endpoints use (select/insert/update/eq/order/limit/maybeSingle/then)
// over fixture tables, plus two switches:
//   FAULTS.missingColumnsOnce — the next select naming a 0032 column fails
//                               with 42703 (pre-migration database);
//   FAULTS.missingTable       — selects on `labs` fail like a missing table.
export const FIXTURES = { coas: [], labs: [], audit_logs: [] };
export const FAULTS = {
  missingColumnsOnce: false, missingTable: false,
  // opt cycle 10 (Owner Sprint probes): "table.column" names that read as
  // 42703 and table names that read as 42P01 — a pre-migration database.
  missingColumns: [], missingTables: [],
};
export const LOG = []; // every write, for assertions
export const STORAGE = {}; // bucket → { path: byteLength } (opt cycle 10: COA uploads)

let nextId = 100;
function splitTop(expr) {
  const out = []; let depth = 0, cur = "";
  for (const ch of expr) {
    if (ch === "(") depth++;
    if (ch === ")") depth--;
    if (ch === "," && depth === 0) { out.push(cur); cur = ""; } else cur += ch;
  }
  if (cur) out.push(cur);
  return out;
}
function clausePredicate(clause) {
  const c = clause.trim();
  let m = c.match(/^and\((.*)\)$/);
  if (m) { const parts = splitTop(m[1]).map(clausePredicate); return (r) => parts.every((p) => p(r)); }
  m = c.match(/^or\((.*)\)$/);
  if (m) { const parts = splitTop(m[1]).map(clausePredicate); return (r) => parts.some((p) => p(r)); }
  m = c.match(/^([\w.]+)\.(eq|is|neq)\.(.*)$/);
  if (!m) throw new Error(`stub or(): unsupported clause "${c}"`);
  const [, col, op, raw] = m;
  const val = raw === "null" ? null : raw;
  if (op === "eq") return (r) => String(r[col]) === String(val);
  if (op === "neq") return (r) => String(r[col]) !== String(val);
  return (r) => (val === null ? r[col] == null : String(r[col]) === String(val));
}
function orPredicate(expr) { const parts = splitTop(expr).map(clausePredicate); return (r) => parts.some((p) => p(r)); }
function builder(table) {
  const filters = [];
  let mode = "select", payload = null, cols = "*", limit = null, wantCount = false;
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
      return { data: hit.map((r) => ({ ...r })), error: null };
    }
    if (FAULTS.missingTables.includes(table)) return { data: null, error: { code: "42P01", message: `relation "public.${table}" does not exist` } };
    if (mode === "select" && cols !== "*") {
      const gone = cols.split(",").map((c) => c.trim()).find((c) => FAULTS.missingColumns.includes(`${table}.${c}`));
      if (gone) return { data: null, error: { code: "42703", message: `column ${table}.${gone} does not exist` } };
    }
    let out = rows();
    if (limit != null) out = out.slice(0, limit);
    // Copies, like PostgREST: a row read before an update must not change
    // underneath the handler (the restock flip compares before/after).
    return { data: wantCount ? null : out.map((r) => ({ ...r })), error: null, count: wantCount ? rows().length : undefined };
  };
  const api = {
    select(c, opts) { if (c) cols = c; if (opts && opts.count) wantCount = true; return api; },
    not(col, op, val) { if (op === "is" && val === null) filters.push((r) => r[col] != null); return api; },
    is(col, val) { if (val === null) filters.push((r) => r[col] == null); return api; },
    insert(p) { mode = "insert"; payload = p; return api; },
    upsert(p) { mode = "upsert"; payload = p; return api; },
    update(p) { mode = "update"; payload = p; return api; },
    eq(col, val) { filters.push((r) => String(r[col]) === String(val)); return api; },
    // PostgREST `or()` filter string, the subset api/admin/catalog.js uses:
    // "a.eq.1,and(b.eq.2,c.is.null)" (opt cycle 11, restock proof).
    or(expr) { filters.push(orPredicate(expr)); return api; },
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
    async remove(paths) { for (const p of paths) delete objects[p]; LOG.push({ table: `storage:${bucket}`, op: "remove", paths }); return { data: paths.map((p) => ({ name: p })), error: null }; },
  };
}
export const supabaseServer = { from: (table) => builder(table), storage: { from: (bucket) => storageBucket(bucket) } };
