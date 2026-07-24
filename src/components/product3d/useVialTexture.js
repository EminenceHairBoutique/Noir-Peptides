// src/components/product3d/useVialTexture.js
// Builds (and disposes) a THREE.CanvasTexture from the label SVG engine. The
// same renderLabelSvg output that drives the flat preview and print export is
// rasterized (with inlined brand fonts) to a 2048-px canvas — screen, print,
// and 3D always match. Mobile caps at 1024 px to respect GPU/memory limits.
import { useEffect, useState } from "react";
import * as THREE from "three";
import { renderLabelSvg } from "../../lib/labels/renderLabelSvg";
import { rasterizeLabelSvg } from "../../lib/labels/rasterize";

const MOBILE = typeof navigator !== "undefined" && /iPhone|iPad|Android/i.test(navigator.userAgent);
const TEXTURE_WIDTH = MOBILE ? 1024 : 2048;

export default function useVialTexture(config, templateId, presetId = "full_wrap") {
  const [texture, setTexture] = useState(null);

  useEffect(() => {
    let alive = true;
    let tex = null;
    if (!config) return undefined;

    // Debounce: while the admin types in the studio the config object changes
    // per keystroke — wait for a pause before the (expensive) re-rasterize.
    // The previous texture stays on the vial until the new one is ready.
    const timer = setTimeout(async () => {
      try {
        const svg = await renderLabelSvg(config, {
          templateId,
          presetId,
          siteUrl: typeof window !== "undefined" ? window.location.origin : undefined,
        });
        const canvas = await rasterizeLabelSvg(svg, TEXTURE_WIDTH);
        if (!alive) return;
        tex = new THREE.CanvasTexture(canvas);
        tex.colorSpace = THREE.SRGBColorSpace;
        tex.generateMipmaps = true;
        tex.minFilter = THREE.LinearMipmapLinearFilter;
        tex.needsUpdate = true;
        setTexture(tex);
      } catch {
        if (alive) setTexture(null);
      }
    }, 350);

    return () => {
      alive = false;
      clearTimeout(timer);
      if (tex) tex.dispose();
    };
  }, [config, templateId, presetId]);

  return texture;
}
