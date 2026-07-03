// src/pages/ResearcherConsole.jsx
// The authenticated landing — a premium "Researcher Console" (not a generic
// storefront homepage). Surfaces catalog entry points, COA verification, order
// status, the attestation receipt/status module, research articles, and AI
// assistant shortcuts. All data is RLS-gated; nothing here implies human use.
import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { motion as Motion } from "framer-motion";
import {
  FlaskConical,
  ShieldCheck,
  ShieldAlert,
  FileCheck2,
  QrCode,
  Calculator,
  BookOpen,
  Sparkles,
  Package,
  ArrowRight,
  ChevronRight,
  LifeBuoy,
} from "lucide-react";
import SEO from "../components/SEO";
import { useUser } from "../context/UserContext";
import { getCategories } from "../lib/catalog";
import { getMyOrders } from "../lib/orders";
import { researchArticles } from "../data/research.js";
import { ATTESTATION_VERSION } from "../config/attestation";

const money = (cents, currency = "usd") =>
  new Intl.NumberFormat("en-US", { style: "currency", currency: (currency || "usd").toUpperCase() }).format(
    Number(cents || 0) / 100
  );

const fmtDate = (d) => {
  if (!d) return "—";
  try {
    return new Date(d).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
  } catch {
    return String(d);
  }
};

const STATUS_STYLES = {
  paid: "border-emerald-500/30 bg-emerald-500/10 text-emerald-300",
  shipped: "border-cyan-500/30 bg-cyan-500/10 text-cyan-300",
  processing: "border-amber-500/30 bg-amber-500/10 text-amber-300",
  refunded: "border-white/15 bg-white/5 text-se-steel",
  default: "border-white/15 bg-white/5 text-se-bone/70",
};

// Quick actions. AI tools live under /research today; Phase E adds dedicated
// assistant surfaces and repoints the "AI" tiles.
const QUICK_ACTIONS = [
  { to: "/shop", icon: FlaskConical, title: "Research Catalog", desc: "Browse batch-documented reference materials." },
  { to: "/verify-lot", icon: QrCode, title: "Verify a Lot", desc: "Scan or enter a vial lot to view its COA." },
  { to: "/test-results", icon: FileCheck2, title: "Test Results", desc: "The full certificate-of-analysis library." },
  { to: "/calculator", icon: Calculator, title: "Reconstitution Calculator", desc: "Pure mass ÷ volume aliquoting math." },
  { to: "/research", icon: BookOpen, title: "Research Library", desc: "Analytical methods & preclinical literature." },
  { to: "/account", icon: Package, title: "Account & Orders", desc: "Order history, addresses, rewards." },
];

function Section({ title, children, action }) {
  return (
    <section className="mb-10">
      <div className="flex items-end justify-between mb-4">
        <h2 className="text-label text-se-gold">{title}</h2>
        {action}
      </div>
      {children}
    </section>
  );
}

