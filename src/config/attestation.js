// src/config/attestation.js
// Client-facing re-export of the CANONICAL attestation definition. The single
// source of truth lives in lib/attestationStatements.js so the server
// (api/attestation.js) and the client validate/render the exact same version,
// confirm phrase, and statement set. Do not fork these values here.

export {
  ATTESTATION_VERSION,
  CONFIRM_PHRASE,
  ATTESTATION_STATEMENTS,
  REQUIRED_STATEMENT_IDS,
  STATEMENT_TEXT_BY_ID,
} from "../../lib/attestationStatements.js";
