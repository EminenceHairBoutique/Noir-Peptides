// Bundle entry for scripts/test-admin-labs.mjs (supabaseServer + auth stubbed
// by an esbuild resolve plugin). Not shipped.
export { default as coaHandler } from "../api/admin/coa.js";
export { default as labsHandler, labTemplateError, pickLabFields } from "../api/admin/labs.js";
export { FIXTURES, FAULTS, LOG } from "../lib/supabaseServer.js";
export { default as ordersHandler, loadAttestation, ATTESTATION_COLUMNS } from "../api/admin/orders.js";
export { default as catalogHandler, triggerRebuild } from "../api/admin/catalog.js";
export { default as labelConfigsHandler } from "../api/admin/labels.js";
export { default as reviewsHandler } from "../api/reviews.js";
