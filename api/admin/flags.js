// api/admin/flags.js   (opt cycle 10 — addendum C8: read-only feature-flag screen)
// GET only. Reports each feature flag's NAME, the surface it gates and whether
// it is on — never the raw value of any environment variable. Flags stay
// environment-controlled (Vercel → Environment Variables → redeploy); there is
// deliberately no write path here, so nothing in the Control Room can flip a
// default-off feature on.
import { requireAdmin } from "../_utils/auth.js";
import { jsonResponse as json } from "../_utils/body.js";
import { parseFlag } from "../../lib/featureFlags.js";

export const FLAG_DOCS_URL = "https://vercel.com/docs/environment-variables";

// The complete inventory: every flag lib/featureFlags.js knows, with where it acts.
export const FLAG_INVENTORY = [
  { env: "VITE_FEATURE_CALCULATOR", surface: "/calculator page (client bundle; baked at build)", scope: "client" },
  { env: "VITE_FEATURE_AI_PUBLIC", surface: "/assistant page (client bundle; baked at build)", scope: "client" },
  { env: "FEATURE_AI_PUBLIC", surface: "public AI endpoints (concierge, research assistant, summarizer, semantic search)", scope: "server" },
  { env: "VITE_FEATURE_CART_RECOVERY", surface: "saved-cart return nudge (client bundle; baked at build)", scope: "client" },
];

export function flagStates(env = process.env) {
  return FLAG_INVENTORY.map((f) => ({ ...f, on: parseFlag(env[f.env]), set: env[f.env] !== undefined && env[f.env] !== "" }));
}

export default async function handler(req, res) {
  const admin = await requireAdmin(req, res);
  if (!admin) return;
  if (req.method !== "GET") return json(res, 405, { error: "Method not allowed" });
  return json(res, 200, {
    flags: flagStates(),
    note: "Flags are environment-controlled. Change them in Vercel → Settings → Environment Variables, then redeploy; client flags (VITE_*) take effect on the next build.",
    docs: FLAG_DOCS_URL,
    readOnly: true,
  });
}
