// src/pages/LabelStudio.jsx — Admin Label Studio (/admin/labels)
// Internal review surface for the RUO label system (Checkpoint 1+). Select a
// product/variant, switch between the four template directions and the five
// physical presets, inspect flat + print-guide + 3D vial views, edit batch
// fields, run the approval workflow, and export SVG/PNG artwork.
// Admin-enforced client-side (RequireAdmin) AND server-side (/api/admin/labels).
// Draft labels are never published to customer surfaces.
import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { Plus, Save, Download, FileImage, FileText, Tag } from "lucide-react";
import SEO from "../components/SEO";
import LabelPreview from "../components/labels/LabelPreview";
import LabelConfigForm from "../components/labels/LabelConfigForm";
import StatusControls from "../components/labels/StatusControls";
import VialPreview from "../components/product3d/VialPreview";
import { getProductsAuthoritative, getVariantsAuthoritative } from "../lib/catalog";
import { createDefaultConfig } from "../lib/labels/types";
import { LABEL_PRESETS } from "../lib/labels/presets";
import { TEMPLATES, renderLabelSvg } from "../lib/labels/renderLabelSvg";
import { labelPngBlob, downloadBlob } from "../lib/labels/rasterize";
import { listLabelConfigs, createLabelConfig, patchLabelConfig, getLabelMatrix } from "../lib/labelsApi";
import CatalogMatrix from "../components/labels/CatalogMatrix";

const TEMPLATE_OPTIONS = Object.values(TEMPLATES).map((t) => ({ id: t.id, name: t.name }));

