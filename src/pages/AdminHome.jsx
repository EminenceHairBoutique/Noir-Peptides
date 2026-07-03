// src/pages/AdminHome.jsx — Admin Control Room
// A real admin dashboard (not a placeholder). Access is enforced BOTH client-
// side (RequireAdmin route guard) and server-side (every /api/admin/* endpoint
// calls requireAdmin). Panels: Overview (live aggregates), COA Manager (create/
// publish real batch COAs — no fabricated data), and a Compliance Scanner
// (advisory RUO copy linter). Deeper editors (orders/reviews) are surfaced with
// live counts and land in a follow-up.
import { useEffect, useMemo, useState } from "react";
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
} from "lucide-react";
import SEO from "../components/SEO";
import { adminGet, adminSend } from "../lib/adminApi";
import { getProducts } from "../lib/catalog";
import { scanCopy } from "../lib/complianceScan";

const money = (cents) =>
  cents == null ? "—" : new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(cents / 100);
const num = (n) => (n == null ? "—" : n.toLocaleString());

const TABS = [
  { id: "overview", label: "Overview", icon: LayoutDashboard },
  { id: "coa", label: "COA Manager", icon: FileCheck2 },
  { id: "scanner", label: "Compliance Scanner", icon: ShieldAlert },
];

function StatCard({ label, value, sub, icon: Icon }) {
  return (
    <div className="glass-panel p-5">
      <div className="flex items-center justify-between mb-3">
        <span className="text-[11px] font-accent uppercase tracking-[0.16em] text-se-steel">{label}</span>
        {Icon && <Icon className="w-4 h-4 text-se-gold/70" strokeWidth={1.5} />}
      </div>
      <p className="font-display text-2xl text-se-bone">{value}</p>
      {sub && <p className="text-[12px] text-se-bone/45 font-accent mt-1">{sub}</p>}
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
  hplc: "", purity_percent: "", mass_spec: "", ms_confirmed: false,
  file_url: "", is_published: true,
};

function CoaManager() {
  const [coas, setCoas] = useState([]);
  const [products, setProducts] = useState([]);
  const [form, setForm] = useState(EMPTY_COA);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState(null);
  const [loading, setLoading] = useState(true);

  const load = () => {
    setLoading(true);
    adminGet("/api/admin/coa")
      .then((d) => setCoas(d.coas || []))
      .catch((e) => setMsg({ type: "err", text: e.message }))
      .finally(() => setLoading(false));
  };
  useEffect(() => {
    load();
    getProducts().then(setProducts).catch(() => {});
  }, []);

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
        <p className="text-[12px] text-se-bone/45 font-accent">Enter real per-batch lab values. Nothing is auto-generated.</p>

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
        </div>
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
      </div>
    </div>
  );
}

/* ── Compliance Scanner ───────────────────────────────────────────────── */
function ComplianceScanner() {
  const [text, setText] = useState("");
  const result = useMemo(() => (text.trim() ? scanCopy(text) : null), [text]);

  return (
    <div className="grid lg:grid-cols-2 gap-6">
      <div className="glass-panel p-6">
        <h3 className="font-display text-[16px] mb-2">Paste copy to scan</h3>
        <p className="text-[12px] text-se-bone/45 font-accent mb-3">
          Advisory RUO linter — flags human-use, dosing/administration, and therapeutic/disease
          language before you publish. Review each flag in context (it intentionally over-flags,
          including inside negative disclaimers).
        </p>
        <textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          rows={12}
          placeholder="Paste product, research, or legal copy here…"
          className="w-full rounded-lg border border-white/12 bg-white/[0.03] px-3 py-2 text-se-bone text-sm focus:border-se-gold focus:outline-none"
        />
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
      </div>
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
          {tab === "coa" && <CoaManager />}
          {tab === "scanner" && <ComplianceScanner />}
        </div>
      </div>
    </>
  );
}
