// src/components/labels/StatusControls.jsx
// Approval workflow: current status badge, allowed transitions (from the
// shared STATUS_TRANSITIONS map), revision notes, and version history with
// restore. Draft labels are never publishable — messaging makes the
// publishing rule explicit.
import { useEffect, useState } from "react";
import { STATUS_TRANSITIONS, canRenderOutsideStudio } from "../../../lib/labelConstants";
import { getLabelHistory, patchLabelConfig } from "../../lib/labelsApi";

const STATUS_STYLES = {
  draft: "border-white/15 bg-white/5 text-se-steel",
  in_review: "border-cyan-500/30 bg-cyan-500/10 text-cyan-300",
  changes_requested: "border-amber-500/30 bg-amber-500/10 text-amber-300",
  approved: "border-emerald-500/30 bg-emerald-500/10 text-emerald-300",
  production_ready: "border-emerald-500/50 bg-emerald-500/20 text-emerald-200",
  archived: "border-white/10 bg-white/5 text-se-steel/60",
};

const LABELS = {
  draft: "Draft",
  in_review: "In Review",
  changes_requested: "Changes Requested",
  approved: "Approved",
  production_ready: "Production Ready",
  archived: "Archived",
};

export default function StatusControls({ config, onSaved }) {
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState(null);
  const [notes, setNotes] = useState(config?.revision_notes || "");
  const [history, setHistory] = useState([]);
  const [showHistory, setShowHistory] = useState(false);

  useEffect(() => {
    setNotes(config?.revision_notes || "");
  }, [config?.id, config?.revision_notes]);

  const transitions = STATUS_TRANSITIONS[config?.status] || [];

  const move = async (status) => {
    setBusy(true);
    setErr(null);
    try {
      const r = await patchLabelConfig(config.id, { status, revision_notes: notes });
      onSaved(r.config);
    } catch (e) {
      setErr(e.message);
    } finally {
      setBusy(false);
    }
  };

  const loadHistory = async () => {
    setShowHistory((s) => !s);
    if (!history.length) {
      try {
        const r = await getLabelHistory(config.id);
        setHistory(r.history || []);
      } catch (e) {
        setErr(e.message);
      }
    }
  };

  const restore = async (snap) => {
    setBusy(true);
    setErr(null);
    try {
      const { id: _id, status: _s, verification_code: _v, ...fields } = snap.snapshot || {};
      const r = await patchLabelConfig(config.id, fields);
      onSaved(r.config);
    } catch (e) {
      setErr(e.message);
    } finally {
      setBusy(false);
    }
  };

  if (!config?.id) return null;

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2 flex-wrap">
        <span className={`rounded-full border px-3 py-1 text-[11px] uppercase tracking-wide ${STATUS_STYLES[config.status]}`}>
          {LABELS[config.status]} · v{config.label_version}
        </span>
        {!canRenderOutsideStudio(config.status) && (
          <span className="text-[11px] text-se-steel">Not publishable — approval required before any customer surface.</span>
        )}
      </div>

      <textarea
        value={notes}
        onChange={(e) => setNotes(e.target.value)}
        rows={2}
        placeholder="Revision notes (kept with the status change)…"
        className="w-full rounded-lg border border-white/12 bg-white/[0.03] px-3 py-2 text-se-bone text-[13px] focus:border-se-gold focus:outline-none"
      />

      <div className="flex flex-wrap gap-2">
        {transitions.map((t) => (
          <button
            key={t}
            onClick={() => move(t)}
            disabled={busy}
            className={`text-[12px] rounded border px-3 py-1.5 disabled:opacity-40 ${
              t === "approved" || t === "production_ready"
                ? "border-emerald-500/30 text-emerald-300 hover:bg-emerald-500/10"
                : t === "changes_requested" || t === "archived"
                ? "border-amber-500/30 text-amber-300 hover:bg-amber-500/10"
                : "border-white/15 text-se-bone/80 hover:bg-white/5"
            }`}
          >
            → {LABELS[t]}
          </button>
        ))}
      </div>

      {err && <p className="text-[12px] text-red-300">{err}</p>}

      <button onClick={loadHistory} className="text-[12px] text-se-steel hover:text-se-gold">
        {showHistory ? "Hide" : "Show"} version history
      </button>
      {showHistory && (
        <div className="max-h-56 overflow-y-auto space-y-2">
          {history.map((h) => (
            <div key={h.id} className="flex items-center justify-between gap-2 rounded-lg border border-white/10 bg-white/[0.02] px-3 py-2">
              <span className="text-[12px] text-se-bone/60 font-mono">
                {h.action} · {new Date(h.created_at).toLocaleString()}
              </span>
              <button onClick={() => restore(h)} disabled={busy} className="text-[11px] text-se-gold hover:underline disabled:opacity-40">
                Restore fields
              </button>
            </div>
          ))}
          {!history.length && <p className="text-[12px] text-se-steel">No history yet.</p>}
        </div>
      )}
    </div>
  );
}
