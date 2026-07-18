// src/lib/labels/rasterize.js
// BROWSER-ONLY. Rasterizes a label SVG (from renderLabelSvg) to a canvas —
// used for the 3D vial texture and for 300-DPI PNG export. Injects the
// embedded-font prefix (fontEmbed.js) so text renders in brand typography
// inside the restricted-mode Image load. Object URLs are revoked in both
// onload and onerror.

import { getFontEmbedPrefix } from "./fontEmbed.js";

/**
 * Rasterize an SVG string to a canvas.
 * @param {string} svg           SVG markup from renderLabelSvg()
 * @param {number} targetWidth   Canvas width in px (height follows viewBox aspect)
 * @returns {Promise<HTMLCanvasElement>}
 */
export async function rasterizeLabelSvg(svg, targetWidth = 2048) {
  const prefix = await getFontEmbedPrefix();
  // Inject the font <style> right after the opening <svg …> tag.
  const withFonts = svg.replace(/(<svg[^>]*>)/, `$1${prefix}`);

  const vb = /viewBox="0 0 (\d+(?:\.\d+)?) (\d+(?:\.\d+)?)"/.exec(svg);
  const vw = vb ? Number(vb[1]) : 720;
  const vh = vb ? Number(vb[2]) : 300;
  const width = Math.round(targetWidth);
  const height = Math.round((vh / vw) * width);

  const blob = new Blob([withFonts], { type: "image/svg+xml;charset=utf-8" });
  const url = URL.createObjectURL(blob);

  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      URL.revokeObjectURL(url);
      try {
        const canvas = document.createElement("canvas");
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext("2d");
        ctx.drawImage(img, 0, 0, width, height);
        resolve(canvas);
      } catch (e) {
        reject(e);
      }
    };
    img.onerror = (e) => {
      URL.revokeObjectURL(url);
      reject(e instanceof Error ? e : new Error("rasterizeLabelSvg: SVG image failed to load"));
    };
    img.src = url;
  });
}

/**
 * Export a label SVG as a PNG blob at print resolution.
 * @param {string} svg
 * @param {number} widthMm  Physical label width (px = mm/25.4*dpi)
 * @param {number} dpi
 */
export async function labelPngBlob(svg, widthMm, dpi = 300) {
  const px = Math.round((widthMm / 25.4) * dpi);
  const canvas = await rasterizeLabelSvg(svg, px);
  return new Promise((resolve, reject) => {
    canvas.toBlob((b) => (b ? resolve(b) : reject(new Error("PNG export failed"))), "image/png");
  });
}

/** Trigger a client download of a Blob (SVG/PNG export buttons). */
export function downloadBlob(blob, filename) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 2000);
}
