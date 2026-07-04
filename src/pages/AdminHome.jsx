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
  Flag,
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
  { id: "orders", label: "Orders", icon: Package },
  { id: "reviews", label: "Reviews", icon: Star },
  { id: "partners", label: "Partners", icon: Users },
  { id: "coa", label: "COA Manager", icon: FileCheck2 },
  { id: "flags", label: "AI Flags", icon: Flag },
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
        <StatCard label="AI flags (open)" value={num(data?.ai?.unreviewedFlags)} sub="need review" icon={Flag} />
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
        <p className="text-[12px] text-se-bone/45 font-accent mb-3">
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

/* ── Orders ───────────────────────────────────────────────────────────── */
function OrdersManager() {
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState(null);
  const [savingId, setSavingId] = useState(null);

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
      <p className="text-[12px] text-se-bone/45 font-accent">Changing a status notifies the customer by email. Newest first (last 100).</p>
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
              <tr key={o.order_number} className="border-t border-white/5">
                <td className="p-3 font-mono text-[12px] text-se-bone">{o.order_number}</td>
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
      <p className="text-[12px] text-se-bone/45 font-accent">
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
          {tab === "orders" && <OrdersManager />}
          {tab === "reviews" && <ReviewsManager />}
          {tab === "partners" && <Partners />}
          {tab === "coa" && <CoaManager />}
          {tab === "flags" && <AiFlags />}
          {tab === "scanner" && <ComplianceScanner />}
        </div>
      </div>
    </>
  );
}
