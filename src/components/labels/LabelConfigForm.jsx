// src/components/labels/LabelConfigForm.jsx
// Controlled editor for a label config: identity, batch fields, storage
// (source-verified gating — unverified renders the safe placeholder and shows
// a review flag), blend composition (owner-entered only), and legal lines.
import { STORAGE_PRESETS } from "../../lib/labels/storage";
import { buildLotNumber, validateLotFormat } from "../../lib/labels/lots";

const field =
  "w-full rounded-lg border border-white/12 bg-white/[0.03] px-3 py-2 text-se-bone text-[13px] focus:border-se-gold focus:outline-none";
const labelCls = "block text-[10px] uppercase tracking-[0.14em] text-se-steel mb-1";

function Row({ children, cols = 2 }) {
  return <div className={cols === 3 ? "grid grid-cols-3 gap-3" : "grid grid-cols-2 gap-3"}>{children}</div>;
}

export default function LabelConfigForm({ config, onChange }) {
  const set = (k, v) => onChange({ ...config, [k]: v });

  const lotOk = !config.lot_number || validateLotFormat(config.lot_number);

  const suggestLot = () => {
    const src = config.packaged_date;
    if (!src) return; // lots derive from a REAL packaging date the admin sets
    const yymm = src.slice(2, 4) + src.slice(5, 7);
    try {
      set("lot_number", buildLotNumber({ yymm, batch: 1 }));
    } catch {
      /* ignore */
    }
  };

  const comp = Array.isArray(config.composition) ? config.composition : [];
  const setComp = (i, k, v) => {
    const next = comp.map((c, j) => (j === i ? { ...c, [k]: v } : c));
    set("composition", next);
  };

  return (
    <div className="space-y-5">
      {/* Identity */}
      <fieldset className="space-y-3">
        <legend className="text-label text-se-gold mb-1">Identity</legend>
        <Row>
          <div>
            <label className={labelCls}>Display name</label>
            <input className={field} value={config.display_name || ""} onChange={(e) => set("display_name", e.target.value)} />
          </div>
          <div>
            <label className={labelCls}>Quantity label</label>
            <input className={field} value={config.quantity_label || ""} onChange={(e) => set("quantity_label", e.target.value)} placeholder="5 mg" />
          </div>
        </Row>
        <Row>
          <div>
            <label className={labelCls}>Material type</label>
            <input className={field} value={config.material_type || ""} onChange={(e) => set("material_type", e.target.value)} placeholder="Lyophilized Research Material" />
          </div>
          <div>
            <label className={labelCls}>SKU / catalog code</label>
            <input className={field} value={config.sku || ""} onChange={(e) => set("sku", e.target.value)} />
          </div>
        </Row>
        <div>
          <label className={labelCls}>Net contents (optional, owner-entered)</label>
          <input className={field} value={config.net_contents || ""} onChange={(e) => set("net_contents", e.target.value)} placeholder="e.g. Total nominal content: 70 mg" />
        </div>
      </fieldset>

      {/* Batch identification */}
      <fieldset className="space-y-3">
        <legend className="text-label text-se-gold mb-1">Batch identification</legend>
        <Row cols={3}>
          <div>
            <label className={labelCls}>Packaged date</label>
            <input type="date" className={field} value={config.packaged_date || ""} onChange={(e) => set("packaged_date", e.target.value)} />
          </div>
          <div>
            <label className={labelCls}>Expiration date</label>
            <input type="date" className={field} value={config.expiration_date || ""} onChange={(e) => set("expiration_date", e.target.value)} />
          </div>
          <div>
            <label className={labelCls}>Retest date</label>
            <input type="date" className={field} value={config.retest_date || ""} onChange={(e) => set("retest_date", e.target.value)} />
          </div>
        </Row>
        <p className="text-[11px] text-se-bone/40 font-accent -mt-1">
          Use retest (not expiration) only when that terminology matches the quality system. Set one, not both.
        </p>
        <Row>
          <div>
            <label className={labelCls}>Lot number {config.lot_number && !lotOk && <span className="text-amber-300 normal-case">(expected NP-CODE-YYMM-NNN)</span>}</label>
            <div className="flex gap-2">
              <input className={`${field} font-mono`} value={config.lot_number || ""} onChange={(e) => set("lot_number", e.target.value.toUpperCase())} placeholder="NP-BPC157-2607-001" />
              <button type="button" onClick={suggestLot} disabled={!config.packaged_date} title={config.packaged_date ? "Derive from packaged date" : "Set a packaged date first"} className="btn-outline shrink-0 disabled:opacity-40">
                Suggest
              </button>
            </div>
          </div>
          <div>
            <label className={labelCls}>Barcode value (Code 128)</label>
            <input className={`${field} font-mono`} value={config.barcode_value || ""} onChange={(e) => set("barcode_value", e.target.value)} placeholder={config.sku || ""} />
            {config.barcode_value && config.barcode_value.length > 11 && (
              <p className="text-[11px] text-amber-300 mt-1">
                {config.barcode_value.length} chars — at 30 mm ladder height the module width drops below the
                ~0.19 mm scan floor. Prefer ≤ 11 chars (e.g. the SKU).
              </p>
            )}
          </div>
        </Row>
      </fieldset>

      {/* Storage — verified-only gating */}
      <fieldset className="space-y-3">
        <legend className="text-label text-se-gold mb-1">Storage</legend>
        {!config.storage_source_verified && (
          <p className="rounded-lg border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-[12px] text-amber-200">
            Storage not source-verified — the label prints the safe placeholder until supplier/stability
            documentation is confirmed for THIS product. Temperatures are never invented.
          </p>
        )}
        <div>
          <label className={labelCls}>Approved phrasing preset</label>
          <select
            className={field}
            value=""
            onChange={(e) => {
              const p = STORAGE_PRESETS.find((x) => x.id === e.target.value);
              if (p) onChange({ ...config, storage_short: p.shortLabelText, storage_full: p.fullStorageText });
            }}
          >
            <option value="">Pick a controlled phrasing…</option>
            {STORAGE_PRESETS.map((p) => (
              <option key={p.id} value={p.id}>{p.fullStorageText}</option>
            ))}
          </select>
        </div>
        <Row>
          <div>
            <label className={labelCls}>Short label text</label>
            <input className={field} value={config.storage_short || ""} onChange={(e) => set("storage_short", e.target.value)} />
          </div>
          <div>
            <label className={labelCls}>Full storage text</label>
            <input className={field} value={config.storage_full || ""} onChange={(e) => set("storage_full", e.target.value)} />
          </div>
        </Row>
        <label className="flex items-center gap-2 text-[13px] text-se-bone/80">
          <input
            type="checkbox"
            checked={!!config.storage_source_verified}
            onChange={(e) => set("storage_source_verified", e.target.checked)}
          />
          Source-verified against product-specific documentation
        </label>
      </fieldset>

      {/* Blend composition — owner-entered only */}
      <fieldset className="space-y-3">
        <legend className="text-label text-se-gold mb-1">Composition (blends)</legend>
        <p className="text-[11px] text-se-bone/40 font-accent">
          Per-component quantities must come from batch records. Empty quantities render
          "Composition: pending administrative input" — never invented splits.
        </p>
        {comp.map((c, i) => (
          <Row cols={3} key={i}>
            <input className={field} value={c.name || ""} onChange={(e) => setComp(i, "name", e.target.value)} placeholder="Component" />
            <input className={field} value={c.quantity || ""} onChange={(e) => setComp(i, "quantity", e.target.value)} placeholder="Quantity (e.g. 10 mg)" />
            <button type="button" className="btn-outline" onClick={() => set("composition", comp.filter((_, j) => j !== i))}>
              Remove
            </button>
          </Row>
        ))}
        {comp.length < 4 && (
          <button type="button" className="btn-outline" onClick={() => set("composition", [...comp, { name: "", quantity: "" }])}>
            Add component
          </button>
        )}
      </fieldset>

      {/* Legal / origin lines — owner-supplied only */}
      <fieldset className="space-y-3">
        <legend className="text-label text-se-gold mb-1">Legal lines (optional, only if factually appropriate)</legend>
        <Row cols={3}>
          <div>
            <label className={labelCls}>Manufacturer</label>
            <input className={field} value={config.manufacturer || ""} onChange={(e) => set("manufacturer", e.target.value)} />
          </div>
          <div>
            <label className={labelCls}>Distributed by</label>
            <input className={field} value={config.distributed_by || ""} onChange={(e) => set("distributed_by", e.target.value)} />
          </div>
          <div>
            <label className={labelCls}>Country of origin</label>
            <input className={field} value={config.country_of_origin || ""} onChange={(e) => set("country_of_origin", e.target.value)} />
          </div>
        </Row>
        <label className="flex items-center gap-2 text-[13px] text-se-bone/80">
          <input type="checkbox" checked={!!config.recalled} onChange={(e) => set("recalled", e.target.checked)} />
          <span className="text-red-300">Recalled batch (verification page shows RECALLED)</span>
        </label>
      </fieldset>
    </div>
  );
}
