import { sendConciergeRequestEmail } from "../../lib/email.js";
import { supabaseServer } from "../../lib/supabaseServer.js";
import { failSafely, scrubSecrets } from "../../lib/apiError.js";
import { getUserFromReq } from "../_utils/auth.js";
import { readJsonBody, jsonResponse as json } from "../_utils/body.js";
import { validateBody } from "../_utils/validate.js";
import { checkRateLimit } from "../_utils/rateLimit.js";

// Field caps (opt cycle 12): the application is free text the owner reads in
// the Control Room; bound every field so a public form cannot store megabytes.
const CAPS = {
  fullName: 200,
  phone: 40,
  businessName: 200,
  websiteOrInstagram: 300,
  country: 100,
  monthlyVolume: 100,
  interestedIn: 500,
  message: 2000,
};

const warn = (what, err) => console.warn(`Partner apply: ${what}`, scrubSecrets(String(err?.message || err || "")));

export default async function handler(req, res) {
  if (req.method !== "POST") return json(res, 405, { error: "Method not allowed" });

  const allowed = await checkRateLimit(req, res, {
    endpoint: "partner-apply",
    max: 5,
    windowMs: 60_000,
  });
  if (!allowed) return;

  const body = await readJsonBody(req);
  if (!body) return json(res, 400, { error: "Invalid JSON" });

  const payload = body.payload || {};

  // Honeypot: bots fill this hidden field.
  if (payload.website && String(payload.website).trim() !== "") {
    return json(res, 200, { ok: true });
  }

  // Identity is optional (public form). A signed-in caller applies as
  // themselves: their account email is the application email, whatever the
  // form says — so a form value can never re-bind someone else's application.
  const user = await getUserFromReq(req);
  const email = String(user?.email || payload.email || "").trim().toLowerCase();

  const strings = {};
  for (const [k, max] of Object.entries(CAPS)) {
    const v = payload[k];
    strings[k] = v == null ? "" : String(v);
    if (strings[k].length > max) return json(res, 400, { error: "Invalid request", details: [`${k} must be at most ${max} characters`] });
  }
  const { ok, errors } = validateBody(
    { email, fullName: strings.fullName },
    {
      email: { type: "string", required: true, email: true, max: 320 },
      fullName: { type: "string", required: true, min: 2, max: 200 },
    }
  );
  if (!ok) return json(res, 400, { error: "Invalid request", details: errors });

  const fields = {
    full_name: strings.fullName.trim() || null,
    phone: strings.phone.trim() || null,
    business_name: strings.businessName.trim() || null,
    website_or_instagram: strings.websiteOrInstagram.trim() || null,
    country: strings.country.trim() || null,
    monthly_volume: strings.monthlyVolume.trim() || null,
    interested_in: strings.interestedIn.trim() || null,
    message: strings.message.trim() || null,
  };

  try {
    // One application per email. Never a blind upsert (opt cycle 12): an
    // existing row is refreshed only by the account it belongs to, only while
    // it is still pending, and only in its free-text fields — status, review
    // and tier are the owner's. An anonymous row can be claimed by the account
    // that owns the same (verified) email; nobody else can touch it. Whether
    // a row exists is never revealed: the response is the same either way.
    const { data: existing, error: readErr } = await supabaseServer
      .from("partner_applications")
      .select("id, user_id, status")
      .eq("email", email)
      .maybeSingle();
    if (readErr) {
      warn("lookup failed", readErr);
      return json(res, 502, { error: "Could not save the application. Please try again." });
    }

    let wrote = null; // "insert" | "update" | null
    if (!existing) {
      const { error: insErr } = await supabaseServer
        .from("partner_applications")
        .insert({ user_id: user?.id || null, email, ...fields, status: "pending" });
      if (insErr) {
        warn("insert failed", insErr);
        return json(res, 502, { error: "Could not save the application. Please try again." });
      }
      wrote = "insert";
    } else {
      const ownsRow = Boolean(user) && (existing.user_id === user.id || existing.user_id == null);
      if (ownsRow && String(existing.status || "pending") === "pending") {
        const { error: updErr } = await supabaseServer
          .from("partner_applications")
          .update({ ...fields, user_id: user.id })
          .eq("id", existing.id)
          .eq("status", "pending");
        if (updErr) {
          warn("update failed", updErr);
          return json(res, 502, { error: "Could not save the application. Please try again." });
        }
        wrote = "update";
      }
      // Otherwise: an approved/rejected application, or someone else's row —
      // nothing is written and nothing is revealed.
    }

    // The profile flips to partner_pending only for a NEW application by a
    // signed-in account that is not already an approved partner.
    if (wrote === "insert" && user?.id) {
      const { data: profile } = await supabaseServer
        .from("profiles")
        .select("partner_status")
        .eq("id", user.id)
        .maybeSingle();
      if (String(profile?.partner_status || "").toLowerCase() !== "approved") {
        const { error: profErr } = await supabaseServer
          .from("profiles")
          .update({ partner_status: "pending", account_tier: "partner_pending" })
          .eq("id", user.id);
        if (profErr) warn("profile update failed", profErr);
      }
    }

    // Best-effort notification: the application is already stored and visible
    // in the Control Room; a missing RESEND_API_KEY or a transport failure
    // must not turn a saved application into an error.
    if (wrote) {
      try {
        await sendConciergeRequestEmail({
          type: "partner_application",
          payload: {
            ...payload,
            email,
            accountId: user?.id || null,
            accountEmail: user?.email || null,
          },
        });
      } catch (mailErr) {
        warn("notification email failed", mailErr);
      }
    }

    return json(res, 200, { ok: true });
  } catch (e) {
    return failSafely(res, { status: 500, code: "partner_apply_failed", error: e, context: "partners/apply" });
  }
}
