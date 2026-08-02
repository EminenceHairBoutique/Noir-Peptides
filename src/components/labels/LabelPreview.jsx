// src/components/labels/LabelPreview.jsx
// Live flat label preview. Renders the SVG inline in the DOM (crisp — uses the
// page's /fonts @font-face), re-rendering when config/template/preset change.
import { useEffect, useState } from "react";
import { renderLabelSvg } from "../../lib/labels/renderLabelSvg";

export default function LabelPreview({ config, templateId, presetId, showGuides = false, className = "" }) {
  const [svg, setSvg] = useState(null);
  const [err, setErr] = useState(null);

  useEffect(() => {
    let alive = true;
    if (!config) return;
    renderLabelSvg(config, {
      templateId,
      presetId,
      showGuides,
      siteUrl: typeof window !== "undefined" ? window.location.origin : undefined,
    })
      .then((s) => alive && (setSvg(s), setErr(null)))
      .catch((e) => alive && setErr(e.message));
    return () => {
      alive = false;
    };
  }, [config, templateId, presetId, showGuides]);

  if (err) return <p className="text-red-300 text-sm">Preview failed: {err}</p>;
  if (!svg) return <div className="se-skeleton glass-panel h-40" aria-hidden="true" />;
  return (
    <div
      className={`w-full [&>svg]:w-full [&>svg]:h-auto rounded-lg overflow-hidden border border-white/10 ${className}`}
      // Engine output only (our own generated markup, XML-escaped fields).
      dangerouslySetInnerHTML={{ __html: svg }}
    />
  );
}
