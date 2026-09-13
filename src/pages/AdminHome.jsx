// src/pages/AdminHome.jsx — Admin Control Room
// A real admin dashboard (not a placeholder). Access is enforced BOTH client-
// side (RequireAdmin route guard) and server-side (every /api/admin/* endpoint
// calls requireAdmin). Panels: Overview (live aggregates), COA Manager (create/
// publish real batch COAs — no fabricated data), and a Compliance Scanner
// (advisory RUO copy linter). Deeper editors (orders/reviews) are surfaced with
// live counts and land in a follow-up.
import React, { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import {
  LayoutDashboard,
  FileCheck2,
  ShieldAlert,
  Package,
  Star,
  Users,
  Sparkles,
  Plus,
  RefreshCw,
  Flag,
  Bug,
  Boxes,
  ChevronDown,
  ChevronRight,
  Percent,
 ToggleLeft, ListChecks } from "lucide-react";
import SEO from "../components/SEO";
import { adminGet, adminSend, adminUpload } from "../lib/adminApi";
import { getProducts } from "../lib/catalog";
import { scanCopy } from "../lib/complianceScan";

const money = (cents) =>
  cents == null ? "—" : new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(cents / 100);
const num = (n) => (n == null ? "—" : n.toLocaleString());

const TABS = [
  { id: "overview", label: "Overview", icon: LayoutDashboard },
  { id: "catalog", label: "Catalog", icon: Boxes },
  { id: "orders", label: "Orders", icon: Package },
  { id: "reviews", label: "Reviews", icon: Star },
  { id: "partners", label: "Partners", icon: Users },
  { id: "coa", label: "COA Manager", icon: FileCheck2 },
  { id: "discounts", label: "Discounts", icon: Percent },
  { id: "flags", label: "AI Flags", icon: Flag },
  { id: "features", label: "Feature flags", icon: ToggleLeft },
  { id: "sprint", label: "Owner Sprint", icon: ListChecks },
  { id: "errors", label: "Errors", icon: Bug },
  { id: "scanner", label: "Compliance Scanner", icon: ShieldAlert },
];

const ORDER_STATUSES = ["processing", "paid", "shipped", "delivered", "canceled", "refunded"];

function StatCard({ label, value, sub, icon: Icon }) {
  return (
    <div className="glass-panel p-5">
      <div className="flex items-center justify-between mb-3">
        <span className="text-[11px] font-accent uppercase tracking-[0.16em] text-se-steel">{label}</span>
        {Icon && <Icon className="w-4 h-4 text-se-gold/70" strokeWidth={1.5} />}
      </div>
      <p className="font-display text-2xl text-se-bone">{value}</p>
      {sub && <p className="text-[12px] text-se-bone/55 font-accent mt-1">{sub}</p>}
    </div>
  );
}

/* ── Overview ─────────────────────────────────────────────────────────── */
function Overview() {
  const [data, setData] = useState(null);
  const [err, setErr] = useState(null);
  const [loading, setLoading] = useState(true);

  const load = () => {
    setLoading(true);
    adminGet("/api/admin/overview")
      .then((d) => { setData(d); setErr(null); })
      .catch((e) => setErr(e.message))
      .finally(() => setLoading(false));
  };
  useEffect(load, []);

  if (loading) return <p className="text-se-steel text-sm">Loading metrics…</p>;
  if (err) return <p className="text-red-300 text-sm">Could not load metrics: {err}</p>;

  const c = data?.catalog || {};
  const m = data?.commerce || {};
  const mod = data?.moderation || {};
  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <button onClick={load} className="inline-flex items-center gap-1.5 text-[12px] text-se-steel hover:text-se-gold">
          <RefreshCw size={13} /> Refresh
        </button>
      </div>
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard label="Paid revenue" value={money(m.revenueCents)} sub={`${num(m.ordersPaid)} paid orders`} icon={Package} />
        <StatCard label="Orders" value={num(m.orders)} sub={`${num(m.discountsActive)} active discounts`} icon={Package} />
        <StatCard label="Products" value={num(c.products)} icon={Package} />
        <StatCard label="COAs published" value={num(c.coasPublished)} sub={`${num(c.coasTotal)} total on file`} icon={FileCheck2} />
        <StatCard label="Reviews pending" value={num(mod.reviewsPending)} sub={`${num(mod.reviewsTotal)} total`} icon={Star} />
        <StatCard label="Partner apps" value={num(mod.partnersPending)} sub="pending review" icon={Users} />
        <StatCard label="Back-in-stock" value={num(mod.backInStock)} sub="subscriptions" icon={Package} />
        <StatCard label="AI conversations" value={num(data?.ai?.conversations)} icon={Sparkles} />
        <StatCard label="AI flags (open)" value={num(data?.ai?.unreviewedFlags)} sub="need review" icon={Flag} />
        <StatCard label="Client errors (open)" value={num(data?.ops?.clientErrorsOpen)} sub="production JS errors" icon={Bug} />
      </div>
      <p className="text-[12px] text-se-bone/40 font-accent">
        Deeper editors (orders fulfillment, review moderation, partner approvals) surface their
        live counts here and open in a focused view in a follow-up. Catalog + COA management is
        live below.
      </p>
    </div>
  );
}

/* ── COA Manager ──────────────────────────────────────────────────────── */
const EMPTY_COA = {
  product_id: "", lot_number: "", lab_name: "", tested_at: "",
  hplc: "", purity_percent: "", purity_operator: "", mass_spec: "", ms_confirmed: false, cas_number: "",
  lab_id: "", lab_lookup_code: "", file_url: "", is_published: true,
};

/* ── Lab linkage (opt cycle 1, H-003) ──────────────────────────────────────
   The two-factor verification key: which laboratory issued this certificate
   and the code that resolves it on the LAB'S OWN public lookup. Until now the
   only way to set these was SQL, so 0 of 19 certificates carried one. Inline,
   per row; explicit clear supported. Hidden until migration 0032 is applied. */
function LabLinkRow({ coa, labs, onSaved, onError }) {
  const [labId, setLabId] = useState(coa.lab_id ?? "");
  const [code, setCode] = useState(coa.lab_lookup_code ?? "");
  const [busy, setBusy] = useState(false);
  const lab = labs.find((l) => String(l.id) === String(labId));
  const dirty = String(labId) !== String(coa.lab_id ?? "") || code !== (coa.lab_lookup_code ?? "");
  const ready = Boolean(lab?.public_lookup_url_template && code.trim());
  const save = async () => {
    setBusy(true);
    try {
      const r = await adminSend("/api/admin/coa", "PATCH", {
        id: coa.id,
        lab_id: labId === "" ? null : Number(labId),
        lab_lookup_code: code.trim() === "" ? null : code.trim(),
      });
      onSaved(r.coa);
    } catch (e) { onError(e.message); }
    finally { setBusy(false); }
  };
  const inp = "rounded-lg border border-white/12 bg-white/[0.03] px-2 py-1 text-se-bone text-[12px] focus:border-se-gold focus:outline-none";
  return (
    <div className="mt-2 flex flex-wrap items-center gap-2" data-testid="lab-link-row">
      <select className={`${inp} bg-[#0a0e16]`} value={labId} onChange={(e) => setLabId(e.target.value)} aria-label="Issuing laboratory">
        <option value="">No lab linked</option>
        {labs.map((l) => <option key={l.id} value={l.id}>{l.name}</option>)}
      </select>
      <input className={`${inp} w-40`} placeholder="Lab lookup code" value={code} onChange={(e) => setCode(e.target.value)} aria-label="Lab lookup code" />
      <button type="button" onClick={save} disabled={!dirty || busy}
        className="text-[11px] rounded border border-se-gold/40 text-se-gold px-3 py-1 hover:bg-se-gold/10 disabled:opacity-30">
        {busy ? "Saving…" : "Save"}
      </button>
      <span className={`text-[10px] uppercase tracking-wide ${ready ? "text-emerald-300" : "text-se-steel"}`}
        title={ready ? "This certificate will render a verify-at-lab link" : "Needs a lab with a public lookup template AND a lookup code"}>
        {ready ? "verify link ready" : lab && !lab.public_lookup_url_template ? "lab has no public lookup" : "no verify link"}
      </span>
    </div>
  );
}

const EMPTY_LAB = { name: "", accreditation_body: "", accreditation_number: "", public_lookup_url_template: "" };
function LabsForm({ onCreated, onError }) {
  const [form, setForm] = useState(EMPTY_LAB);
  const [busy, setBusy] = useState(false);
  const set = (k, v) => setForm((f) => ({ ...f, [k]: v }));
  const field = "w-full rounded-lg border border-white/12 bg-white/[0.03] px-3 py-2 text-se-bone text-sm focus:border-se-gold focus:outline-none";
  const submit = async (e) => {
    e.preventDefault();
    setBusy(true);
    try {
      const r = await adminSend("/api/admin/labs", "POST", form);
      setForm(EMPTY_LAB);
      onCreated(r.lab);
    } catch (err) { onError(err.message); }
    finally { setBusy(false); }
  };
  return (
    <form onSubmit={submit} className="glass-panel p-5 space-y-3" data-testid="labs-form">
      <h3 className="font-display text-[16px]">Add a testing laboratory</h3>
      <p className="text-[12px] text-se-bone/55 font-accent">
        Real accreditation details only. The lookup template must be https and contain the literal
        <code className="mx-1 text-se-gold">{"{code}"}</code>where the lab's report code goes — otherwise no verify link is rendered.
      </p>
      <input className={field} placeholder="Laboratory name *" value={form.name} onChange={(e) => set("name", e.target.value)} required />
      <div className="grid grid-cols-2 gap-3">
        <input className={field} placeholder="Accreditation body (e.g. ISO/IEC 17025 registrar)" value={form.accreditation_body} onChange={(e) => set("accreditation_body", e.target.value)} />
        <input className={field} placeholder="Accreditation number" value={form.accreditation_number} onChange={(e) => set("accreditation_number", e.target.value)} />
      </div>
      <input className={field} placeholder="Public lookup URL template, e.g. https://lab.example/reports?id={code}" value={form.public_lookup_url_template} onChange={(e) => set("public_lookup_url_template", e.target.value)} />
      <button type="submit" disabled={busy} className="btn-outline w-full justify-center disabled:opacity-50">{busy ? "Saving…" : "Save laboratory"}</button>
    </form>
  );
}

