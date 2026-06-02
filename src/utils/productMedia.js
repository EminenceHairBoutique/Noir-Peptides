// src/utils/productMedia.js
//
// ✅ Single image/media convention helper.
//
// Recommended convention (so every product folder follows the same pattern):
//   /public/assets/products/<productSlug>/
//     - 01.webp  (primary)
//     - 02.webp  (optional)
//     - 03.webp  (optional)
//     - video.mp4 (optional)
//
// A product can either provide an explicit `images: []` array OR declare:
//   - imageFolder: "/assets/products/<slug>"  (or "/gallery/..." etc)
//   - imageCount: 3
//   - video: "/assets/products/<slug>/video.mp4" (optional)

const pad2 = (n) => String(n).padStart(2, "0");

export function resolveProductImages(product) {
  if (!product) return [];

  // 1) Explicit images win (backwards compatible)
  if (Array.isArray(product.images) && product.images.length) {
    return product.images.filter(Boolean);
  }

  // 2) Convention-driven images
  const folder =
    product.imageFolder ||
    product.mediaFolder ||
    product.mediaBase ||
    (product.slug ? `/assets/products/${product.slug}` : null);

  const count =
    Number(product.imageCount || product.mediaCount || product.media?.imageCount || product.media?.images || 0) ||
    0;

  if (!folder || count <= 0) return [];

  // Use 01.webp, 02.webp, 03.webp...
  return Array.from({ length: count }, (_, i) => `${folder}/${pad2(i + 1)}.webp`);
}

export function resolveProductVideo(product) {
  if (!product) return null;
  return (
    product.video ||
    product.videoSrc ||
    product.media?.video ||
    (product.slug ? `/assets/products/${product.slug}/video.mp4` : null)
  );
}
