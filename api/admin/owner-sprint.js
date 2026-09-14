// api/admin/owner-sprint.js   (opt cycle 10 — addendum C8: the Owner Sprint panel)
// GET only. One row per owner step D1–D12 from the Path-to-Ten addendum, with
// a status the server can DERIVE FROM DATA — green when the data proves the
// step, partial when some of it is there, grey when the engine cannot know
// (a GitHub setting, a dry-run, a rotation). Environment checks report
// PRESENCE only, never a value. Every probe is defensive: a missing table or
// column is a finding ("migration pending"), never a 500.
import { requireAdmin } from "../_utils/auth.js";
import { supabaseServer } from "../../lib/supabaseServer.js";
import { jsonResponse as json } from "../_utils/body.js";

const missingColumn = (e) => e && (e.code === "42703" || e.code === "42P01" || /does not exist/i.test(String(e.message || "")));

/** Column/table presence: select one row naming the column. */
async function has(table, column) {
  try {
    const { error } = await supabaseServer.from(table).select(column).limit(1);
    if (!error) return true;
    if (missingColumn(error)) return false;
    return null;
  } catch { return null; }
}
/** Exact count with an optional filter; null when the table/column is missing. */
async function countOf(table, build) {
  try {
    let q = supabaseServer.from(table).select("*", { count: "exact", head: true });
    if (build) q = build(q);
    const { count, error } = await q;
    return error ? null : count ?? 0;
  } catch { return null; }
}
/** The CLI migration ledger, when the API exposes its schema (hand-applied databases have none). */
async function ledger() {
  try {
    if (typeof supabaseServer.schema !== "function") return { available: false, versions: [] };
    const { data, error } = await supabaseServer.schema("supabase_migrations").from("schema_migrations").select("version").limit(500);
    if (error || !Array.isArray(data)) return { available: false, versions: [] };
    return { available: true, versions: data.map((r) => String(r.version)) };
  } catch { return { available: false, versions: [] }; }
}
const present = (env, name) => typeof env[name] === "string" && env[name].trim() !== "";

