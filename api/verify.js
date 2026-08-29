// api/verify.js
// PUBLIC batch/label verification: GET /api/verify?code=XXXXXXXXXXXXX
// The QR on every vial deep-links /v/:code, which calls this. Rate-limited;
// service-role lookup by the non-sequential verification code (label_configs
// has NO public RLS policy — this endpoint is the only public read path and
// returns a whitelisted field set only).
//
// States (never fabricated lab data):
//   verified            — label is approved/production_ready and in date
//   expired             — past expiration/retest date
//   recalled            — owner flagged the batch
//   administrative_hold — config exists but is not in a publishable status
//   not_found           — code doesn't match any label
//   unavailable         — lookup error
import { supabaseServer } from "../lib/supabaseServer.js";
import { checkRateLimit } from "./_utils/rateLimit.js";
import { jsonResponse as json } from "./_utils/body.js";
import { canRenderOutsideStudio } from "../lib/labelConstants.js";

const CROCKFORD = /^[0-9A-HJKMNP-TV-Z]{10,20}$/;

function normalizeCode(input) {
  return String(input || "")
    .toUpperCase()
    .replace(/[\s-]/g, "")
    .replace(/O/g, "0")
    .replace(/[IL]/g, "1");
}

export default async function handler(req, res) {
  if (req.method !== "GET") return json(res, 405, { error: "Method not allowed" });

  const allowed = await checkRateLimit(req, res, { endpoint: "verify", max: 30, windowMs: 60_000 });
  if (!allowed) return;

  const url = new URL(req.url, "http://x");
  const code = normalizeCode(url.searchParams.get("code"));
  if (!code || !CROCKFORD.test(code)) {
    return json(res, 200, { state: "not_found" });
  }

  try {
    const { data, error } = await supabaseServer
      .from("label_configs")
      .select(
        "display_name, quantity_label, material_type, sku, lot_number, batch_number, " +
          "packaged_date, expiration_date, retest_date, label_version, status, recalled, product_id"
      )
      .ilike("verification_code", code)
      .maybeSingle();

    if (error) return json(res, 200, { state: "unavailable" });
    if (!data) return json(res, 200, { state: "not_found" });

    // Linked PUBLISHED COA (existing public trust surface) when the lot matches.
    let coa = null;
    if (data.lot_number) {
      try {
        const { data: c } = await supabaseServer
          .from("coas")
          // Two-factor fields + the joined lab record (migration 0032), so the
          // QR view can show WHO tested it and link to the lab's own record.
          .select(
            "id, lab_name, tested_at, hplc, purity_percent, purity_operator, cas_number, " +
              "ms_confirmed, file_url, lab_lookup_code, net_peptide_content_mg, label_claim_mg, " +
              "labs ( id, name, accreditation_body, accreditation_number, public_lookup_url_template )"
          )
          .eq("is_published", true)
          .ilike("lot_number", data.lot_number)
          .maybeSingle();
        coa = c ? { ...c, lab: c.labs || null } : null;
        // Analytical panel for that certificate — rows only, never a default.
        if (coa?.id) {
          const { data: tests } = await supabaseServer
            .from("batch_tests")
            .select("id, panel_category, test_name, method_reference, result_value, result_unit, passed, sort_order")
            .eq("coa_id", coa.id)
            .order("sort_order", { ascending: true });
          coa.tests = Array.isArray(tests) ? tests : [];
        }
      } catch { coa = null; }
    }

    let state = "verified";
    if (data.recalled) state = "recalled";
    else if (!canRenderOutsideStudio(data.status)) state = "administrative_hold";
    else {
      const ref = data.expiration_date || data.retest_date;
      if (ref && new Date(`${ref}T23:59:59Z`).getTime() < Date.now()) state = "expired";
    }

    return json(res, 200, {
      state,
      label: {
        display_name: data.display_name,
        quantity_label: data.quantity_label,
        material_type: data.material_type,
        sku: data.sku,
        lot_number: data.lot_number,
        batch_number: data.batch_number,
        packaged_date: data.packaged_date,
        expiration_date: data.expiration_date,
        retest_date: data.retest_date,
        label_version: data.label_version,
        product_id: data.product_id,
      },
      coa,
      disclaimer: "For research use only. Not for human or veterinary use.",
    });
  } catch {
    return json(res, 200, { state: "unavailable" });
  }
}