export default function LabelStudio() {
  const [configs, setConfigs] = useState([]);
  const [products, setProducts] = useState([]);
  const [variants, setVariants] = useState([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState(null);
  const [catalogErr, setCatalogErr] = useState(null); // strict products read failed

  const [selectedId, setSelectedId] = useState(null);
  const [draft, setDraft] = useState(null); // local edits of the selected config
  const [dirty, setDirty] = useState(false);
  const [saving, setSaving] = useState(false);

  const [presetId, setPresetId] = useState("full_wrap");
  const [view, setView] = useState("flat"); // flat | guides | vial
  const [newProductId, setNewProductId] = useState("");
  const [newVariantId, setNewVariantId] = useState("");
  const [showMatrix, setShowMatrix] = useState(false);
  const [matrix, setMatrix] = useState(null);

  const refreshMatrix = async () => {
    try {
      const [m, lc] = await Promise.all([getLabelMatrix(), listLabelConfigs()]);
      setMatrix(m);
      setConfigs(lc.configs || []);
    } catch (e) {
      setErr(e.message);
    }
  };
  useEffect(() => {
    if (showMatrix && !matrix) refreshMatrix();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [showMatrix]);

  const load = () => {
    setLoading(true);
    // Products come from the STRICT catalog read (the exact table the
    // label_configs FK references, no bundled-catalog fallback) so the picker
    // can never offer ids this database doesn't have.
    Promise.all([listLabelConfigs(), getProductsAuthoritative()])
      .then(([lc, p]) => {
        setConfigs(lc.configs || []);
        setProducts(p.rows || []);
        setCatalogErr(p.error);
        setErr(null);
      })
      .catch((e) => setErr(e.message))
      .finally(() => setLoading(false));
  };
  useEffect(load, []);

  // Variants for the "new label" product picker (strict read — see above).
  useEffect(() => {
    let alive = true;
    if (!newProductId) {
      setVariants([]);
      return;
    }
    getVariantsAuthoritative(newProductId).then((v) => alive && setVariants(v.rows || []));
    return () => {
      alive = false;
    };
  }, [newProductId]);

  const selected = useMemo(() => configs.find((c) => c.id === selectedId) || null, [configs, selectedId]);

  useEffect(() => {
    setDraft(selected ? { ...selected } : null);
    setDirty(false);
    if (selected?.default_preset) setPresetId(selected.default_preset);
  }, [selectedId, selected]);

  const updateDraft = (next) => {
    setDraft(next);
    setDirty(true);
  };

  const applySaved = (savedConfig) => {
    setConfigs((cs) => cs.map((c) => (c.id === savedConfig.id ? savedConfig : c)));
    setDraft({ ...savedConfig });
    setDirty(false);
  };

  const save = async () => {
    if (!draft?.id) return;
    setSaving(true);
    setErr(null);
    try {
      const { id, ...fields } = draft;
      const r = await patchLabelConfig(id, { ...fields, template_id: draft.template_id, default_preset: presetId });
      applySaved(r.config);
    } catch (e) {
      setErr(e.message);
    } finally {
      setSaving(false);
    }
  };

  const createNew = async () => {
    const product = products.find((p) => p.id === newProductId);
    if (!product) return;
    const variant = variants.find((v) => v.id === newVariantId) || null;
    setErr(null);
    try {
      const seed = createDefaultConfig({ product, variant });
      const r = await createLabelConfig(seed);
      setConfigs((cs) => [r.config, ...cs]);
      setSelectedId(r.config.id);
      setNewProductId("");
      setNewVariantId("");
    } catch (e) {
      setErr(e.message);
    }
  };

  const exportSvg = async () => {
    if (!draft) return;
    setErr(null);
    try {
      const svg = await renderLabelSvg(draft, { templateId: draft.template_id, presetId, siteUrl: window.location.origin });
      downloadBlob(new Blob([svg], { type: "image/svg+xml" }), `noir-label-${draft.sku || draft.id}-${presetId}.svg`);
    } catch (e) {
      setErr(e.message); // e.g. LabelOverflowError — value must be shortened
    }
  };

  const exportPng = async () => {
    if (!draft) return;
    setErr(null);
    try {
      const svg = await renderLabelSvg(draft, { templateId: draft.template_id, presetId, siteUrl: window.location.origin });
      const preset = LABEL_PRESETS[presetId];
      const blob = await labelPngBlob(svg, preset.widthMm, 300);
      downloadBlob(blob, `noir-label-${draft.sku || draft.id}-${presetId}-300dpi.png`);
    } catch (e) {
      setErr(e.message);
    }
  };

  const [pdfBusy, setPdfBusy] = useState(false);
  const exportPdf = async () => {
    if (!draft || pdfBusy) return;
    setPdfBusy(true);
    setErr(null);
    try {
      // pdf-lib + the export module load lazily (vendor-pdf chunk).
      const { labelPdfBlob } = await import("../lib/labels/pdfExport.js");
      const blob = await labelPdfBlob(draft, { templateId: draft.template_id, presetId, siteUrl: window.location.origin });
      downloadBlob(blob, `noir-label-${draft.sku || draft.id}-${presetId}-print.pdf`);
    } catch (e) {
      setErr(`PDF export failed: ${e.message}`);
    } finally {
      setPdfBusy(false);
    }
  };

  const field =
    "rounded-lg border border-white/12 bg-white/[0.03] px-3 py-2 text-se-bone text-[13px] focus:border-se-gold focus:outline-none";

  return (
    <>
      <SEO title="Label Studio | Noir Peptides" noindex />
      <div className="bg-se-black text-se-bone min-h-screen pt-28 pb-24">
        <div className="content-wide">
          <div className="flex items-center justify-between mb-6 gap-4 flex-wrap">
            <div>
              <p className="text-overline mb-2">Admin</p>
              <h1 className="font-display font-extrabold text-[clamp(1.6rem,4vw,2.6rem)] tracking-[0.02em]">Label Studio</h1>
              <p className="text-[12px] text-se-bone/45 font-accent mt-1 max-w-xl">
                RUO vial-label review. Drafts never publish; only Approved / Production Ready labels may render
                outside this studio.
              </p>
            </div>
            <div className="flex gap-2">
              <button type="button" onClick={() => setShowMatrix((v) => !v)} className={showMatrix ? "btn-primary" : "btn-outline"}>
                Catalog matrix
              </button>
              <Link to="/admin" className="btn-outline">Control Room</Link>
            </div>
          </div>

          {err && <p className="mb-4 text-[13px] text-red-300">{err}</p>}

          {showMatrix && (
            <div className="mb-6">
              <CatalogMatrix
                matrix={matrix}
                onRefresh={refreshMatrix}
                busyId={selectedId}
                onSelectConfig={(id) => {
                  setSelectedId(id);
                  setShowMatrix(false);
                }}
              />
            </div>
          )}

          <div className="grid lg:grid-cols-[280px_1fr] gap-6">
            {/* Left rail: configs + creator */}
            <div className="space-y-4">
              <div className="glass-panel p-4 space-y-2">
                <p className="text-label text-se-gold flex items-center gap-1.5"><Plus size={13} /> New label</p>
                {catalogErr ? (
                  <p className="text-[12px] text-red-300 leading-relaxed">
                    Product catalog unreachable in this environment: {catalogErr}. Label
                    creation is disabled until the database is readable.
                  </p>
                ) : !loading && products.length === 0 ? (
                  <p className="text-[12px] text-amber-300 leading-relaxed">
                    No products exist in this environment&apos;s database — seed the catalog
                    first (supabase/migrations/0009_tier1_catalog.sql), or check that this
                    deployment&apos;s Supabase env vars point at the intended project. Label
                    creation is disabled.
                  </p>
                ) : (
                  <select className={`${field} w-full`} value={newProductId} onChange={(e) => setNewProductId(e.target.value)}>
                    <option value="">{loading ? "Loading products…" : "Select product…"}</option>
                    {products.map((p) => (
                      <option key={p.id} value={p.id}>{p.name}</option>
                    ))}
                  </select>
                )}
                {variants.length > 0 && (
                  <select className={`${field} w-full`} value={newVariantId} onChange={(e) => setNewVariantId(e.target.value)}>
                    <option value="">All sizes / pick variant…</option>
                    {variants.map((v) => (
                      <option key={v.id} value={v.id}>{v.size_label || `${v.vial_size_mg} mg`}</option>
                    ))}
                  </select>
                )}
                <button
                  onClick={createNew}
                  disabled={!newProductId || products.length === 0 || Boolean(catalogErr)}
                  className="btn-primary w-full justify-center disabled:opacity-40"
                >
                  Create draft
                </button>
              </div>

              <div className="glass-panel divide-y divide-white/5 max-h-[480px] overflow-y-auto">
                {loading ? (
                  <p className="p-4 text-se-steel text-sm">Loading…</p>
                ) : configs.length === 0 ? (
                  <p className="p-4 text-se-bone/50 text-sm">No label configs yet — create the first draft above.</p>
                ) : (
                  configs.map((c) => (
                    <button
                      key={c.id}
                      onClick={() => setSelectedId(c.id)}
                      className={`w-full text-left p-3 hover:bg-white/[0.03] transition ${c.id === selectedId ? "bg-white/[0.04]" : ""}`}
                    >
                      <p className="text-[13px] text-se-bone truncate flex items-center gap-1.5">
                        <Tag size={12} className="text-se-gold shrink-0" />
                        {c.display_name} <span className="text-se-steel">{c.quantity_label}</span>
                      </p>
                      <p className="text-[11px] text-se-steel font-accent">
                        {c.template_id} · {c.status} · v{c.label_version}
                      </p>
                    </button>
                  ))
                )}
              </div>
            </div>

            {/* Main: preview + editor */}
            {!draft ? (
              <div className="glass-panel p-10 text-center text-se-bone/50">
                Select or create a label config to begin.
              </div>
            ) : (
              <div className="space-y-6">
                {/* Template + preset + view switchers */}
                <div className="flex flex-wrap items-center gap-3">
                  <select
                    className={field}
                    value={draft.template_id}
                    onChange={(e) => updateDraft({ ...draft, template_id: e.target.value })}
                  >
                    {TEMPLATE_OPTIONS.map((t) => (
                      <option key={t.id} value={t.id}>{t.name}</option>
                    ))}
                  </select>
                  <div className="flex gap-1 border border-white/10 rounded-lg p-1">
                    {Object.values(LABEL_PRESETS).map((p) => (
                      <button
                        key={p.id}
                        onClick={() => setPresetId(p.id)}
                        className={`px-2.5 py-1 rounded text-[11px] font-accent uppercase tracking-wide ${presetId === p.id ? "bg-se-gold text-se-black" : "text-se-bone/60 hover:text-se-bone"}`}
                      >
                        {p.id.replace("_", " ")}
                      </button>
                    ))}
                  </div>
                  <div className="flex gap-1 border border-white/10 rounded-lg p-1">
                    {["flat", "guides", "vial"].map((v) => (
                      <button
                        key={v}
                        onClick={() => setView(v)}
                        className={`px-2.5 py-1 rounded text-[11px] font-accent uppercase tracking-wide ${view === v ? "bg-se-gold text-se-black" : "text-se-bone/60 hover:text-se-bone"}`}
                      >
                        {v === "vial" ? "3D vial" : v}
                      </button>
                    ))}
                  </div>
                  <div className="ml-auto flex gap-2">
                    <button onClick={exportSvg} className="btn-outline" title="Editable vector master">
                      <Download size={14} /> SVG
                    </button>
                    <button onClick={exportPng} className="btn-outline" title="300-DPI raster">
                      <FileImage size={14} /> PNG
                    </button>
                    <button onClick={exportPdf} disabled={pdfBusy} className="btn-outline disabled:opacity-40" title="Print-ready PDF: bleed artwork, crop marks, slug line">
                      <FileText size={14} /> {pdfBusy ? "PDF…" : "PDF"}
                    </button>
                    <button onClick={save} disabled={!dirty || saving} className="btn-primary disabled:opacity-40">
                      <Save size={14} /> {saving ? "Saving…" : "Save"}
                    </button>
                  </div>
                </div>

                {/* Preview */}
                {view === "vial" ? (
                  <VialPreview config={draft} templateId={draft.template_id} />
                ) : (
                  <LabelPreview config={draft} templateId={draft.template_id} presetId={presetId} showGuides={view === "guides"} />
                )}
                <p className="text-[11px] text-se-steel font-accent">
                  {LABEL_PRESETS[presetId].name}: {LABEL_PRESETS[presetId].widthMm}×{LABEL_PRESETS[presetId].heightMm} mm ·
                  bleed {LABEL_PRESETS[presetId].bleedMm} mm · safe {LABEL_PRESETS[presetId].safeMm} mm
                  {LABEL_PRESETS[presetId].overlapMm ? ` · wrap overlap ${LABEL_PRESETS[presetId].overlapMm} mm` : ""} ·
                  300 DPI export
                </p>

                {/* Workflow + form */}
                <div className="glass-panel p-5">
                  <StatusControls config={selected} onSaved={applySaved} />
                </div>
                <div className="glass-panel p-5">
                  <LabelConfigForm config={draft} onChange={updateDraft} />
                </div>

                {/* Verification summary */}
                <div className="glass-panel p-5 text-[12.5px] text-se-bone/60 font-accent space-y-1">
                  <p>
                    QR destination:{" "}
                    <span className="font-mono text-se-gold">
                      {draft.verification_code ? `${window.location.origin}/v/${draft.verification_code}` : "assigned on create"}
                    </span>
                  </p>
                  <p>Barcode: Code 128 · encodes <span className="font-mono">{draft.barcode_value || "(unset — defaults blank)"}</span></p>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </>
  );
}