/* ── Certificate file (migration 0037, opt cycle 10 C8) ─────────────────────
   Upload the PDF or JPEG of a certificate. The server checks the bytes (not
   the name), caps the size at 4 MB, stores the file in a private bucket and
   points the row at /api/coa-file/<id>.<ext>, which serves a 10-minute signed
   link for PUBLISHED certificates only. External links keep working. */
function CoaFileRow({ coa, onSaved, onError }) {
  const [busy, setBusy] = useState(false);
  const onPick = async (e) => {
    const input = e.target;
    const file = input.files && input.files[0];
    if (!file) return;
    setBusy(true);
    try {
      const r = await adminUpload("/api/admin/coa-upload", file, { "x-coa-id": String(coa.id) });
      onSaved(r.coa);
    } catch (err) { onError(err.message); }
    finally { setBusy(false); input.value = ""; }
  };
  return (
    <div className="flex flex-wrap items-center gap-3 text-[11px] text-se-steel" data-testid="coa-file-row">
      <span>File:</span>
      {coa.file_url ? (
        <a href={coa.file_url} target="_blank" rel="noopener noreferrer" className="text-se-gold hover:underline">
          {coa.file_path ? "stored privately (signed link)" : "external link"}
        </a>
      ) : (
        <span>none</span>
      )}
      <label className="cursor-pointer text-se-gold hover:underline">
        {busy ? "Uploading…" : "Upload PDF / JPG"}
        <input type="file" accept="application/pdf,image/jpeg" className="sr-only" onChange={onPick} disabled={busy} />
      </label>
    </div>
  );
}

/* ── Feature flags (opt cycle 10 C8) — READ-ONLY ───────────────────────────
   Shows each flag by name with its state. Flags stay environment-controlled
   (default off); nothing here can switch one on. */
function FeatureFlags() {
  const [data, setData] = useState(null);
  const [err, setErr] = useState(null);
  const load = () => adminGet("/api/admin/flags").then((d) => { setData(d); setErr(null); }).catch((e) => setErr(e.message));
  useEffect(() => { load(); }, []);
  return (
    <div className="space-y-4" data-testid="feature-flags">
      <div className="flex items-center justify-between">
        <p className="text-[11px] font-accent uppercase tracking-[0.16em] text-se-steel">Feature flags (read-only)</p>
        <button onClick={load} className="inline-flex items-center gap-1.5 text-[12px] text-se-steel hover:text-se-gold"><RefreshCw size={13} /> Refresh</button>
      </div>
      {err && <p className="text-red-300 text-sm">{err}</p>}
      {!data && !err && <p className="text-se-steel text-sm">Loading…</p>}
      {data && (
        <>
          <div className="glass-panel divide-y divide-white/5">
            {data.flags.map((f) => (
              <div key={f.env} className="flex flex-wrap items-center gap-3 p-4">
                <span className={`shrink-0 rounded-full border px-2.5 py-0.5 text-[11px] uppercase tracking-wide ${f.on ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-300" : "border-white/15 bg-white/5 text-se-steel"}`}>
                  {f.on ? "on" : "off"}
                </span>
                <span className="font-mono text-[12.5px] text-se-bone">{f.env}</span>
                <span className="text-[12px] text-se-bone/60 font-accent">{f.surface}</span>
                <span className="ml-auto text-[11px] text-se-steel">{f.scope} · {f.set ? "set" : "not set (default off)"}</span>
              </div>
            ))}
          </div>
          <p className="text-[12px] text-se-bone/55 font-accent">
            {data.note} <a href={data.docs} target="_blank" rel="noopener noreferrer" className="text-se-gold hover:underline">Vercel environment variables</a>
          </p>
        </>
      )}
    </div>
  );
}

/* ── Owner Sprint (opt cycle 10 C8) — the path from 9 to 10 ───────────────
   Mirrors §D of the Path-to-Ten addendum: one row per owner step, with the
   status the SERVER can derive from data (green / partial) and grey where
   only the owner can know. Every row carries the exact screen or command. */
const SPRINT_CHIP = {
  green: "border-emerald-500/30 bg-emerald-500/10 text-emerald-300",
  partial: "border-amber-400/30 bg-amber-400/10 text-amber-300",
  grey: "border-white/15 bg-white/5 text-se-steel",
};
function OwnerSprint() {
  const [data, setData] = useState(null);
  const [err, setErr] = useState(null);
  const load = () => adminGet("/api/admin/owner-sprint").then((d) => { setData(d); setErr(null); }).catch((e) => setErr(e.message));
  useEffect(() => { load(); }, []);
  const rows = data?.rows || [];
  const done = rows.filter((r) => r.status === "green").length;
  return (
    <div className="space-y-4" data-testid="owner-sprint">
      <div className="flex items-center justify-between">
        <p className="text-[11px] font-accent uppercase tracking-[0.16em] text-se-steel">Owner Sprint · {done}/{rows.length || 12} proven from data</p>
        <button onClick={load} className="inline-flex items-center gap-1.5 text-[12px] text-se-steel hover:text-se-gold"><RefreshCw size={13} /> Refresh</button>
      </div>
      <p className="text-[12px] text-se-bone/55 font-accent">
        Green = the database proves it. Amber = partly there. Grey = only you can know (a GitHub setting, a dry-run, a rotation) — do the step, then record it in LAUNCH_READINESS.md.
      </p>
      {err && <p className="text-red-300 text-sm">{err}</p>}
      {!data && !err && <p className="text-se-steel text-sm">Loading…</p>}
      {rows.map((r) => (
        <div key={r.id} className="glass-panel p-4 space-y-1">
          <div className="flex flex-wrap items-center gap-3">
            <span className={`shrink-0 rounded-full border px-2.5 py-0.5 text-[11px] uppercase tracking-wide ${SPRINT_CHIP[r.status] || SPRINT_CHIP.grey}`}>{r.status}</span>
            <span className="font-mono text-[12px] text-se-steel">{r.id}</span>
            <span className="text-[14px] text-se-bone">{r.title}</span>
          </div>
          <p className="text-[12.5px] text-se-bone/70">{r.detail}</p>
          <p className="text-[12px] text-se-steel font-accent">How: {r.how}</p>
        </div>
      ))}
    </div>
  );
}

