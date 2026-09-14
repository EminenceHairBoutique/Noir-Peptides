// api/account/referral-code.js   (opt cycle 12 — scorecard 4.14)
// GET: the signed-in account's referral code, issued on demand. The account
// page used to display a code the client generated locally, which did not
// exist server-side until the account's first paid order — a friend entering
// it got nothing. lib/rewards.js ensureReferralCode is the single issuer
// (the paid-order webhook calls the same function), so the code shown is the
// code the server will honour.
import { ensureReferralCode } from "../../lib/rewards.js";
import { failSafely } from "../../lib/apiError.js";
import { requireUser } from "../_utils/auth.js";
import { jsonResponse as json } from "../_utils/body.js";
import { checkRateLimit } from "../_utils/rateLimit.js";

export default async function handler(req, res) {
  if (req.method !== "GET") return json(res, 405, { error: "Method not allowed" });
  const allowed = await checkRateLimit(req, res, { endpoint: "account-referral-code", max: 30, windowMs: 60_000 });
  if (!allowed) return;
  const user = await requireUser(req, res);
  if (!user) return;
  try {
    const code = await ensureReferralCode(user.id, user.email);
    if (!code) return json(res, 503, { error: "Referral code unavailable right now" });
    res.setHeader("Cache-Control", "private, no-store");
    return json(res, 200, { code });
  } catch (e) {
    return failSafely(res, { status: 500, code: "referral_code_failed", error: e, context: "account/referral-code" });
  }
}
