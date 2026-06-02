// src/components/PeptideSpecsPanel.jsx
// Technical specification panel for a research peptide. Mono font for
// values. Missing values render as "—" gracefully.
import React from "react";

function Row({ label, value }) {
  const display =
    value === null || value === undefined || value === "" ? "—" : value;
  return (
    <div className="flex items-start justify-between gap-6 py-3 border-b border-se-concrete/60">
      <span className="text-[11px] font-accent uppercase tracking-[0.16em] text-se-steel shrink-0">
        {label}
      </span>
      <span className="text-[12px] font-accent text-se-bone text-right break-all">
        {display}
      </span>
    </div>
  );
}

export default function PeptideSpecsPanel({ product = {} }) {
  const purity =
    product.purity_percent !== undefined && product.purity_percent !== null
      ? `≥ ${product.purity_percent}% (HPLC)`
      : null;

  return (
    <div className="glass-panel">
      <div className="px-5 py-4 border-b border-se-concrete">
        <p className="text-[11px] font-accent uppercase tracking-[0.2em] text-se-gold">
          Technical Specification
        </p>
      </div>
      <div className="px-5 pb-4">
        <Row label="Batch Number" value={product.batch_number} />
        <Row label="Peptide Sequence" value={product.peptide_sequence} />
        <Row label="Molecular Weight" value={product.molecular_weight} />
        <Row label="Purity" value={purity} />
        <Row label="Form" value={product.form} />
        <Row label="Storage" value={product.storage_temp} />
        <Row
          label="Vial Size"
          value={product.vial_size_mg ? `${product.vial_size_mg} mg` : null}
        />
        <Row label="CAS Number" value={product.cas_number} />
        <div className="flex items-start justify-between gap-6 py-3">
          <span className="text-[11px] font-accent uppercase tracking-[0.16em] text-se-steel shrink-0">
            Research Use Only
          </span>
          <span className="text-[12px] font-accent text-se-gold text-right">
            {product.research_use_only === false ? "—" : "Yes"}
          </span>
        </div>
      </div>
    </div>
  );
}