function CoaManager() {
  const [coas, setCoas] = useState([]);
  const [labs, setLabs] = useState([]);
  const [labsSupported, setLabsSupported] = useState(false);
  const [products, setProducts] = useState([]);
  const [form, setForm] = useState(EMPTY_COA);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState(null);
  const [loading, setLoading] = useState(true);

  const load = () => {
    setLoading(true);
    adminGet("/api/admin/coa")
      .then((d) => { setCoas(d.coas || []); setLabsSupported(d.labFieldsSupported !== false); })
      .catch((e) => setMsg({ type: "err", text: e.message }))
      .finally(() => setLoading(false));
    // Labs: [] + migrationPending until 0032 is applied → lab controls hidden.
    adminGet("/api/admin/labs")
      .then((d) => { setLabs(d.labs || []); if (d.migrationPending) setLabsSupported(false); })
      .catch(() => {});
  };
  useEffect(() => {
    load();
    getProducts().then(setProducts).catch(() => {});
  }, []);
  const onCoaSaved = (updated) => setCoas((cs) => cs.map((c) => (c.id === updated?.id ? { ...c, ...updated } : c)));

  const nameById = useMemo(() => Object.fromEntries(products.map((p) => [p.id, p.name])), [products]);
  const set = (k, v) => setForm((f) => ({ ...f, [k]: v }));

  const submit = async (e) => {
    e.preventDefault();
    setBusy(true); setMsg(null);
    try {
      await adminSend("/api/admin/coa", "POST", form);
      setMsg({ type: "ok", text: "COA saved." });
      setForm(EMPTY_COA);
      load();
    } catch (err) {
      setMsg({ type: "err", text: err.message });
    } finally {
      setBusy(false);
    }
  };

  const togglePublish = async (coa) => {
    try {
      await adminSend("/api/admin/coa", "PATCH", { id: coa.id, is_published: !coa.is_published });
      load();
    } catch (err) {
      setMsg({ type: "err", text: err.message });
    }
  };

  const field = "w-full rounded-lg border border-white/12 bg-white/[0.03] px-3 py-2 text-se-bone text-sm focus:border-se-gold focus:outline-none";

  return (
    <div className="grid lg:grid-cols-2 gap-6">
      {/* Create form */}
      <form onSubmit={submit} className="glass-panel p-6 space-y-3 h-fit">
        <h3 className="font-display text-[16px] flex items-center gap-2"><Plus size={15} className="text-se-gold" /> Add a Certificate of Analysis</h3>
        <p className="text-[12px] text-se-bone/55 font-accent">Enter real per-batch lab values. Nothing is auto-generated.</p>

        <select className={field} value={form.product_id} onChange={(e) => set("product_id", e.target.value)} required>
          <option value="">Select product…</option>
          {products.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
        </select>
        <div className="grid grid-cols-2 gap-3">
          <input className={field} placeholder="Lot number *" value={form.lot_number} onChange={(e) => set("lot_number", e.target.value)} required />
          <input className={field} placeholder="Testing lab (e.g. Janoshik)" value={form.lab_name} onChange={(e) => set("lab_name", e.target.value)} />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <input className={field} type="date" value={form.tested_at} onChange={(e) => set("tested_at", e.target.value)} />
          <input className={field} placeholder="HPLC purity (e.g. 99.2%)" value={form.hplc} onChange={(e) => set("hplc", e.target.value)} />
          {/* W1: lot-level CAS. Server validates format + check digit and
              rejects malformed input with a 400; leave blank when unknown. */}
          <input className={field} placeholder="CAS number (optional, NNNNNNN-NN-N)" value={form.cas_number} onChange={(e) => set("cas_number", e.target.value)} />
        </div>
        {labsSupported && (
          <div className="grid grid-cols-3 gap-3" data-testid="coa-create-lab-fields">
            <select className={field} value={form.lab_id} onChange={(e) => set("lab_id", e.target.value)} aria-label="Issuing laboratory">
              <option value="">Issuing lab (optional)</option>
              {labs.map((l) => <option key={l.id} value={l.id}>{l.name}</option>)}
            </select>
            <input className={field} placeholder="Lab lookup code" value={form.lab_lookup_code} onChange={(e) => set("lab_lookup_code", e.target.value)} />
            <select className={field} value={form.purity_operator} onChange={(e) => set("purity_operator", e.target.value)} aria-label="Purity qualifier">
              <option value="">Purity is exact</option>
              <option value=">=">Purity is ≥ (at least)</option>
              <option value="<=">Purity is ≤ (at most)</option>
            </select>
          </div>
        )}
        <div className="grid grid-cols-2 gap-3">
          <input className={field} type="number" step="0.01" placeholder="Purity % (number)" value={form.purity_percent} onChange={(e) => set("purity_percent", e.target.value)} />
          <input className={field} placeholder="Mass-spec note" value={form.mass_spec} onChange={(e) => set("mass_spec", e.target.value)} />
        </div>
        <input className={field} placeholder="COA PDF URL" value={form.file_url} onChange={(e) => set("file_url", e.target.value)} />
        <div className="flex items-center gap-6 text-sm text-se-bone/70">
          <label className="flex items-center gap-2"><input type="checkbox" checked={form.ms_confirmed} onChange={(e) => set("ms_confirmed", e.target.checked)} /> MS identity confirmed</label>
          <label className="flex items-center gap-2"><input type="checkbox" checked={form.is_published} onChange={(e) => set("is_published", e.target.checked)} /> Published</label>
        </div>
        {msg && <p className={`text-[12.5px] ${msg.type === "ok" ? "text-emerald-300" : "text-red-300"}`}>{msg.text}</p>}
        <button type="submit" disabled={busy} className="btn-primary w-full justify-center disabled:opacity-50">
          {busy ? "Saving…" : "Save COA"}
        </button>
      </form>

      {/* List */}
      <div>
        <h3 className="font-display text-[16px] mb-3">On file ({coas.length})</h3>
        {loading ? (
          <p className="text-se-steel text-sm">Loading…</p>
        ) : coas.length === 0 ? (
          <div className="glass-panel p-5 text-se-bone/50 text-sm">No COAs yet. Add one to populate the public library.</div>
        ) : (
          <div className="glass-panel divide-y divide-white/5 max-h-[520px] overflow-y-auto">
            {coas.map((c) => (
              <div key={c.id} className="p-4 flex items-center justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-se-bone text-sm truncate">{nameById[c.product_id] || c.product_id}</p>
                  <p className="text-[12px] text-se-steel font-accent">
                    Lot <span className="font-mono">{c.lot_number || c.batch_number || "—"}</span>
                    {c.lab_name ? ` · ${c.lab_name}` : ""}{c.hplc ? ` · ${c.hplc}` : ""}
                  </p>
                  {labsSupported && (
                    <LabLinkRow coa={c} labs={labs} onSaved={onCoaSaved} onError={(t) => setMsg({ type: "err", text: t })} />
                  )}
                  <CoaFileRow coa={c} onSaved={onCoaSaved} onError={(t) => setMsg({ type: "err", text: t })} />
                </div>
                <button
                  onClick={() => togglePublish(c)}
                  className={`shrink-0 rounded-full border px-2.5 py-0.5 text-[11px] uppercase tracking-wide ${
                    c.is_published ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-300" : "border-white/15 bg-white/5 text-se-steel"
                  }`}
                >
                  {c.is_published ? "Published" : "Draft"}
                </button>
              </div>
            ))}
          </div>
        )}
        {labsSupported && (
          <div className="mt-6">
            <LabsForm onCreated={(lab) => setLabs((ls) => [...ls, lab].sort((a, b) => String(a.name).localeCompare(String(b.name))))} onError={(t) => setMsg({ type: "err", text: t })} />
          </div>
        )}
      </div>
    </div>
  );
}

/* ── Compliance Scanner ───────────────────────────────────────────────── */
function ComplianceScanner() {
  const [text, setText] = useState("");
  const [ai, setAi] = useState(null);
  const [aiBusy, setAiBusy] = useState(false);
  const [aiErr, setAiErr] = useState(null);
  const result = useMemo(() => (text.trim() ? scanCopy(text) : null), [text]);

  const deepScan = async () => {
    if (!text.trim()) return;
    setAiBusy(true); setAiErr(null); setAi(null);
    try {
      const r = await adminSend("/api/ai/compliance-scan", "POST", { text, deep: true });
      setAi(r.ai);
      if (r.ai && !r.ai.available) setAiErr("AI deep scan is not configured on the server. The regex scan still applies.");
      if (r.ai?.error) setAiErr(r.ai.error);
    } catch (e) {
      setAiErr(e.message);
    } finally {
      setAiBusy(false);
    }
  };

  return (
    <div className="grid lg:grid-cols-2 gap-6">
      <div className="glass-panel p-6">
        <h3 className="font-display text-[16px] mb-2">Paste copy to scan</h3>
        <p className="text-[12px] text-se-bone/55 font-accent mb-3">
          Advisory RUO linter — flags human-use, dosing/administration, and therapeutic/disease
          language before you publish. Review each flag in context (it intentionally over-flags,
          including inside negative disclaimers).
        </p>
        <textarea
          value={text}
          onChange={(e) => { setText(e.target.value); setAi(null); }}
          rows={12}
          placeholder="Paste product, research, or legal copy here…"
          className="w-full rounded-lg border border-white/12 bg-white/[0.03] px-3 py-2 text-se-bone text-sm focus:border-se-gold focus:outline-none"
        />
        <div className="mt-3 flex items-center gap-3">
          <button
            type="button"
            onClick={deepScan}
            disabled={aiBusy || !text.trim()}
            className="btn-outline disabled:opacity-50"
          >
            {aiBusy ? "Scanning…" : "Deep scan (AI)"}
          </button>
          <span className="text-[11px] text-se-bone/40 font-accent">Regex scan runs live; AI adds a subtler pass.</span>
        </div>
        {aiErr && <p className="text-[12px] text-amber-300 mt-2">{aiErr}</p>}
      </div>
      <div>
        {!result ? (
          <div className="glass-panel p-6 text-se-bone/50 text-sm">Results appear here as you type.</div>
        ) : result.clean ? (
          <div className="glass-panel p-6 border border-emerald-500/25">
            <p className="text-emerald-300 font-medium">No banned language detected.</p>
            <p className="text-[12px] text-se-bone/50 mt-1">Still requires human + attorney review for final copy.</p>
          </div>
        ) : (
          <div className="glass-panel p-4">
            <p className="text-amber-300 font-medium mb-3">{result.count} potential issue{result.count === 1 ? "" : "s"}</p>
            <div className="space-y-2 max-h-[520px] overflow-y-auto">
              {result.findings.map((f, i) => (
                <div key={i} className="rounded-lg border border-white/10 bg-white/[0.02] p-3">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-[10px] uppercase tracking-wide rounded-full bg-red-500/15 text-red-300 border border-red-500/30 px-2 py-0.5">{f.category}</span>
                    <span className="font-mono text-[12px] text-se-bone">“{f.term}”</span>
                  </div>
                  <p className="text-[12px] text-se-bone/50 font-accent">{f.context}</p>
                </div>
              ))}
            </div>
          </div>
        )}

        {ai && ai.findings && ai.findings.length > 0 && (
          <div className="glass-panel p-4 mt-4 border border-amber-500/25">
            <p className="text-amber-300 font-medium mb-2">AI flagged {ai.findings.length} phrase{ai.findings.length === 1 ? "" : "s"}</p>
            <div className="space-y-2 max-h-[300px] overflow-y-auto">
              {ai.findings.map((f, i) => (
                <div key={i} className="rounded-lg border border-white/10 bg-white/[0.02] p-3">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-[10px] uppercase tracking-wide rounded-full bg-amber-500/15 text-amber-300 border border-amber-500/30 px-2 py-0.5">{f.category || "flag"}</span>
                    <span className="font-mono text-[12px] text-se-bone">“{f.quote}”</span>
                  </div>
                  {f.why && <p className="text-[12px] text-se-bone/50 font-accent">{f.why}</p>}
                </div>
              ))}
            </div>
          </div>
        )}
        {ai && ai.available && ai.findings && ai.findings.length === 0 && !ai.error && (
          <div className="glass-panel p-4 mt-4 border border-emerald-500/20">
            <p className="text-emerald-300 text-sm">AI deep scan found no additional issues.</p>
          </div>
        )}
      </div>
    </div>
  );
}

/* ── Orders + fulfillment ─────────────────────────────────────────────── */
// Line items arrive in two shapes (Stripe lineItems / BTCPay orderItems);
// read both defensively.
const lineName = (it) => it?.name || it?.description || "Item";
const lineQty = (it) => Number(it?.quantity || 1);
const lineUnitCents = (it) => {
  if (Number.isFinite(Number(it?.unit_dollars))) return Math.round(Number(it.unit_dollars) * 100);
  if (Number.isFinite(Number(it?.price?.unit_amount))) return Number(it.price.unit_amount);
  if (Number.isFinite(Number(it?.amount_total)) && lineQty(it) > 0) return Math.round(Number(it.amount_total) / lineQty(it));
  return null;
};
const lineSku = (it) => it?.sku || it?.price?.product?.metadata?.sku || null;

function printPackingSlip(order) {
  const addr = order.shipping_address || {};
  const items = Array.isArray(order.items) ? order.items : [];
  const esc = (s) => String(s ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  const rows = items.map((it) => `
    <tr>
      <td>${esc(lineName(it))}${lineSku(it) ? ` <span class="mono">(${esc(lineSku(it))})</span>` : ""}</td>
      <td class="num">${lineQty(it)}</td>
    </tr>`).join("");
  const w = window.open("", "_blank", "width=800,height=900");
  if (!w) return;
  w.document.write(`<!doctype html><html><head><title>Packing slip ${esc(order.order_number)}</title>
    <style>
      body { font-family: Arial, sans-serif; color: #111; max-width: 640px; margin: 32px auto; }
      h1 { font-size: 18px; letter-spacing: 0.12em; } h2 { font-size: 13px; margin: 18px 0 6px; text-transform: uppercase; letter-spacing: 0.1em; color: #555; }
      table { width: 100%; border-collapse: collapse; font-size: 13px; }
      td, th { border-bottom: 1px solid #ddd; padding: 6px 4px; text-align: left; } .num { text-align: right; }
      .mono { font-family: monospace; font-size: 11px; color: #555; }
      .ruo { margin-top: 24px; border: 1.5px solid #111; padding: 10px 12px; font-size: 11.5px; font-weight: bold; }
      .meta { font-size: 12px; color: #444; } @media print { .noprint { display: none; } }
    </style></head><body>
    <h1>NOIR&nbsp;·&nbsp;PEPTIDES — PACKING SLIP</h1>
    <p class="meta">Order <strong>${esc(order.order_number)}</strong> · ${esc(new Date(order.created_at).toLocaleDateString())}</p>
    <h2>Ship to</h2>
    <p class="meta">${esc(order.customer_name || "")}<br/>${esc(addr.line1 || "")}${addr.line2 ? `<br/>${esc(addr.line2)}` : ""}<br/>
      ${esc(addr.city || "")}${addr.state ? `, ${esc(addr.state)}` : ""} ${esc(addr.postal_code || "")}<br/>${esc(addr.country || "US")}</p>
    <h2>Contents</h2>
    <table><thead><tr><th>Item</th><th class="num">Qty</th></tr></thead><tbody>${rows || '<tr><td colspan="2">—</td></tr>'}</tbody></table>
    <div class="ruo">FOR RESEARCH USE ONLY. NOT FOR HUMAN OR VETERINARY USE.<br/>
      NOT FOR DIAGNOSTIC, THERAPEUTIC, OR HOUSEHOLD USE.</div>
    <p class="meta">Batch-specific analytical documentation: noirpeptides.com/test-results · support@noirpeptides.com<br/>
      No pricing is shown on this slip by design.</p>
    <p class="noprint"><button onclick="window.print()">Print</button></p>
    </body></html>`);
  w.document.close();
}

/* Opt cycle 3 (4.11): the consent record behind an order, read-only. Shows
   exactly what is on file — version, legal name, the attested statements,
   IP, user agent, timestamp — or says there is none. Never a placeholder. */
export function AttestationRecord({ record }) {
  if (!record) {
    return (
      <p className="text-[11px] text-amber-300/90 mt-4" data-testid="attestation-none">
        No research-use attestation record is on file for this order.
      </p>
    );
  }
  const statements = Array.isArray(record.statements) ? record.statements : [];
  return (
    <div className="mt-4" data-testid="attestation-record">
      <p className="text-[11px] uppercase tracking-wide text-se-steel mb-1">Research-use attestation on file</p>
      <p className="text-[12px] text-se-bone/75 leading-relaxed">
        {record.legal_name || "—"}
        {record.version ? <span className="font-mono text-[11px] text-se-steel"> · v{record.version}</span> : null}
        {record.created_at ? <span className="text-se-steel"> · {new Date(record.created_at).toLocaleString()}</span> : null}
      </p>
      {statements.length > 0 && (
        <ol className="mt-1 list-decimal pl-4 text-[11px] text-se-bone/60 leading-relaxed space-y-0.5">
          {statements.map((st, i) => <li key={i}>{typeof st === "string" ? st : st?.text || st?.statement || JSON.stringify(st)}</li>)}
        </ol>
      )}
      <p className="mt-1 font-mono text-[10px] text-se-steel break-all">
        IP {record.ip_address || "—"} · UA {record.user_agent ? record.user_agent.slice(0, 120) : "—"}
      </p>
    </div>
  );
}

function OrderDetail({ orderNumber, onOrderChanged, onError }) {
  const [order, setOrder] = useState(null);
  const [attestation, setAttestation] = useState(null);
  const [loading, setLoading] = useState(true);
  const [tracking, setTracking] = useState({ url: "", carrier: "" });
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState(null);

  useEffect(() => {
    let alive = true;
    setLoading(true);
    adminGet(`/api/admin/orders?order=${encodeURIComponent(orderNumber)}`)
      .then((d) => {
        if (!alive) return;
        setOrder(d.order);
        setAttestation(d.attestation || null);
        setTracking({ url: d.order?.tracking_url || "", carrier: d.order?.tracking_carrier || "" });
      })
      .catch((e) => onError(e.message))
      .finally(() => alive && setLoading(false));
    return () => { alive = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [orderNumber]);

  const ship = async () => {
    setBusy(true); setMsg(null);
    try {
      await adminSend("/api/admin/order-status", "POST", {
        orderNumber,
        status: "shipped",
        trackingUrl: tracking.url.trim() || undefined,
        trackingCarrier: tracking.carrier.trim() || undefined,
      });
      setMsg("Marked shipped — customer emailed" + (tracking.url ? " with the tracking link." : "."));
      setOrder((o) => (o ? { ...o, status: "shipped", tracking_url: tracking.url, tracking_carrier: tracking.carrier } : o));
      onOrderChanged(orderNumber, "shipped");
    } catch (e) { setMsg(e.message); }
    finally { setBusy(false); }
  };

  if (loading) return <p className="p-4 text-se-steel text-[12px]">Loading order…</p>;
  if (!order) return null;

  const addr = order.shipping_address || {};
  const items = Array.isArray(order.items) ? order.items : [];
  const inp = "rounded-lg border border-white/12 bg-white/[0.03] px-2 py-1 text-se-bone text-[12px] focus:border-se-gold focus:outline-none";

  return (
    <div className="border-t border-white/5 bg-white/[0.015] p-4 grid gap-4 lg:grid-cols-[1fr_280px]">
      <div>
        <p className="text-[11px] uppercase tracking-wide text-se-steel mb-2">Contents</p>
        <div className="space-y-1">
          {items.map((it, i) => (
            <div key={i} className="flex items-center justify-between gap-3 text-[12.5px]">
              <span className="text-se-bone/85 truncate">
                {lineName(it)}
                {lineSku(it) && <span className="font-mono text-[11px] text-se-steel"> · {lineSku(it)}</span>}
              </span>
              <span className="shrink-0 text-se-bone/60">
                ×{lineQty(it)}{lineUnitCents(it) != null ? ` · ${money(lineUnitCents(it))} ea` : ""}
              </span>
            </div>
          ))}
          {!items.length && <p className="text-se-bone/40 text-[12px]">No line-item snapshot on this order.</p>}
        </div>
        <p className="text-[11px] uppercase tracking-wide text-se-steel mt-4 mb-1">Ship to</p>
        <p className="text-[12.5px] text-se-bone/75 leading-relaxed">
          {order.customer_name}<br />
          {addr.line1}{addr.line2 ? <><br />{addr.line2}</> : null}<br />
          {addr.city}{addr.state ? `, ${addr.state}` : ""} {addr.postal_code}<br />
          {addr.country || "US"}
        </p>
        {order.shipped_at && (
          <p className="text-[11px] text-se-steel mt-2">Shipped {new Date(order.shipped_at).toLocaleString()}</p>
        )}
        <AttestationRecord record={attestation} />
      </div>
      <div className="space-y-2">
        <p className="text-[11px] uppercase tracking-wide text-se-steel">Ship & track</p>
        <input className={`${inp} w-full`} placeholder="https:// tracking link" value={tracking.url}
          onChange={(e) => setTracking((t) => ({ ...t, url: e.target.value }))} />
        <input className={`${inp} w-full`} placeholder="Carrier (USPS, UPS…)" value={tracking.carrier}
          onChange={(e) => setTracking((t) => ({ ...t, carrier: e.target.value }))} />
        <button onClick={ship} disabled={busy}
          className="btn-primary w-full justify-center text-[12px] disabled:opacity-50">
          {busy ? "Saving…" : "Mark shipped + email customer"}
        </button>
        <button onClick={() => printPackingSlip(order)} className="btn-outline w-full justify-center text-[12px]">
          Print packing slip
        </button>
        {order.tracking_url && (
          <a href={order.tracking_url} target="_blank" rel="noreferrer" className="block text-[11px] text-se-gold hover:underline truncate">
            Current tracking link ↗
          </a>
        )}
        {msg && <p className="text-[12px] text-emerald-300">{msg}</p>}
      </div>
    </div>
  );
}

function OrdersManager() {
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState(null);
  const [savingId, setSavingId] = useState(null);
  const [openOrder, setOpenOrder] = useState(null);

  const load = () => {
    setLoading(true);
    adminGet("/api/admin/orders")
      .then((d) => { setOrders(d.orders || []); setErr(null); })
      .catch((e) => setErr(e.message))
      .finally(() => setLoading(false));
  };
  useEffect(load, []);

  const changeStatus = async (orderNumber, status) => {
    setSavingId(orderNumber);
    setErr(null);
    try {
      await adminSend("/api/admin/order-status", "POST", { orderNumber, status });
      setOrders((os) => os.map((o) => (o.order_number === orderNumber ? { ...o, status } : o)));
    } catch (e) {
      setErr(e.message);
    } finally {
      setSavingId(null);
    }
  };

  if (loading) return <p className="text-se-steel text-sm">Loading orders…</p>;
  if (err && !orders.length) return <p className="text-red-300 text-sm">{err}</p>;
  if (!orders.length) return <div className="glass-panel p-6 text-se-bone/50 text-sm">No orders yet.</div>;

  const sel = "rounded-lg border border-white/12 bg-[#0a0e16] px-2 py-1 text-se-bone text-[12px] focus:border-se-gold focus:outline-none";
  return (
    <div className="space-y-3">
      {err && <p className="text-red-300 text-sm">{err}</p>}
      <p className="text-[12px] text-se-bone/55 font-accent">
        Click an order number for contents, shipping address, tracking entry, and a printable
        packing slip. Status changes email the customer. Newest first (last 100).
      </p>
      <div className="glass-panel overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-[11px] uppercase tracking-wide text-se-steel">
              <th className="p-3">Order</th><th className="p-3">Customer</th><th className="p-3">Total</th>
              <th className="p-3">Rail</th><th className="p-3">Date</th><th className="p-3">Status</th>
            </tr>
          </thead>
          <tbody>
            {orders.map((o) => (
              <React.Fragment key={o.order_number}>
                <tr className="border-t border-white/5">
                  <td className="p-3">
                    <button
                      onClick={() => setOpenOrder(openOrder === o.order_number ? null : o.order_number)}
                      className="font-mono text-[12px] text-se-gold hover:underline"
                    >
                      {o.order_number}
                    </button>
                    {o.tracking_url && <span className="ml-1.5 text-[10px] text-cyan-300" title="Tracking on file">⛟</span>}
                  </td>
                  <td className="p-3 text-se-bone/70">{o.customer_name || o.email || "—"}</td>
                  <td className="p-3 text-se-bone/80">{money(o.amount_total)}</td>
                  <td className="p-3 text-se-bone/50">{o.payment_provider || "—"}</td>
                  <td className="p-3 text-se-steel text-[12px]">{new Date(o.created_at).toLocaleDateString()}</td>
                  <td className="p-3">
                    <select
                      className={sel}
                      value={o.status || "processing"}
                      disabled={savingId === o.order_number}
                      onChange={(e) => changeStatus(o.order_number, e.target.value)}
                    >
                      {ORDER_STATUSES.map((s) => <option key={s} value={s}>{s}</option>)}
                    </select>
                  </td>
                </tr>
                {openOrder === o.order_number && (
                  <tr>
                    <td colSpan={6} className="p-0">
                      <OrderDetail
                        orderNumber={o.order_number}
                        onOrderChanged={(num, status) =>
                          setOrders((os) => os.map((x) => (x.order_number === num ? { ...x, status } : x)))}
                        onError={setErr}
                      />
                    </td>
                  </tr>
                )}
              </React.Fragment>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

/* ── Review moderation ────────────────────────────────────────────────── */
function ReviewsManager() {
  const [reviews, setReviews] = useState([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState(null);

  const load = () => {
    setLoading(true);
    adminGet("/api/admin/reviews")
      .then((d) => { setReviews(d.reviews || []); setErr(null); })
      .catch((e) => setErr(e.message))
      .finally(() => setLoading(false));
  };
  useEffect(load, []);

  const setStatus = async (id, status) => {
    try {
      await adminSend("/api/admin/reviews", "PATCH", { id, status });
      setReviews((rs) => rs.map((r) => (r.id === id ? { ...r, status } : r)));
    } catch (e) { setErr(e.message); }
  };

  if (loading) return <p className="text-se-steel text-sm">Loading reviews…</p>;
  if (err && !reviews.length) return <p className="text-red-300 text-sm">{err}</p>;
  if (!reviews.length) return <div className="glass-panel p-6 text-se-bone/50 text-sm">No reviews yet.</div>;

  return (
    <div className="space-y-3">
      {err && <p className="text-red-300 text-sm">{err}</p>}
      {reviews.map((r) => (
        <div key={r.id} className={`glass-panel p-4 ${r.status === "hidden" ? "opacity-60" : ""}`}>
          <div className="flex items-center justify-between gap-3 mb-1">
            <div className="flex items-center gap-2 text-[12px]">
              <span className="text-se-gold">{"★".repeat(Math.max(0, Math.min(5, Number(r.rating) || 0)))}</span>
              <span className="text-se-steel">{r.product_id}{r.aspect ? ` · ${r.aspect}` : ""}</span>
              {r.verified_purchase && <span className="text-emerald-300/80 text-[10px] uppercase">verified</span>}
            </div>
            <button
              onClick={() => setStatus(r.id, r.status === "hidden" ? "published" : "hidden")}
              className={`text-[11px] ${r.status === "hidden" ? "text-emerald-300" : "text-amber-300"} hover:underline`}
            >
              {r.status === "hidden" ? "Unhide" : "Hide"}
            </button>
          </div>
          {r.title && <p className="text-se-bone text-sm font-medium">{r.title}</p>}
          <p className="text-[12.5px] text-se-bone/60 font-accent">{r.body}</p>
        </div>
      ))}
    </div>
  );
}

/* ── Partner approvals ────────────────────────────────────────────────── */
function Partners() {
  const [apps, setApps] = useState([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState(null);
  const [busyId, setBusyId] = useState(null);

  const load = () => {
    setLoading(true);
    adminGet("/api/admin/partner-applications")
      .then((d) => { setApps(d.applications || []); setErr(null); })
      .catch((e) => setErr(e.message))
      .finally(() => setLoading(false));
  };
  useEffect(load, []);

  const act = async (id, action) => {
    setBusyId(id); setErr(null);
    try {
      await adminSend("/api/admin/partner-application-update", "POST", { applicationId: id, action });
      setApps((a) => a.map((x) => (x.id === id ? { ...x, status: action === "approve" ? "approved" : "rejected" } : x)));
    } catch (e) { setErr(e.message); }
    finally { setBusyId(null); }
  };

  if (loading) return <p className="text-se-steel text-sm">Loading applications…</p>;
  if (err && !apps.length) return <p className="text-red-300 text-sm">{err}</p>;
  if (!apps.length) return <div className="glass-panel p-6 text-se-bone/50 text-sm">No partner applications.</div>;

  const badge = (s) =>
    s === "approved" ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-300"
    : s === "rejected" ? "border-red-500/30 bg-red-500/10 text-red-300"
    : "border-amber-500/30 bg-amber-500/10 text-amber-300";

  return (
    <div className="space-y-3">
      {err && <p className="text-red-300 text-sm">{err}</p>}
      {apps.map((a) => (
        <div key={a.id} className="glass-panel p-4">
          <div className="flex items-center justify-between gap-3 mb-1">
            <div className="min-w-0">
              <p className="text-se-bone text-sm">{a.business_name || a.full_name || a.email}</p>
              <p className="text-[12px] text-se-steel font-accent truncate">
                {a.email}{a.country ? ` · ${a.country}` : ""}{a.monthly_volume ? ` · ${a.monthly_volume}` : ""}
              </p>
            </div>
            <span className={`shrink-0 rounded-full border px-2.5 py-0.5 text-[11px] uppercase tracking-wide ${badge(a.status)}`}>{a.status || "pending"}</span>
          </div>
          {a.message && <p className="text-[12.5px] text-se-bone/60 font-accent mb-2">{a.message}</p>}
          {a.status !== "approved" && a.status !== "rejected" && (
            <div className="flex gap-2">
              <button onClick={() => act(a.id, "approve")} disabled={busyId === a.id} className="text-[11px] rounded border border-emerald-500/30 text-emerald-300 px-3 py-1 hover:bg-emerald-500/10 disabled:opacity-40">Approve</button>
              <button onClick={() => act(a.id, "reject")} disabled={busyId === a.id} className="text-[11px] rounded border border-red-500/30 text-red-300 px-3 py-1 hover:bg-red-500/10 disabled:opacity-40">Reject</button>
            </div>
          )}
        </div>
      ))}
    </div>
  );
}

/* ── Discounts manager ────────────────────────────────────────────────── */
const EMPTY_DISCOUNT = {
  code: "", kind: "percent", value: "", description: "",
  min_subtotal: "", max_redemptions: "", per_user_limit: "1",
  excludes_bundles: true, is_public: false, active: true,
};

function DiscountsManager() {
  const [discounts, setDiscounts] = useState([]);
  const [form, setForm] = useState(EMPTY_DISCOUNT);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState(null);

  const load = () => {
    setLoading(true);
    adminGet("/api/admin/discounts")
      .then((d) => { setDiscounts(d.discounts || []); setMsg(null); })
      .catch((e) => setMsg({ type: "err", text: e.message }))
      .finally(() => setLoading(false));
  };
  useEffect(load, []);

  const set = (k, v) => setForm((f) => ({ ...f, [k]: v }));

  const submit = async (e) => {
    e.preventDefault();
    setBusy(true); setMsg(null);
    try {
      const r = await adminSend("/api/admin/discounts", "POST", {
        code: form.code,
        kind: form.kind,
        value: Number(form.value),
        description: form.description || undefined,
        min_subtotal: form.min_subtotal === "" ? undefined : Number(form.min_subtotal),
        max_redemptions: form.max_redemptions === "" ? null : Number(form.max_redemptions),
        per_user_limit: form.per_user_limit === "" ? null : Number(form.per_user_limit),
        excludes_bundles: form.excludes_bundles,
        is_public: form.is_public,
        active: form.active,
      });
      setDiscounts((ds) => [r.discount, ...ds]);
      setForm(EMPTY_DISCOUNT);
      setMsg({ type: "ok", text: `Code ${r.discount.code} created.` });
    } catch (err2) {
      setMsg({ type: "err", text: err2.message });
    } finally {
      setBusy(false);
    }
  };

  const toggleActive = async (d) => {
    try {
      const r = await adminSend("/api/admin/discounts", "PATCH", { id: d.id, active: !d.active });
      setDiscounts((ds) => ds.map((x) => (x.id === d.id ? { ...x, ...r.discount } : x)));
    } catch (e) { setMsg({ type: "err", text: e.message }); }
  };

  const field = "w-full rounded-lg border border-white/12 bg-white/[0.03] px-3 py-2 text-se-bone text-sm focus:border-se-gold focus:outline-none";
  const describe = (d) =>
    d.kind === "percent" ? `${Number(d.value)}% off` : `$${Number(d.value).toFixed(2)} off`;

  return (
    <div className="grid lg:grid-cols-2 gap-6">
      <form onSubmit={submit} className="glass-panel p-6 space-y-3 h-fit">
        <h3 className="font-display text-[16px] flex items-center gap-2"><Plus size={15} className="text-se-gold" /> New promo code</h3>
        <p className="text-[12px] text-se-bone/55 font-accent">
          Checkout validates codes server-side; totals are always re-priced on the server.
        </p>
        <div className="grid grid-cols-2 gap-3">
          <input className={`${field} font-mono uppercase`} placeholder="CODE *" value={form.code}
            onChange={(e) => set("code", e.target.value.toUpperCase())} required maxLength={32} />
          <select className={field} value={form.kind} onChange={(e) => set("kind", e.target.value)}>
            <option value="percent">Percent off</option>
            <option value="fixed">Fixed $ off</option>
          </select>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <input className={field} type="number" step="0.01" min="0.01"
            max={form.kind === "percent" ? 100 : 10000}
            placeholder={form.kind === "percent" ? "Value % *" : "Value $ *"}
            value={form.value} onChange={(e) => set("value", e.target.value)} required />
          <input className={field} type="number" step="0.01" min="0" placeholder="Min subtotal $"
            value={form.min_subtotal} onChange={(e) => set("min_subtotal", e.target.value)} />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <input className={field} type="number" step="1" min="1" placeholder="Max uses (blank = ∞)"
            value={form.max_redemptions} onChange={(e) => set("max_redemptions", e.target.value)} />
          <input className={field} type="number" step="1" min="1" placeholder="Per-user limit (blank = ∞)"
            value={form.per_user_limit} onChange={(e) => set("per_user_limit", e.target.value)} />
        </div>
        <input className={field} placeholder="Internal description" value={form.description}
          onChange={(e) => set("description", e.target.value)} maxLength={300} />
        <div className="flex flex-wrap items-center gap-x-5 gap-y-2 text-[12.5px] text-se-bone/70">
          <label className="flex items-center gap-2"><input type="checkbox" checked={form.excludes_bundles} onChange={(e) => set("excludes_bundles", e.target.checked)} /> Exclude blends/kits</label>
          <label className="flex items-center gap-2"><input type="checkbox" checked={form.is_public} onChange={(e) => set("is_public", e.target.checked)} /> Show on Deals page</label>
          <label className="flex items-center gap-2"><input type="checkbox" checked={form.active} onChange={(e) => set("active", e.target.checked)} /> Active</label>
        </div>
        {msg && <p className={`text-[12.5px] ${msg.type === "ok" ? "text-emerald-300" : "text-red-300"}`}>{msg.text}</p>}
        <button type="submit" disabled={busy} className="btn-primary w-full justify-center disabled:opacity-50">
          {busy ? "Creating…" : "Create Code"}
        </button>
      </form>

      <div>
        <h3 className="font-display text-[16px] mb-3">Codes ({discounts.length})</h3>
        {loading ? (
          <p className="text-se-steel text-sm">Loading…</p>
        ) : discounts.length === 0 ? (
          <div className="glass-panel p-5 text-se-bone/50 text-sm">No promo codes yet.</div>
        ) : (
          <div className="glass-panel divide-y divide-white/5 max-h-[560px] overflow-y-auto">
            {discounts.map((d) => (
              <div key={d.id} className={`p-4 flex items-center justify-between gap-3 ${d.active ? "" : "opacity-50"}`}>
                <div className="min-w-0">
                  <p className="text-se-bone text-sm font-mono truncate">{d.code}</p>
                  <p className="text-[12px] text-se-steel font-accent">
                    {describe(d)}
                    {Number(d.min_subtotal) > 0 ? ` · min $${Number(d.min_subtotal)}` : ""}
                    {` · used ${d.redemption_count}${d.max_redemptions ? `/${d.max_redemptions}` : ""}`}
                    {d.is_public ? " · public" : ""}
                  </p>
                  {d.description && <p className="text-[11px] text-se-bone/40 font-accent truncate">{d.description}</p>}
                </div>
                <button
                  onClick={() => toggleActive(d)}
                  className={`shrink-0 rounded-full border px-2.5 py-0.5 text-[11px] uppercase tracking-wide ${
                    d.active ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-300" : "border-white/15 bg-white/5 text-se-steel"
                  }`}
                >
                  {d.active ? "Active" : "Off"}
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

/* ── AI safety queue ──────────────────────────────────────────────────── */
function AiFlags() {
  const [flags, setFlags] = useState([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState(null);

  const load = () => {
    setLoading(true);
    adminGet("/api/admin/ai-flags")
      .then((d) => { setFlags(d.flags || []); setErr(null); })
      .catch((e) => setErr(e.message))
      .finally(() => setLoading(false));
  };
  useEffect(load, []);

  const markReviewed = async (id) => {
    try { await adminSend("/api/admin/ai-flags", "PATCH", { id, reviewed: true }); load(); }
    catch (e) { setErr(e.message); }
  };

  if (loading) return <p className="text-se-steel text-sm">Loading AI safety queue…</p>;
  if (err) return <p className="text-red-300 text-sm">{err}</p>;
  if (!flags.length) return <div className="glass-panel p-6 text-se-bone/50 text-sm">No AI safety flags. Refusals and blocked outputs will appear here.</div>;

  return (
    <div className="space-y-3">
      <p className="text-[12px] text-se-bone/55 font-accent">
        Every refusal (dosing/administration request) and every blocked output-drift is logged here.
      </p>
      {flags.map((f) => (
        <div key={f.id} className={`glass-panel p-4 ${f.reviewed ? "opacity-60" : ""}`}>
          <div className="flex items-center justify-between gap-3 mb-2">
            <div className="flex items-center gap-2">
              <span className={`text-[10px] uppercase tracking-wide rounded-full px-2 py-0.5 border ${f.kind === "flag" ? "border-red-500/30 bg-red-500/10 text-red-300" : "border-amber-500/30 bg-amber-500/10 text-amber-300"}`}>{f.kind}</span>
              <span className="text-[11px] text-se-steel font-accent">{f.feature || "ai"} · {new Date(f.created_at).toLocaleString()}</span>
            </div>
            {!f.reviewed && <button onClick={() => markReviewed(f.id)} className="text-[11px] text-se-gold hover:underline">Mark reviewed</button>}
          </div>
          <p className="text-[12.5px] text-se-bone/80 font-accent"><span className="text-se-steel">Prompt:</span> {f.prompt}</p>
          {f.reply && <p className="text-[12px] text-se-bone/50 font-accent mt-1"><span className="text-se-steel">Served:</span> {f.reply}</p>}
        </div>
      ))}
    </div>
  );
}

/* ── Catalog manager ──────────────────────────────────────────────────── */
const STOCK_OPTIONS = ["in_stock", "low_stock", "out_of_stock"];
const stockBadge = (s) =>
  s === "in_stock" ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-300"
  : s === "low_stock" ? "border-amber-500/30 bg-amber-500/10 text-amber-300"
  : "border-red-500/30 bg-red-500/10 text-red-300";

function CatalogRow({ kind, row, waitCount, onSaved, onError }) {
  const [edit, setEdit] = useState(() => ({
    price: row.price ?? "",
    stock_status: row.stock_status || "in_stock",
    featured: Boolean(row.featured),
    is_new: Boolean(row.is_new),
    inventory_count: row.inventory_count ?? "",
  }));
  const [busy, setBusy] = useState(false);
  // Blank inventory = untracked (manual stock); a number = tracked (derived).
  const tracked = kind === "variant" && edit.inventory_count !== "";
  const dirty =
    Number(edit.price) !== Number(row.price ?? 0) ||
    edit.stock_status !== (row.stock_status || "in_stock") ||
    (kind === "product" && (edit.featured !== Boolean(row.featured) || edit.is_new !== Boolean(row.is_new))) ||
    (kind === "variant" && String(edit.inventory_count) !== String(row.inventory_count ?? ""));

  const save = async () => {
    setBusy(true);
    try {
      const payload = { kind, id: row.id, price: Number(edit.price), stock_status: edit.stock_status };
      if (kind === "product") { payload.featured = edit.featured; payload.is_new = edit.is_new; }
      if (kind === "variant") {
        payload.inventory_count = edit.inventory_count === "" ? null : Number(edit.inventory_count);
      }
      const r = await adminSend("/api/admin/catalog", "PATCH", payload);
      onSaved(kind, r[kind], r.restock);
      if (kind === "variant") {
        setEdit((s) => ({ ...s, stock_status: r[kind]?.stock_status || s.stock_status }));
      }
    } catch (e) { onError(e.message); }
    finally { setBusy(false); }
  };

  const sel = "rounded-lg border border-white/12 bg-[#0a0e16] px-2 py-1 text-se-bone text-[12px] focus:border-se-gold focus:outline-none";
  const num = "w-24 rounded-lg border border-white/12 bg-white/[0.03] px-2 py-1 text-se-bone text-[12px] focus:border-se-gold focus:outline-none";

  return (
    <div className={`flex flex-wrap items-center gap-3 py-2 ${kind === "variant" ? "pl-8" : ""}`}>
      <div className="min-w-0 flex-1">
        <p className="text-[13px] text-se-bone truncate">
          {kind === "product" ? row.name : (row.size_label || `${row.vial_size_mg} mg`)}
          {kind === "variant" && row.sku && <span className="text-se-steel font-mono text-[11px]"> · {row.sku}</span>}
          {waitCount > 0 && (
            <span className="ml-2 text-[10px] uppercase tracking-wide rounded-full border border-cyan-500/30 bg-cyan-500/10 text-cyan-300 px-2 py-0.5">
              {waitCount} waiting
            </span>
          )}
        </p>
      </div>
      <label className="flex items-center gap-1 text-[11px] text-se-steel">
        $<input type="number" min="0" step="0.01" className={num} value={edit.price}
          onChange={(e) => setEdit((s) => ({ ...s, price: e.target.value }))} />
      </label>
      {kind === "variant" && (
        <label className="flex items-center gap-1 text-[11px] text-se-steel" title="Blank = untracked (manual stock). A number = tracked: paid orders decrement it and stock status derives from the count.">
          inv
          <input type="number" min="0" step="1" placeholder="∞" className={num} value={edit.inventory_count}
            onChange={(e) => setEdit((s) => ({ ...s, inventory_count: e.target.value }))} />
        </label>
      )}
      <select className={sel} value={edit.stock_status} disabled={tracked}
        title={tracked ? "Derived from inventory count while tracked" : undefined}
        onChange={(e) => setEdit((s) => ({ ...s, stock_status: e.target.value }))}>
        {STOCK_OPTIONS.map((s) => <option key={s} value={s}>{s.replace(/_/g, " ")}</option>)}
      </select>
      {kind === "product" && (
        <>
          <label className="flex items-center gap-1.5 text-[11px] text-se-bone/60">
            <input type="checkbox" checked={edit.featured}
              onChange={(e) => setEdit((s) => ({ ...s, featured: e.target.checked }))} /> featured
          </label>
          <label className="flex items-center gap-1.5 text-[11px] text-se-bone/60">
            <input type="checkbox" checked={edit.is_new}
              onChange={(e) => setEdit((s) => ({ ...s, is_new: e.target.checked }))} /> new
          </label>
        </>
      )}
      <span className={`shrink-0 rounded-full border px-2 py-0.5 text-[10px] uppercase tracking-wide ${stockBadge(row.stock_status)}`}>
        {(row.stock_status || "in_stock").replace(/_/g, " ")}
      </span>
      <button onClick={save} disabled={!dirty || busy}
        className="text-[11px] rounded border border-se-gold/40 text-se-gold px-3 py-1 hover:bg-se-gold/10 disabled:opacity-30">
        {busy ? "Saving…" : "Save"}
      </button>
    </div>
  );
}

/* ── SDS + product type (migration 0033) ─────────────────────────────────
   Shown under an expanded product. Deliberately separate from CatalogRow: the
   SDS URL is a controlled document reference, not a day-to-day price edit, and
   it is product-only.

   The server validates the URL (absolute https) and the date shape; this form
   only keeps the owner from having to guess the format. Clearing the URL is a
   supported action — a withdrawn sheet must be removable, and a blank field
   makes the product render as having no SDS rather than keeping a dead link.

   Hidden entirely when the API did not return the 0033 columns (migration
   still pending), so the form can never post a field the database lacks. */
function SdsRow({ row, onSaved, onError }) {
  const supported = "sds_file_url" in row;
  const [edit, setEdit] = useState(() => ({
    sds_file_url: row.sds_file_url ?? "",
    sds_updated_at: row.sds_updated_at ? String(row.sds_updated_at).slice(0, 10) : "",
    product_type: row.product_type || "peptide",
  }));
  const [busy, setBusy] = useState(false);
  if (!supported) return null;

  const dirty =
    edit.sds_file_url !== (row.sds_file_url ?? "") ||
    edit.sds_updated_at !== (row.sds_updated_at ? String(row.sds_updated_at).slice(0, 10) : "") ||
    edit.product_type !== (row.product_type || "peptide");

  const save = async () => {
    setBusy(true);
    try {
      const r = await adminSend("/api/admin/catalog", "PATCH", {
        kind: "product",
        id: row.id,
        // "" is meaningful: it clears the field server-side.
        sds_file_url: edit.sds_file_url.trim(),
        sds_updated_at: edit.sds_updated_at,
        product_type: edit.product_type,
      });
      onSaved("product", r.product, null);
    } catch (e) { onError(e.message); }
    finally { setBusy(false); }
  };

  const inp = "rounded-lg border border-white/12 bg-white/[0.03] px-2 py-1 text-se-bone text-[12px] focus:border-se-gold focus:outline-none";
  const sel = "rounded-lg border border-white/12 bg-[#0a0e16] px-2 py-1 text-se-bone text-[12px] focus:border-se-gold focus:outline-none";

  return (
    <div className="flex flex-wrap items-center gap-3 py-2 pl-8 border-t border-white/5">
      <span className="text-[11px] uppercase tracking-wide text-se-steel shrink-0">SDS</span>
      <input
        type="url"
        inputMode="url"
        placeholder="https://… (blank = no sheet published)"
        className={`${inp} flex-1 min-w-[220px]`}
        value={edit.sds_file_url}
        onChange={(e) => setEdit((st) => ({ ...st, sds_file_url: e.target.value }))}
      />
      <label className="flex items-center gap-1 text-[11px] text-se-steel" title="Revision date printed on the sheet">
        revised
        <input type="date" className={inp} value={edit.sds_updated_at}
          onChange={(e) => setEdit((st) => ({ ...st, sds_updated_at: e.target.value }))} />
      </label>
      <label className="flex items-center gap-1 text-[11px] text-se-steel" title="Lab supplies are offered as consumables in the cart">
        type
        <select className={sel} value={edit.product_type}
          onChange={(e) => setEdit((st) => ({ ...st, product_type: e.target.value }))}>
          <option value="peptide">peptide</option>
          <option value="lab_supply">lab supply</option>
        </select>
      </label>
      <button onClick={save} disabled={!dirty || busy}
        className="text-[11px] rounded border border-se-gold/40 text-se-gold px-3 py-1 hover:bg-se-gold/10 disabled:opacity-30">
        {busy ? "Saving…" : "Save"}
      </button>
    </div>
  );
}

/* ── Storefront code name (migration 0036, opt cycle 9 C7) ───────────────
   Optional. When set, the shop, the product page, the cart and the checkout
   summary show it instead of the substance name; certificates, safety data
   sheets and order records keep the substance name. The code-name option
   counsel raised is therefore a data entry here, not a deploy. The server
   holds the text to the public-copy rules and an empty value clears it.
   Hidden until the API returns the 0036 column. */
function CodeNameRow({ row, onSaved, onError }) {
  const supported = "code_name" in row;
  const [edit, setEdit] = useState(row.code_name ?? "");
  const [busy, setBusy] = useState(false);
  if (!supported) return null;
  const dirty = edit.trim() !== (row.code_name ?? "");
  const save = async () => {
    setBusy(true);
    try {
      const r = await adminSend("/api/admin/catalog", "PATCH", { kind: "product", id: row.id, code_name: edit.trim() });
      onSaved("product", r.product, null);
    } catch (e) { onError(e.message); }
    finally { setBusy(false); }
  };
  const inp = "rounded-lg border border-white/12 bg-white/[0.03] px-2 py-1 text-se-bone text-[12px] focus:border-se-gold focus:outline-none";
  return (
    <div className="flex flex-wrap items-center gap-3 py-2 pl-8 border-t border-white/5">
      <span className="text-[11px] uppercase tracking-wide text-se-steel shrink-0">Code name</span>
      <input
        type="text"
        maxLength={80}
        placeholder={`blank = show ${row.name}`}
        title="Shown instead of the substance name on the shop, product page, cart and checkout. Certificates keep the substance name."
        className={`${inp} flex-1 min-w-[220px]`}
        value={edit}
        onChange={(e) => setEdit(e.target.value)}
      />
      <button onClick={save} disabled={!dirty || busy}
        className="text-[11px] rounded border border-se-gold/40 text-se-gold px-3 py-1 hover:bg-se-gold/10 disabled:opacity-30">
        {busy ? "Saving…" : "Save"}
      </button>
    </div>
  );
}

/* ── Category soft-launch visibility (migration 0034, Sept-11 T7) ──────────
   One checkbox per category. Hidden = the category and its products leave
   /shop, the category page, related rails, the sitemap and the prerender, and
   direct product URLs render the 404 page — nothing is deleted or
   un-published. Rendered only when the API returned the column (migration
   applied); mirror the same value in src/data/tier1Catalog.js so the static
   fallback agrees. */
const REBUILD_COPY = {
  triggered: "Rebuild triggered — the static pages update when the deploy finishes (a few minutes).",
  not_configured: "Static pages update on the next deploy. Set VERCEL_DEPLOY_HOOK_URL to rebuild automatically.",
  failed: "Rebuild request failed — redeploy from Vercel so the static pages match.",
};
function CategoryRow({ row, onSaved, onError }) {
  const [busy, setBusy] = useState(false);
  const [rebuild, setRebuild] = useState(null);
  const hidden = row.soft_launch_hidden === true;
  const toggle = async () => {
    setBusy(true);
    try {
      const r = await adminSend("/api/admin/catalog", "PATCH", {
        kind: "category",
        id: row.slug,
        soft_launch_hidden: !hidden,
      });
      setRebuild(r.rebuild || null);
      onSaved("category", r.category, null);
    } catch (e) { onError(e.message); }
    finally { setBusy(false); }
  };
  return (
    <div className="flex flex-wrap items-center gap-3 py-2 px-4">
      <p className="min-w-0 flex-1 text-[13px] text-se-bone truncate">
        {row.name} <span className="text-se-steel font-mono text-[11px]">· {row.slug}</span>
      </p>
      <label className="flex items-center gap-1.5 text-[11px] text-se-bone/60" title="Soft-launch: hide this category and its products from the storefront, sitemap and prerender">
        <input type="checkbox" checked={hidden} disabled={busy} onChange={toggle} /> hidden at launch
      </label>
      <span className={`shrink-0 rounded-full border px-2 py-0.5 text-[10px] uppercase tracking-wide ${
        hidden ? "border-amber-500/30 bg-amber-500/10 text-amber-300" : "border-emerald-500/30 bg-emerald-500/10 text-emerald-300"}`}>
        {hidden ? "hidden" : "visible"}
      </span>
      {rebuild && REBUILD_COPY[rebuild] && (
        <p className={`basis-full text-[11px] ${rebuild === "triggered" ? "text-emerald-300" : "text-amber-300"}`} data-testid="rebuild-status">
          {REBUILD_COPY[rebuild]}
        </p>
      )}
    </div>
  );
}

function CatalogManager() {
  const [categories, setCategories] = useState([]);
  const [products, setProducts] = useState([]);
  const [variants, setVariants] = useState([]);
  const [waitlist, setWaitlist] = useState([]);
  const [open, setOpen] = useState(() => new Set());
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState(null);
  const [notice, setNotice] = useState(null);

  const load = () => {
    setLoading(true);
    adminGet("/api/admin/catalog")
      .then((d) => {
        setProducts(d.products || []);
        setVariants(d.variants || []);
        setWaitlist(d.waitlist || []);
        setCategories(d.categories || []);
        setErr(null);
      })
      .catch((e) => setErr(e.message))
      .finally(() => setLoading(false));
  };
  useEffect(load, []);

  const variantsByProduct = useMemo(() => {
    const m = new Map();
    for (const v of variants) {
      if (!m.has(v.product_id)) m.set(v.product_id, []);
      m.get(v.product_id).push(v);
    }
    return m;
  }, [variants]);

  const onSaved = (kind, updated, restock) => {
    if (kind === "product") setProducts((ps) => ps.map((p) => (p.id === updated.id ? { ...p, ...updated } : p)));
    else if (kind === "category") setCategories((cs) => cs.map((c) => (c.slug === updated.slug ? { ...c, ...updated } : c)));
    else setVariants((vs) => vs.map((v) => (v.id === updated.id ? { ...v, ...updated } : v)));
    if (restock) {
      setNotice(
        restock.notified > 0
          ? `Restock notices sent to ${restock.notified} subscriber${restock.notified === 1 ? "" : "s"}.`
          : restock.queued > 0
            ? `${restock.queued} restock subscriber${restock.queued === 1 ? "" : "s"} queued — email sending is not configured (RESEND_API_KEY).`
            : "Saved. No pending restock requests for this item."
      );
      load(); // refresh waitlist badges
    } else {
      setNotice("Saved.");
    }
  };

  const toggle = (id) =>
    setOpen((s) => { const n = new Set(s); n.has(id) ? n.delete(id) : n.add(id); return n; });

  if (loading) return <p className="text-se-steel text-sm">Loading catalog…</p>;
  if (err && !products.length) return <p className="text-red-300 text-sm">{err}</p>;

  return (
    <div className="space-y-3">
      <p className="text-[12px] text-se-bone/55 font-accent">
        Prices, stock, and flags save straight to the live database (audit-logged). Flipping an
        item to <span className="text-se-bone/70">in stock</span> automatically emails everyone
        on its restock waitlist, once. Descriptions stay compliance-reviewed and are not
        editable here.
      </p>
      {err && <p className="text-red-300 text-sm">{err}</p>}
      {notice && (
        <p className="text-[12.5px] text-emerald-300">{notice}</p>
      )}
      {categories.some((c) => "soft_launch_hidden" in c) && (
        <div className="glass-panel divide-y divide-white/5">
          <p className="px-4 pt-3 pb-1 text-[11px] uppercase tracking-wide text-se-steel">
            Categories — soft-launch visibility
          </p>
          {categories.map((c) => (
            <CategoryRow key={c.slug} row={c} onSaved={onSaved} onError={setErr} />
          ))}
        </div>
      )}
      <div className="glass-panel divide-y divide-white/5">
        {products.map((p) => {
          const vs = variantsByProduct.get(p.id) || [];
          const productWaiting = waitlist.filter((w) => w.product_id === p.id && !w.variant_id).length;
          return (
            <div key={p.id} className="px-4">
              <div className="flex items-center gap-1">
                <button onClick={() => toggle(p.id)} aria-label={`Toggle ${p.name} variants`}
                  className="text-se-steel hover:text-se-bone shrink-0">
                  {open.has(p.id) ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                </button>
                <div className="flex-1 min-w-0">
                  <CatalogRow kind="product" row={p} waitCount={productWaiting} onSaved={onSaved} onError={setErr} />
                </div>
              </div>
              {open.has(p.id) && (
                <>
                  <SdsRow row={p} onSaved={onSaved} onError={setErr} />
                  <CodeNameRow row={p} onSaved={onSaved} onError={setErr} />
                </>
              )}
              {open.has(p.id) && vs.map((v) => (
                <CatalogRow key={v.id} kind="variant" row={v}
                  waitCount={waitlist.filter((w) => w.variant_id === v.id).length}
                  onSaved={onSaved} onError={setErr} />
              ))}
            </div>
          );
        })}
      </div>
    </div>
  );
}

/* ── Client error telemetry ───────────────────────────────────────────── */
/* Opt c6 (4.12): API failures recorded by lib/apiError.js failSafely()
   (migration 0035) — the server half of the Errors tab. */
function ServerErrors() {
  const [rows, setRows] = useState([]);
  const [pending, setPending] = useState(false);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState(null);
  const load = () => {
    setLoading(true);
    adminGet("/api/admin/server-errors")
      .then((d) => { setRows(d.errors || []); setPending(Boolean(d.migrationPending)); setErr(null); })
      .catch((e) => setErr(e.message))
      .finally(() => setLoading(false));
  };
  useEffect(load, []);
  const setResolved = async (id, resolved) => {
    try {
      await adminSend("/api/admin/server-errors", "PATCH", { id, resolved });
      setRows((rs) => rs.map((r) => (r.id === id ? { ...r, resolved } : r)));
    } catch (e) { setErr(e.message); }
  };
  return (
    <div className="space-y-3 mt-8" data-testid="server-errors">
      <div className="flex items-center justify-between">
        <p className="text-[11px] font-accent uppercase tracking-[0.16em] text-se-steel">API failures (server)</p>
        <button onClick={load} className="inline-flex items-center gap-1.5 text-[12px] text-se-steel hover:text-se-gold">
          <RefreshCw size={13} /> Refresh
        </button>
      </div>
      {loading && <p className="text-se-steel text-sm">Loading…</p>}
      {err && <p className="text-red-300 text-sm">{err}</p>}
      {!loading && pending && (
        <p className="text-[12px] text-amber-300">Apply migration 0035 (server_errors) to start recording API failures here.</p>
      )}
      {!loading && !pending && !rows.length && (
        <div className="glass-panel p-6 text-se-bone/50 text-sm">No API failures recorded. Every safely-failed request lands here with its request id.</div>
      )}
      {rows.map((r) => (
        <div key={r.id} className={`glass-panel p-4 ${r.resolved ? "opacity-50" : ""}`}>
          <div className="flex items-center justify-between gap-3 mb-1">
            <span className="text-[11px] text-se-steel font-accent truncate">
              {r.context || r.code || "api"} · {r.status} · {new Date(r.created_at).toLocaleString()} · <span className="font-mono">{r.request_id}</span>
            </span>
            <button onClick={() => setResolved(r.id, !r.resolved)} className={`shrink-0 text-[11px] ${r.resolved ? "text-amber-300" : "text-emerald-300"} hover:underline`}>
              {r.resolved ? "Reopen" : "Resolve"}
            </button>
          </div>
          <p className="text-[12.5px] text-se-bone/85 font-mono break-words">{r.message}</p>
        </div>
      ))}
    </div>
  );
}

function ClientErrors() {
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState(null);
  const [openId, setOpenId] = useState(null);

  const load = () => {
    setLoading(true);
    adminGet("/api/admin/client-errors")
      .then((d) => { setRows(d.errors || []); setErr(null); })
      .catch((e) => setErr(e.message))
      .finally(() => setLoading(false));
  };
  useEffect(load, []);

  const setResolved = async (id, resolved) => {
    try {
      await adminSend("/api/admin/client-errors", "PATCH", { id, resolved });
      setRows((rs) => rs.map((r) => (r.id === id ? { ...r, resolved } : r)));
    } catch (e) { setErr(e.message); }
  };

  if (loading) return <p className="text-se-steel text-sm">Loading error telemetry…</p>;
  if (err && !rows.length) return <p className="text-red-300 text-sm">{err}</p>;
  if (!rows.length) {
    return (
      <div className="glass-panel p-6 text-se-bone/50 text-sm">
        No production errors reported. Browser JS errors, unhandled promise rejections, and
        page-crash boundary catches will appear here automatically.
      </div>
    );
  }

  const srcBadge = (s) =>
    s === "boundary" ? "border-red-500/30 bg-red-500/10 text-red-300"
    : s === "promise" ? "border-amber-500/30 bg-amber-500/10 text-amber-300"
    : "border-white/15 bg-white/5 text-se-steel";

  return (
    <div className="space-y-3">
      {err && <p className="text-red-300 text-sm">{err}</p>}
      <div className="flex items-center justify-between">
        <p className="text-[12px] text-se-bone/55 font-accent">
          Grouped by error signature; repeats within 24h increment the count instead of adding rows.
        </p>
        <button onClick={load} className="inline-flex items-center gap-1.5 text-[12px] text-se-steel hover:text-se-gold">
          <RefreshCw size={13} /> Refresh
        </button>
      </div>
      {rows.map((r) => (
        <div key={r.id} className={`glass-panel p-4 ${r.resolved ? "opacity-50" : ""}`}>
          <div className="flex items-center justify-between gap-3 mb-1">
            <div className="flex items-center gap-2 min-w-0">
              <span className={`shrink-0 text-[10px] uppercase tracking-wide rounded-full px-2 py-0.5 border ${srcBadge(r.source)}`}>{r.source}</span>
              <span className="text-[11px] text-se-steel font-accent truncate">
                {r.path || "—"} · {r.hits}× · last {new Date(r.last_seen_at).toLocaleString()}
              </span>
            </div>
            <div className="shrink-0 flex items-center gap-3">
              {r.stack && (
                <button onClick={() => setOpenId(openId === r.id ? null : r.id)} className="text-[11px] text-se-steel hover:text-se-bone">
                  {openId === r.id ? "Hide stack" : "Stack"}
                </button>
              )}
              <button
                onClick={() => setResolved(r.id, !r.resolved)}
                className={`text-[11px] ${r.resolved ? "text-amber-300" : "text-emerald-300"} hover:underline`}
              >
                {r.resolved ? "Reopen" : "Resolve"}
              </button>
            </div>
          </div>
          <p className="text-[12.5px] text-se-bone/85 font-mono break-words">{r.message}</p>
          {openId === r.id && r.stack && (
            <pre className="mt-2 max-h-[240px] overflow-auto rounded-lg border border-white/10 bg-black/40 p-3 text-[11px] leading-relaxed text-se-bone/60 whitespace-pre-wrap break-words">{r.stack}</pre>
          )}
        </div>
      ))}
    </div>
  );
}

export default function AdminHome() {
  const [tab, setTab] = useState("overview");
  return (
    <>
      <SEO title="Admin Control Room | Noir Peptides" noindex />
      <div className="bg-se-black text-se-bone min-h-screen pt-28 pb-24">
        <div className="content-wide">
          <div className="flex items-center justify-between mb-6">
            <div>
              <p className="text-overline mb-2">Admin</p>
              <h1 className="font-display font-extrabold text-[clamp(1.6rem,4vw,2.6rem)] tracking-[0.02em]">Control Room</h1>
            </div>
            <Link to="/home" className="btn-outline">Back to Console</Link>
          </div>

          <div className="flex gap-2 mb-8 border-b border-white/10">
            {TABS.map((t) => (
              <button
                key={t.id}
                onClick={() => setTab(t.id)}
                className={`inline-flex items-center gap-2 px-4 py-3 text-[13px] font-accent border-b-2 -mb-px transition ${
                  tab === t.id ? "border-se-gold text-se-gold" : "border-transparent text-se-bone/50 hover:text-se-bone"
                }`}
              >
                <t.icon size={15} /> {t.label}
              </button>
            ))}
          </div>

          {tab === "overview" && <Overview />}
          {tab === "catalog" && <CatalogManager />}
          {tab === "orders" && <OrdersManager />}
          {tab === "reviews" && <ReviewsManager />}
          {tab === "partners" && <Partners />}
          {tab === "coa" && <CoaManager />}
          {tab === "discounts" && <DiscountsManager />}
          {tab === "flags" && <AiFlags />}
          {tab === "features" && <FeatureFlags />}
          {tab === "sprint" && <OwnerSprint />}
          {tab === "errors" && (<><ClientErrors /><ServerErrors /></>)}
          {tab === "scanner" && <ComplianceScanner />}
        </div>
      </div>
    </>
  );
}
