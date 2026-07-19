// src/components/labels/CatalogMatrix.jsx
// Phase-4 catalog rollout matrix: every product/variant with its label
// coverage (status + template), coverage stats, one-click "seed missing
// drafts" (explicit admin action → api bulk_seed), and row click-through to
// the editor. Read model comes from /api/admin/labels?matrix=1.
import { useMemo, useState } from "react";
import { Grid3X3, RefreshCw, Sparkles } from "lucide-react";
import { bulkSeedLabels } from "../../lib/labelsApi";
import { TEMPLATE_MASTERS } from "../../lib/labels/masters/registry";

const STATUS_STYLES = {
  draft: "bg-white/8 text-se-bone/60",
  in_review: "bg-amber-400/15 text-amber-300",
  changes_requested: "bg-orange-400/15 text-orange-300",
  approved: "bg-emerald-400/15 text-emerald-300",
  production_ready: "bg-emerald-400/25 text-emerald-200",
  archived: "bg-white/5 text-se-bone/30",
};

export default function CatalogMatrix({ matrix, onRefresh, onSelectConfig, busyId }) {
  const [seeding, setSeeding] = useState(false);
  const [seedResult, setSeedResult] = useState(null);
  const [filter, setFilter] = useState("");
  const [onlyMissing, setOnlyMissing] = useState(false);

  const rows = useMemo(() => {
    if (!matrix) return [];
    const cfgByKey = new Map(matrix.configs.map((c) => [`${c.product_id}::${c.variant_id || ""}`, c]));
    const byProduct = new Map(matrix.products.map((p) => [p.id, p]));
    const out = [];
    for (const v of matrix.variants) {
      const product = byProduct.get(v.product_id);
      if (!product) continue;
      out.push({ product, variant: v, config: cfgByKey.get(`${v.product_id}::${v.id}`) || null });
    }
    out.sort((a, b) => a.product.name.localeCompare(b.product.name) || (a.variant.vial_size_mg || 0) - (b.variant.vial_size_mg || 0));
    return out;
  }, [matrix]);

  const stats = useMemo(() => {
    const total = rows.length;
    const covered = rows.filter((r) => r.config).length;
    const approved = rows.filter((r) => r.config && ["approved", "production_ready"].includes(r.config.status)).length;
    return { total, covered, approved, missing: total - covered };
  }, [rows]);

  const visible = rows.filter((r) => {
    if (onlyMissing && r.config) return false;
    if (!filter) return true;
    const q = filter.toLowerCase();
    return r.product.name.toLowerCase().includes(q) || (r.variant.sku || "").toLowerCase().includes(q);
  });

  const seed = async () => {
    if (seeding || !stats.missing) return;
    setSeeding(true);
    setSeedResult(null);
    try {
      const r = await bulkSeedLabels();
      setSeedResult(r);
      await onRefresh();
    } catch (e) {
      setSeedResult({ error: e.message });
    } finally {
      setSeeding(false);
    }
  };

  if (!matrix) {
    return (
      <div className="glass-panel p-5 text-[13px] text-se-bone/50 font-accent flex items-center gap-2">
        <Grid3X3 size={14} /> Loading catalog matrix…
      </div>
    );
  }

  return (
    <div className="glass-panel p-5 space-y-4">
      <div className="flex flex-wrap items-center gap-3">
        <p className="text-label text-se-gold flex items-center gap-1.5">
          <Grid3X3 size={13} /> Catalog rollout matrix
        </p>
        <span className="text-[11.5px] font-accent text-se-bone/55">
          {stats.covered}/{stats.total} variants covered · {stats.approved} approved
        </span>
        <div className="ml-auto flex items-center gap-2">
          <button type="button" onClick={onRefresh} className="btn-outline !min-h-[36px] !px-2.5" title="Refresh">
            <RefreshCw size={13} />
          </button>
          {stats.missing > 0 && (
            <button type="button" onClick={seed} disabled={seeding} className="btn-primary !min-h-[36px] disabled:opacity-40">
              <Sparkles size={13} /> {seeding ? "Seeding…" : `Seed ${stats.missing} missing draft${stats.missing === 1 ? "" : "s"}`}
            </button>
          )}
        </div>
      </div>

      {seedResult && (
        <p className={`text-[12px] font-accent ${seedResult.error || seedResult.failed?.length ? "text-amber-300" : "text-emerald-300"}`}>
          {seedResult.error
            ? `Seeding failed: ${seedResult.error}`
            : `Created ${seedResult.created} draft${seedResult.created === 1 ? "" : "s"}${seedResult.failed?.length ? ` · ${seedResult.failed.length} failed` : ""}`}
        </p>
      )}

      <div className="flex flex-wrap items-center gap-3">
        <input
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
          placeholder="Filter by product or SKU…"
          className="rounded-lg border border-white/12 bg-white/[0.03] px-3 py-1.5 text-se-bone text-[12.5px] focus:border-se-gold focus:outline-none w-64"
        />
        <label className="flex items-center gap-2 text-[11.5px] text-se-bone/60 font-accent uppercase tracking-wide">
          <input type="checkbox" checked={onlyMissing} onChange={(e) => setOnlyMissing(e.target.checked)} />
          Missing only
        </label>
      </div>

      <div className="max-h-[420px] overflow-y-auto rounded-lg border border-white/8">
        <table className="w-full text-[12.5px]">
          <thead className="sticky top-0 bg-se-charcoal/95 backdrop-blur">
            <tr className="text-left text-[10.5px] font-accent uppercase tracking-wider text-se-bone/45">
              <th className="px-3 py-2">Product</th>
              <th className="px-3 py-2">Size</th>
              <th className="px-3 py-2">SKU</th>
              <th className="px-3 py-2">Status</th>
              <th className="px-3 py-2">Template</th>
            </tr>
          </thead>
          <tbody>
            {visible.map((r) => {
              const c = r.config;
              const master = c ? TEMPLATE_MASTERS[c.template_id] : null;
              return (
                <tr
                  key={r.variant.id}
                  onClick={() => c && onSelectConfig(c.id)}
                  className={`border-t border-white/6 ${c ? "cursor-pointer hover:bg-white/[0.04]" : "opacity-60"} ${busyId === c?.id ? "bg-white/[0.05]" : ""}`}
                >
                  <td className="px-3 py-2 text-se-bone/85">{r.product.name}</td>
                  <td className="px-3 py-2 text-se-bone/60">{r.variant.size_label || `${r.variant.vial_size_mg} mg`}</td>
                  <td className="px-3 py-2 font-mono text-[11.5px] text-se-bone/50">{r.variant.sku}</td>
                  <td className="px-3 py-2">
                    {c ? (
                      <span className={`inline-block rounded px-2 py-0.5 text-[10.5px] font-accent uppercase tracking-wide ${STATUS_STYLES[c.status] || ""}`}>
                        {c.status.replace("_", " ")}
                        {c.label_version > 1 ? ` v${c.label_version}` : ""}
                      </span>
                    ) : (
                      <span className="text-[11px] text-se-bone/35 font-accent">— no label</span>
                    )}
                  </td>
                  <td className="px-3 py-2 text-se-bone/55">{master ? master.displayName : c ? c.template_id : ""}</td>
                </tr>
              );
            })}
            {!visible.length && (
              <tr>
                <td colSpan={5} className="px-3 py-6 text-center text-se-bone/40 font-accent text-[12px]">
                  No rows match.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <p className="text-[11px] text-se-steel font-accent">
        Seeded drafts derive from real catalog data only — blend component names come from the catalog with quantities left
        for administrative input; storage stays unverified until confirmed. Nothing publishes without Approved status.
      </p>
    </div>
  );
}
