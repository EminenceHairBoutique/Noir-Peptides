import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Receipt, LogOut, ChevronRight, ShieldCheck } from "lucide-react";

import { supabase } from "../../lib/supabaseClient";
import { useUser } from "../../context/UserContext";

const fmtDate = (iso) => {
  if (!iso) return "—";
  try {
    return new Date(iso).toLocaleDateString(undefined, {
      year: "numeric",
      month: "short",
      day: "numeric",
    });
  } catch {
    return "—";
  }
};

const money = (cents) => {
  const dollars = Number(cents || 0) / 100;
  return `$${dollars.toLocaleString(undefined, { maximumFractionDigits: 0 })}`;
};

const niceDate = (iso) => {
  try {
    return new Date(iso).toLocaleDateString(undefined, {
      year: "numeric",
      month: "short",
      day: "numeric",
    });
  } catch {
    return iso;
  }
};

export default function AccountDashboard() {
  const { user, logout } = useUser();

  const [loading, setLoading] = useState(true);
  const [orders, setOrders] = useState([]);
  const [error, setError] = useState("");

  useEffect(() => {
    let cancelled = false;

    async function run() {
      if (!user?.id || !supabase) {
        setLoading(false);
        return;
      }

      setLoading(true);
      setError("");

      try {
        let { data: ord, error: ordErr } = await supabase
          .from("orders")
          .select("order_number, created_at, amount_total, currency, status")
          .order("created_at", { ascending: false })
          .limit(12)
          .eq("user_id", user.id);

        if (ordErr && user.email) {
          const fallback = await supabase
            .from("orders")
            .select("order_number, created_at, amount_total, currency, status")
            .eq("email", user.email)
            .order("created_at", { ascending: false })
            .limit(12);
          ord = fallback.data || [];
          ordErr = fallback.error || null;
        }

        if (!cancelled) {
          if (ordErr) setError(ordErr.message || "Failed to load orders.");
          setOrders(ord || []);
        }
      } catch (e) {
        if (!cancelled) setError(e?.message || "Something went wrong.");
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    run();
    return () => {
      cancelled = true;
    };
  }, [user?.id, user?.email]);

  return (
    <div className="bg-se-black text-se-bone min-h-screen pt-28 pb-24">
      <div className="content-wide">
        <div className="flex flex-col md:flex-row md:items-end md:justify-between gap-4 mb-10">
          <div>
            <p className="text-overline mb-3">Account</p>
            <h1 className="font-display font-extrabold text-[clamp(1.5rem,4vw,2.5rem)] tracking-[0.02em]">
              {user?.email ? "WELCOME BACK" : "MY ACCOUNT"}
            </h1>
            {user?.email && (
              <p className="text-[13px] text-se-steel font-accent mt-2">
                {user.email}
              </p>
            )}
          </div>

          <button
            onClick={logout}
            className="btn-outline inline-flex items-center gap-2"
            type="button"
          >
            <LogOut className="w-4 h-4" />
            Sign Out
          </button>
        </div>

        {error && (
          <div className="mb-6 border border-se-red/40 bg-[#180a0d] px-4 py-3 text-[13px] text-se-red-bright font-accent">
            {error}
          </div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          {/* Orders */}
          <div className="lg:col-span-8 glass-panel p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-overline mb-2">Orders</p>
                <h2 className="font-display text-[18px] tracking-[0.04em]">
                  RECENT ORDERS
                </h2>
              </div>
              <Link
                to="/shop"
                className="text-[11px] text-se-steel hover:text-se-gold font-accent transition"
              >
                Catalog <ChevronRight className="inline w-4 h-4" />
              </Link>
            </div>

            <div className="mt-6">
              {loading ? (
                <div className="space-y-3">
                  {[1, 2, 3].map((i) => (
                    <div key={i} className="h-14 bg-se-asphalt se-skeleton" />
                  ))}
                </div>
              ) : orders.length === 0 ? (
                <div className="border border-se-concrete bg-se-asphalt p-5 text-[13px] text-se-bone/50 font-accent">
                  No orders yet. When you place your first order, it will appear
                  here.
                </div>
              ) : (
                <div className="space-y-3">
                  {orders.map((o) => (
                    <div
                      key={o.order_number || o.created_at}
                      className="flex items-center justify-between gap-4 border border-se-concrete px-4 py-3"
                    >
                      <div>
                        <div className="text-[13px] font-accent text-se-bone">
                          Order {o.order_number || "—"}
                        </div>
                        <div className="text-[11px] text-se-steel font-accent mt-1">
                          {niceDate(o.created_at)} ·{" "}
                          {String(o.status || "paid").toUpperCase()}
                        </div>
                      </div>
                      <div className="text-[13px] font-accent text-se-bone">
                        {money(o.amount_total)}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Quick links + attestation record */}
          <div className="lg:col-span-4 space-y-6">
            {/* Research-use attestation record */}
            <div className="glass-panel p-6">
              <div className="flex items-center gap-2 mb-3">
                <ShieldCheck className="w-4 h-4 text-se-gold" />
                <p className="text-overline">Attestation On File</p>
              </div>
              <div className="space-y-2 text-[12px] font-accent">
                <div className="flex items-center justify-between">
                  <span className="text-se-steel uppercase tracking-[0.14em]">Status</span>
                  <span className="text-se-gold">
                    {user?.attestationCompletedAt ? "Confirmed" : "Pending"}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-se-steel uppercase tracking-[0.14em]">Recorded</span>
                  <span className="text-se-bone">{fmtDate(user?.attestationCompletedAt)}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-se-steel uppercase tracking-[0.14em]">Version</span>
                  <span className="text-se-bone">{user?.attestationVersion || "—"}</span>
                </div>
              </div>
              <p className="text-[10px] text-se-steel/80 font-accent mt-4 leading-relaxed">
                Recorded for research-use only. Not for human or veterinary use.
              </p>
            </div>

            <div className="glass-panel p-6">
            <p className="text-overline mb-2">Quick Links</p>
            <h2 className="font-display text-[18px] tracking-[0.04em] mb-5">
              RESEARCH RESOURCES
            </h2>
            <div className="space-y-3 text-[13px] font-accent">
              {[
                { label: "Research Catalog", to: "/shop" },
                { label: "COA Policy", to: "/coa-policy" },
                { label: "Research-Use Policy", to: "/legal/research-use-policy" },
                { label: "Contact Support", to: "/contact" },
              ].map((l) => (
                <Link
                  key={l.to}
                  to={l.to}
                  className="flex items-center justify-between border border-se-concrete px-4 py-3 text-se-bone/70 hover:text-se-gold hover:border-se-gold/40 transition"
                >
                  {l.label}
                  <ChevronRight className="w-4 h-4" />
                </Link>
              ))}
            </div>
            <div className="mt-6 flex items-start gap-2">
              <Receipt className="w-4 h-4 text-se-gold mt-0.5 shrink-0" />
              <p className="text-[11px] text-se-steel font-accent leading-relaxed">
                For research use only. Not for human or veterinary use.
              </p>
            </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
