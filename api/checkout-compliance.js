// api/checkout-compliance.js
// Persists the per-order research-use compliance record BEFORE payment
// (Stage 4). This is the legal paper trail: the three RUO certifications with
// their exact server-canonical text + version, the research entity/protocol,
// and server-captured IP / user-agent / timestamp (never trusted from the
// client). Returns { complianceId } which the payment step passes through so
// fulfillment can bind it to the created order.
//
// SERVER ENFORCEMENT: rejects the request unless the version matches and ALL
// required certifications are explicitly affirmed — the client checkboxes
// cannot be bypassed by calling this endpoint directly.
//
// Requires the order_attestations table — see
// scripts/proposed-order-attestations.sql (owner runs it).
import { supabaseServer } from "../lib/supabaseServer.js";
import { getUserFromReq } from "./_utils/auth.js";
import { checkRateLimit } from "./_utils/rateLimit.js";
import { validateBody } from "./_utils/validate.js";
import { readJsonBody, jsonResponse as json } from "./_utils/body.js";
import {
  CHECKOUT_ATTESTATION_VERSION,
  CHECKOUT_ATTESTATIONS,
  CHECKOUT_ATTESTATION_IDS,
} from "../src/config/checkoutAttestations.js";
import { RESEARCH_ENTITIES, RESEARCH_PROTOCOLS } from "../src/config/checkout.js";

const TEXT_BY_ID = Object.fromEntries(CHECKOUT_ATTESTATIONS.map((a) => [a.id, a.text]));

function clientIp(req) {
  const xff = req.headers["x-forwarded-for"];
  if (xff) return String(xff).split(",")[0].trim();
  return req.headers["x-real-ip"] || req.socket?.remoteAddress || null;
}

function affirmedIds(list) {
  const s = new Set();
  if (Array.isArray(list)) for (const x of list) if (x && x.agreed === true && typeof x.id === "string") s.add(x.id);
  return s;
}

export default async function handler(req, res) {
  if (req.method !== "POST") return json(res, 405, { error: "Method not allowed" });

  const allowed = await checkRateLimit(req, res, { endpoint: "checkout-compliance", max: 20, windowMs: 60_000 });
  if (!allowed) return;

  const body = await readJsonBody(req);
  if (!body) return json(res, 400, { error: "Invalid request" });

  // Version must match the current canonical set.
  if (String(body.attestationVersion || "") !== CHECKOUT_ATTESTATION_VERSION) {
    return json(res, 400, { error: `Stale certification version. Expected ${CHECKOUT_ATTESTATION_VERSION}.` });
  }

  // ALL three certifications required — server-enforced.
  const affirmed = affirmedIds(body.attestations);
  const missing = CHECKOUT_ATTESTATION_IDS.filter((id) => !affirmed.has(id));
  if (missing.length) return json(res, 400, { error: "All three RUO certifications are required.", missing });

  // Research entity/protocol must be from the allow-list (no free text).
  const entity = String(body.research?.entity || "");
  const protocol = String(body.research?.protocol || "");
  if (!RESEARCH_ENTITIES.includes(entity)) return json(res, 400, { error: "Invalid research entity." });
  if (!RESEARCH_PROTOCOLS.includes(protocol)) return json(res, 400, { error: "Invalid research protocol." });

  // Shape-validate the shipping snapshot (bounded; not the payment address of
  // record — the processor still collects/confirms that — but stored for the
  // order + packing).
  const { ok, errors, value } = validateBody(body.contact || {}, {
    firstName: { type: "string", required: true, max: 120 },
    lastName: { type: "string", required: true, max: 120 },
    email: { type: "string", required: true, email: true, max: 320 },
    phone: { type: "string", max: 40 },
  });
  if (!ok) return json(res, 400, { error: "Invalid contact information", details: errors });

  // Server-canonical statements (ignore any client text).
  const statements = CHECKOUT_ATTESTATION_IDS.map((id) => ({ id, text: TEXT_BY_ID[id], agreed: true }));

  const user = await getUserFromReq(req); // optional (guest seam); null when unauthenticated
  const clamp = (s, n) => (s == null ? null : String(s).slice(0, n));

  try {
    const { data, error } = await supabaseServer
      .from("order_attestations")
      .insert({
        user_id: user?.id || null,
        email: value.email.trim().toLowerCase(),
        contact_name: `${value.firstName} ${value.lastName}`.trim().slice(0, 240),
        research_entity: entity,
        research_protocol: protocol,
        shipping_method: clamp(body.shippingMethod, 40),
        shipping_address: body.shipping || null,
        billing_address: body.billing || null,
        version: CHECKOUT_ATTESTATION_VERSION,
        statements,
        ip_address: clientIp(req),
        user_agent: clamp(req.headers["user-agent"], 500),
        context: "checkout",
      })
      .select("id")
      .maybeSingle();
    if (error || !data) throw error || new Error("insert failed");
    return json(res, 200, { complianceId: data.id });
  } catch (err) {
    console.error("checkout-compliance failed:", err?.message || err);
    // Generic message — never surface the raw Postgres error to the user.
    return json(res, 500, { error: "Could not save your research-use certification. Please try again." });
  }
}
