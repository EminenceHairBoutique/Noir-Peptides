// Bundle entry for scripts/test-back-in-stock.mjs (supabaseServer, auth,
// rate limit and lib/email.js stubbed by esbuild resolve plugins). Not shipped.
export { default as catalogHandler } from "../api/admin/catalog.js";
export { FIXTURES, FAULTS, LOG } from "../lib/supabaseServer.js";
export { EMAIL } from "../lib/email.js";
