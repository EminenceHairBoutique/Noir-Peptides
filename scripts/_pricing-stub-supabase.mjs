// scripts/_pricing-stub-supabase.mjs
// In-memory stand-in for lib/supabaseServer.js, substituted at bundle time by
// scripts/test-server-pricing.mjs. It reproduces only the PostgREST builder
// surface lib/pricing.js actually uses, backed by fixture tables, so the REAL
// pricing code runs unmodified against known rows.
export const FIXTURES = {
  product_variants: [],
  price_tiers: [],
};

/** Chainable builder; filters are applied when the promise is awaited. */
function builder(table) {
  const filters = [];
  let order = null;
  let limit = null;

  const api = {
    select() {
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
    async maybeSingle() {
      const rows = api.rows();
      return { data: rows[0] || null, error: null };
    },
    then(resolve, reject) {
      return Promise.resolve({ data: api.rows(), error: null }).then(resolve, reject);
    },
  };
  return api;
}

export const supabaseServer = {
  from(table) {
    return builder(table);
  },
};
