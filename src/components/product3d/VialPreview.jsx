// src/components/product3d/VialPreview.jsx
// Gate + graceful-degradation wrapper for the 3D vial. Loads the heavy
// three.js scene ONLY when visible (IntersectionObserver) and only when the
// device supports WebGL; prefers-reduced-motion disables auto-rotation; any
// failure falls back to the flat front label render. A visually-hidden summary
// exposes the label content to screen readers — the 3D scene is never the only
// access path to product information.
import { lazy, Suspense, useEffect, useRef, useState } from "react";
import LabelPreview from "../labels/LabelPreview";
import { storageLineFor } from "../../lib/labels/storage";
import { RUO_PRIMARY_WARNING } from "../../../lib/labelConstants";

const VialScene = lazy(() => import("./VialScene"));

function webglSupported() {
  try {
    const c = document.createElement("canvas");
    return !!(c.getContext("webgl2") || c.getContext("webgl"));
  } catch {
    return false;
  }
}

export default function VialPreview({ config, templateId, accent }) {
  const hostRef = useRef(null);
  const [visible, setVisible] = useState(false);
  const [supported, setSupported] = useState(true);
  const [reducedMotion, setReducedMotion] = useState(false);

  useEffect(() => {
    setSupported(webglSupported());
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    setReducedMotion(mq.matches);
    const onChange = (e) => setReducedMotion(e.matches);
    mq.addEventListener?.("change", onChange);
    return () => mq.removeEventListener?.("change", onChange);
  }, []);

  useEffect(() => {
    const el = hostRef.current;
    if (!el) return undefined;
    const io = new IntersectionObserver(
      (entries) => entries.forEach((e) => e.isIntersecting && setVisible(true)),
      { rootMargin: "160px" }
    );
    io.observe(el);
    return () => io.disconnect();
  }, []);

  const fallback = (
    <div>
      <LabelPreview config={config} templateId={templateId} presetId="front" />
      <p className="mt-2 text-[11px] text-se-steel font-accent">
        Static label preview{supported ? "" : " (3D not supported on this device)"}.
      </p>
    </div>
  );

  return (
    <div ref={hostRef}>
      {/* Screen-reader summary of the vial label */}
      <p className="sr-only">
        Interactive 3D preview of a 10 milliliter research vial. Label: Noir Peptides, {config?.display_name}{" "}
        {config?.quantity_label}, {config?.material_type || "research material"}. Lot {config?.lot_number || "pending"}.{" "}
        {storageLineFor(config)} {RUO_PRIMARY_WARNING}
      </p>
      {!supported ? (
        fallback
      ) : !visible ? (
        <div className="rounded-xl border border-white/10 se-skeleton" style={{ height: 420 }} aria-hidden="true" />
      ) : (
        <Suspense fallback={<div className="rounded-xl border border-white/10 se-skeleton" style={{ height: 420 }} aria-hidden="true" />}>
          <VialScene config={config} templateId={templateId} accent={accent} reducedMotion={reducedMotion} />
        </Suspense>
      )}
    </div>
  );
}