export async function deriveOwnerSprint(env = process.env) {
  // D2 — migrations 0031–0037, each proven by the column/table it adds.
  const probes = [
    ["0031", "coas.cas_number", await has("coas", "cas_number")],
    ["0032", "labs table", await has("labs", "id")],
    ["0033", "products.sds_file_url", await has("products", "sds_file_url")],
    ["0034", "product_categories.soft_launch_hidden", await has("product_categories", "soft_launch_hidden")],
    ["0035", "server_errors table", await has("server_errors", "id")],
    ["0036", "products.code_name", await has("products", "code_name")],
    ["0037", "coas.file_path", await has("coas", "file_path")],
    // Opt cycle 12: update-only migrations add no column — they are proven by their data.
    ["0038", "≥ 11 products with a transcribed molecular weight", (await countOf("products", (q) => q.not("molecular_weight", "is", null))) >= 11],
    ["0039", "no product left at the seeded purity 99.0", (await countOf("products", (q) => q.eq("purity_percent", 99))) === 0],
    ["0040", "profiles.loyalty_points ≥ 0 check constraint — not visible through the API; verify per docs/MIGRATIONS_0040.md", null],
  ];
  const provable = probes.filter((p) => p[2] !== null);
  const applied = provable.filter((p) => p[2] === true).map((p) => p[0]);
  const missing = provable.filter((p) => p[2] === false).map((p) => `${p[0]} (${p[1]})`);
  const unprovable = probes.filter((p) => p[2] === null).map((p) => p[0]);
  const led = await ledger();

  // D5 — certificates: published, lab-linked, CAS, file.
  const published = await countOf("coas", (q) => q.eq("is_published", true));
  const withCode = await countOf("coas", (q) => q.eq("is_published", true).not("lab_lookup_code", "is", null));
  const withCas = await countOf("coas", (q) => q.eq("is_published", true).not("cas_number", "is", null));
  const withFile = await countOf("coas", (q) => q.eq("is_published", true).not("file_url", "is", null));
  const labs = await countOf("labs");
  const labsWithTemplate = await countOf("labs", (q) => q.not("public_lookup_url_template", "is", null));

  // D5b — dry specs on record (opt cycle 11): sequence, molecular weight, CAS.
  const total = await countOf("products");
  const withSeq = await countOf("products", (q) => q.not("peptide_sequence", "is", null));
  const withMw = await countOf("products", (q) => q.not("molecular_weight", "is", null));
  const withCasP = await countOf("products", (q) => q.not("cas_number", "is", null));

  // D6 — the posture decisions that exist as data.
  const codeNamed = await countOf("products", (q) => q.not("code_name", "is", null));
  const hiddenCats = await countOf("product_categories", (q) => q.eq("soft_launch_hidden", true));

  const rows = [
    { id: "D1", title: "verify:rls on production", status: "grey", detail: "Only a run with the production keys proves this; the CI twin (DB gates) proves the script.", how: "npm run verify:rls  (RUNBOOK §1); paste the output into LAUNCH_READINESS.md" },
    { id: "D2", title: "Apply 0031–0040, decide 0027",
      status: missing.length === 0 && applied.length === provable.length ? "green" : applied.length ? "partial" : "grey",
      detail: `${applied.length}/${provable.length} proven by their columns or data${missing.length ? `; missing: ${missing.join(", ")}` : ""}${unprovable.length ? `; ${unprovable.join(", ")} not provable through the API (check per its doc)` : ""}${led.available ? `; ledger has ${led.versions.length} versions` : "; no CLI ledger (hand-applied database)"}`,
      how: "docs/MIGRATIONS_0032_0033.md · _0034.md · _0036.md · _0037.md · _0038.md · _0039.md · _0040.md; then npm run db:verify (its feature-presence section lists each migration)" },
    { id: "D3", title: "Repository private", status: "grey", detail: "A GitHub setting; not visible from here.", how: "GitHub → Settings → Danger zone → Change visibility" },
    { id: "D4", title: "Domain + VITE_SITE_URL + repo variables", status: present(env, "VITE_SITE_URL") && !/localhost/.test(env.VITE_SITE_URL) ? "partial" : "grey",
      detail: present(env, "VITE_SITE_URL") ? "VITE_SITE_URL is set at build; DNS and the PROD_URL / CANONICAL_HOST repository variables are not visible from here." : "VITE_SITE_URL is not set in this environment.",
      how: "Vercel → Domains; Vercel → Environment Variables; GitHub → Settings → Variables (PROD_URL, CANONICAL_HOST)" },
    { id: "D5", title: "Labs, lookup codes, CAS, certificate files",
      status: published == null ? "grey" : published > 0 && withCode === published && withCas === published && withFile === published && (labsWithTemplate ?? 0) > 0 ? "green" : (withCode || withCas || withFile || labs) ? "partial" : "grey",
      detail: published == null ? "coas table not readable" : `${published} published certificate(s): ${withCode ?? "?"} lab-linked, ${withCas ?? "?"} with CAS, ${withFile ?? "?"} with a file; ${labs ?? "?"} lab(s), ${labsWithTemplate ?? "?"} with a lookup template`,
      how: "Control Room → COA Manager (needs 0032): add the lab, enter the lookup code + CAS per certificate, upload the PDF" },
    { id: "D5b", title: "Dry specs on every product (sequence · MW · CAS)",
      status: total == null ? "grey" : total > 0 && withSeq === total && withMw === total && withCasP === total ? "green" : (withSeq || withMw || withCasP) ? "partial" : "grey",
      detail: total == null ? "products table not readable" : `${total} products: ${withSeq ?? "?"} with a sequence, ${withMw ?? "?"} with a molecular weight, ${withCasP ?? "?"} with a CAS. Only transcribed values — the engine never derives a spec.`,
      how: "Control Room → Catalog → Specs per product (from the supplier's document or the certificate); migration 0038 seeds the 11 verified ones" },
    { id: "D6", title: "Counsel: category posture and code names",
      status: (codeNamed ?? 0) > 0 || (hiddenCats ?? 0) > 0 ? "partial" : "grey",
      detail: `${codeNamed ?? "?"} product(s) with a code name; ${hiddenCats ?? "?"} category(ies) soft-launch hidden. The sign-off itself is recorded in LAUNCH_READINESS.md.`,
      how: "Control Room → Catalog: soft_launch_hidden per category, Code name per product" },
    { id: "D7", title: "GLP-1 pricing decision", status: "grey", detail: "Prices live in src/data/tier1Catalog.js + the 0009 seed; a decision is a code change or a stated price list.", how: "state the prices → the engine re-seeds (on conflict do update)" },
    { id: "D8", title: "BTCPay live smoke", status: ["BTCPAY_URL", "BTCPAY_API_KEY", "BTCPAY_STORE_ID", "BTCPAY_WEBHOOK_SECRET"].every((n) => present(env, n)) ? "partial" : "grey",
      detail: ["BTCPAY_URL", "BTCPAY_API_KEY", "BTCPAY_STORE_ID", "BTCPAY_WEBHOOK_SECRET"].every((n) => present(env, n)) ? "BTCPay environment is configured; one real invoice end to end is the proof." : "BTCPay environment is not configured (crypto rail off).",
      how: "docs/LAUNCH_CHECKLIST.md live smoke: one real invoice created, paid, webhook received, order visible in Orders" },
    { id: "D9", title: "Analytics posture", status: present(env, "VITE_GA_MEASUREMENT_ID") ? "partial" : "grey",
      detail: present(env, "VITE_GA_MEASUREMENT_ID") ? "GA4 measurement id is set at build (the CSP allows the analytics origins)." : "No analytics id configured: the tightened CSP is in force.",
      how: "Vercel → Environment Variables: GA4-only or none; no Meta Pixel" },
    { id: "D10", title: "iPhone walk-through", status: "grey", detail: "Screenshots are the evidence.", how: "/, /shop, a product page, cart, checkout → screenshots to owner/<date>/ on the evidence branch or an issue" },
    { id: "D11", title: "Backup / restore dry-run", status: "grey", detail: "Logged by date in LAUNCH_READINESS.md.", how: "Supabase → Backups → restore to a scratch project" },
    { id: "D12", title: "Rotate secrets (after D3)", status: "grey", detail: "Tick list in ROTATION_CHECKLIST.md.", how: "ROTATION_CHECKLIST.md" },
  ];
  return { rows, generatedAt: null };
}

export default async function handler(req, res) {
  if (req.method !== "GET") return json(res, 405, { error: "Method not allowed" });
  const admin = await requireAdmin(req, res);
  if (!admin) return;
  return json(res, 200, await deriveOwnerSprint());
}
