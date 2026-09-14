// scripts/_pricing-stub-supabase.mjs
// In-memory stand-in for lib/supabaseServer.js, substituted at bundle time by
// scripts/test-server-pricing.mjs and scripts/test-pricing-coherence.mjs. It
// reproduces only the PostgREST builder surface lib/pricing.js, lib/rewards.js
// and lib/discounts.js actually use, backed by fixture tables, so the REAL
// pricing code runs unmodified against known rows.
export const FIXTURES = {
  product_variants: [],
  price_tiers: [],
  profiles: [],
  discounts: [],
  discount_redemptions: [],
  loyalty_ledger: [],
};

/** Every write the code under test performs, in order (for assertions). */
export const LOG = [];

/** Chainable builder; filters are applied when the promise is awaited. */
function builder(table) {
  const filters = [];
  let order = null;
  let limit = null;
  let countMode = false;
  let headOnly = false;
  let pendingUpdate = null;

  const api = {
    select(_cols, opts) {
      countMode = opts?.count === "exact";
      headOnly = Boolean(opts?.head);
      return api;
    },
    eq(col, val) {
      filters.push((r) => String(r[col]) === String(val));
      return api;
    },
    lte(col, val) {
      filters.push((r) => Number(r[col]) <= Number(val));
      return api;
    },
    order(col, opts) {
      order = { col, asc: opts?.ascending !== false };
      return api;
    },
    limit(n) {
      limit = n;
      return api;
    },
    update(patch) {
      pendingUpdate = patch;
      return api;
    },
    insert(rows) {
      const list = Array.isArray(rows) ? rows : [rows];
      for (const r of list) {
        (FIXTURES[table] ||= []).push({ id: `${table}-${FIXTURES[table].length + 1}`, ...r });
        LOG.push({ op: "insert", table, row: r });
      }
      return Promise.resolve({ data: null, error: null });
    },
    upsert(row) {
      (FIXTURES[table] ||= []).push({ ...row });
      LOG.push({ op: "upsert", table, row });
      return Promise.resolve({ data: null, error: null });
    },
    rows() {
      let rows = (FIXTURES[table] || []).filter((r) => filters.every((f) => f(r)));
      if (order) {
        rows = [...rows].sort((a, b) =>
          order.asc
            ? Number(a[order.col]) - Number(b[order.col])
            : Number(b[order.col]) - Number(a[order.col])
        );
      }
      if (limit != null) rows = rows.slice(0, limit);
      return rows;
    },
    result() {
      if (pendingUpdate) {
        const rows = api.rows();
        for (const r of rows) Object.assign(r, pendingUpdate);
        LOG.push({ op: "update", table, patch: pendingUpdate, matched: rows.length });
        return { data: null, error: null };
      }
      const rows = api.rows();
      return { data: headOnly ? null : rows, error: null, count: countMode ? rows.length : null };
    },
    async maybeSingle() {
      const rows = api.rows();
      return { data: rows[0] || null, error: null };
    },
    then(resolve, reject) {
      return Promise.resolve(api.result()).then(resolve, reject);
    },
  };
  return api;
}

export const supabaseServer = {
  from(table) {
    return builder(table);
  },
};