export default function ResearcherConsole() {
  const { user, attestationComplete } = useUser();
  const [categories, setCategories] = useState([]);
  const [orders, setOrders] = useState([]);
  const [ordersLoading, setOrdersLoading] = useState(true);

  useEffect(() => {
    let active = true;
    getCategories().then((c) => active && setCategories(c));
    getMyOrders(5).then((o) => {
      if (!active) return;
      setOrders(o);
      setOrdersLoading(false);
    });
    return () => {
      active = false;
    };
  }, []);

  const firstName = useMemo(() => {
    const n = (user?.name || "").trim().split(" ")[0];
    return n || "Researcher";
  }, [user]);

  const articles = researchArticles.slice(0, 3);

  return (
    <>
      <SEO title="Researcher Console | Noir Peptides" description="Your research procurement and verification console." noindex />

      <div className="bg-se-black text-se-bone min-h-screen pt-28 pb-20">
        <div className="content-wide">
          {/* Header */}
          <Motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, ease: [0.2, 0, 0, 1] }}
            className="mb-8"
          >
            <p className="text-overline mb-2">Researcher Console</p>
            <h1 className="font-display font-extrabold text-[clamp(1.8rem,4vw,2.8rem)] tracking-[0.02em]">
              Welcome back, {firstName}.
            </h1>
          </Motion.div>

          {/* Attestation status / receipt module */}
          <div
            className={`mb-10 rounded-xl border p-5 sm:p-6 flex flex-col sm:flex-row sm:items-center gap-4 ${
              attestationComplete
                ? "border-emerald-500/25 bg-emerald-500/[0.06]"
                : "border-amber-500/30 bg-amber-500/[0.07]"
            }`}
          >
            <div className="flex items-start gap-3 flex-1">
              {attestationComplete ? (
                <ShieldCheck className="w-6 h-6 text-emerald-400 shrink-0" />
              ) : (
                <ShieldAlert className="w-6 h-6 text-amber-400 shrink-0" />
              )}
              <div>
                <p className="font-display text-[15px] text-se-bone">
                  Research-Use Attestation —{" "}
                  {attestationComplete ? (
                    <span className="text-emerald-300">Active</span>
                  ) : (
                    <span className="text-amber-300">Action needed</span>
                  )}
                </p>
                <p className="text-[12.5px] text-se-bone/55 font-accent mt-1">
                  {attestationComplete ? (
                    <>
                      Signed as <span className="text-se-bone/80">{user?.name || user?.email}</span> ·
                      version <span className="font-mono">{user?.attestationVersion || ATTESTATION_VERSION}</span> ·
                      recorded {fmtDate(user?.attestationCompletedAt)}. Checkout is unlocked.
                    </>
                  ) : (
                    <>
                      A current attestation (v{ATTESTATION_VERSION}) is required before checkout.
                      Re-attestation takes under a minute.
                    </>
                  )}
                </p>
              </div>
            </div>
            {!attestationComplete && (
              <Link to="/register/attestation" className="btn-primary shrink-0">
                Complete attestation <ArrowRight size={14} />
              </Link>
            )}
          </div>

          {/* Quick actions */}
          <Section title="Quick actions">
            <div className="grid grid-cols-2 md:grid-cols-3 gap-3 md:gap-4">
              {QUICK_ACTIONS.map((a) => (
                <Link
                  key={a.to}
                  to={a.to}
                  className="group glass-panel card-hover p-5 flex flex-col gap-3"
                >
                  <div className="flex items-center justify-between">
                    <a.icon className="w-5 h-5 text-se-gold" strokeWidth={1.5} />
                    <ChevronRight size={15} className="text-se-steel group-hover:text-se-gold transition" />
                  </div>
                  <div>
                    <p className="font-display text-[15px] tracking-[0.02em]">{a.title}</p>
                    <p className="text-[12px] text-se-bone/45 font-accent mt-1 leading-relaxed">{a.desc}</p>
                  </div>
                </Link>
              ))}
            </div>
          </Section>

          <div className="grid lg:grid-cols-3 gap-8">
            {/* Recent orders */}
            <div className="lg:col-span-2">
              <Section
                title="Recent orders"
                action={
                  <Link to="/account/orders" className="text-[11px] font-accent uppercase tracking-[0.16em] text-se-steel hover:text-se-gold transition">
                    View all
                  </Link>
                }
              >
                {ordersLoading ? (
                  <div className="glass-panel p-6 text-se-steel text-sm">Loading orders…</div>
                ) : orders.length === 0 ? (
                  <div className="glass-panel p-6">
                    <p className="text-se-bone/80 font-medium">No orders yet.</p>
                    <p className="text-[13px] text-se-bone/50 font-accent mt-1">
                      Browse the{" "}
                      <Link to="/shop" className="text-se-gold hover:underline">research catalog</Link>{" "}
                      to get started.
                    </p>
                  </div>
                ) : (
                  <div className="glass-panel divide-y divide-white/5">
                    {orders.map((o) => {
                      const cls = STATUS_STYLES[o.status] || STATUS_STYLES.default;
                      const count = Array.isArray(o.items) ? o.items.length : 0;
                      return (
                        <div key={o.order_number} className="flex items-center justify-between gap-3 p-4">
                          <div className="min-w-0">
                            <p className="font-mono text-[13px] text-se-bone truncate">{o.order_number}</p>
                            <p className="text-[12px] text-se-steel font-accent">
                              {fmtDate(o.created_at)} · {count} item{count === 1 ? "" : "s"} · {money(o.amount_total, o.currency)}
                            </p>
                          </div>
                          <span className={`shrink-0 rounded-full border px-2.5 py-0.5 text-[11px] uppercase tracking-wide ${cls}`}>
                            {o.status || "—"}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                )}
              </Section>
            </div>

            {/* Research library + AI */}
            <div>
              <Section
                title="AI research tools"
                action={<span className="text-[10px] font-accent uppercase tracking-[0.16em] text-se-gold/70">RUO-safe</span>}
              >
                <Link to="/assistant" className="group glass-panel card-hover p-5 flex items-start gap-3">
                  <Sparkles className="w-5 h-5 text-se-gold shrink-0" strokeWidth={1.5} />
                  <div>
                    <p className="font-display text-[15px]">Research Concierge & COA tools</p>
                    <p className="text-[12px] text-se-bone/45 font-accent mt-1">
                      Compound background, COA interpretation, and literature summaries — never dosing or use guidance.
                    </p>
                  </div>
                </Link>
              </Section>

              <Section title="From the research library">
                <div className="glass-panel divide-y divide-white/5">
                  {articles.map((a) => (
                    <Link key={a.slug} to={`/research/${a.slug}`} className="block p-4 hover:bg-white/[0.02] transition">
                      <p className="font-display text-[14px] text-se-bone leading-snug">{a.title}</p>
                      <p className="text-[12px] text-se-bone/45 font-accent mt-1 line-clamp-2">{a.summary}</p>
                    </Link>
                  ))}
                </div>
              </Section>
            </div>
          </div>

          {/* Catalog domains */}
          {categories.length > 0 && (
            <Section
              title="Research domains"
              action={
                <Link to="/shop" className="text-[11px] font-accent uppercase tracking-[0.16em] text-se-steel hover:text-se-gold transition">
                  Full catalog
                </Link>
              }
            >
              <div className="flex flex-wrap gap-2">
                {categories.map((c) => (
                  <Link
                    key={c.slug}
                    to={`/shop/${c.slug}`}
                    className="rounded-full border border-white/12 bg-white/[0.02] px-4 py-2 text-[12.5px] font-accent text-se-bone/70 hover:border-se-gold/40 hover:text-se-gold transition"
                  >
                    {c.name}
                  </Link>
                ))}
              </div>
            </Section>
          )}

          {/* Support + RUO footer note */}
          <div className="mt-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 rounded-xl border border-white/10 bg-white/[0.02] p-5">
            <div className="flex items-center gap-3">
              <LifeBuoy className="w-5 h-5 text-se-gold" strokeWidth={1.5} />
              <div>
                <p className="font-display text-[14px]">Need help with an order or COA?</p>
                <p className="text-[12px] text-se-bone/50 font-accent">Our research support team is here.</p>
              </div>
            </div>
            <Link to="/contact" className="btn-outline shrink-0">Contact support</Link>
          </div>

          <p className="mt-8 text-[11px] text-se-steel font-accent text-center uppercase tracking-[0.14em]">
            For research use only. Not for human or veterinary use.
          </p>
        </div>
      </div>
    </>
  );
}
