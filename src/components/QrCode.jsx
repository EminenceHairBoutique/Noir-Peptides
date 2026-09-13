// src/components/QrCode.jsx
// Self-hosted QR code, rendered to a data-URL on the client. The `qrcode`
// library is dynamically imported so it never lands in the main bundle — and
// (opt cycle 11) the import is deferred until the placeholder is near the
// viewport, so a product page with certificates does not download the encoder
// on first paint; every certificate card below the fold pays nothing until
// the shopper scrolls to it. Fallback: idle time (or 4 s) when the browser
// has no IntersectionObserver.
import { useEffect, useRef, useState } from "react";

const NEAR_VIEWPORT = "200px";

function whenNear(el, cb) {
  if (typeof IntersectionObserver !== "function") {
    const id = typeof requestIdleCallback === "function"
      ? requestIdleCallback(cb, { timeout: 4000 })
      : setTimeout(cb, 1500);
    return () => {
      if (typeof cancelIdleCallback === "function" && typeof requestIdleCallback === "function") cancelIdleCallback(id);
      else clearTimeout(id);
    };
  }
  const io = new IntersectionObserver(
    (entries) => {
      if (entries.some((e) => e.isIntersecting)) {
        io.disconnect();
        cb();
      }
    },
    { rootMargin: NEAR_VIEWPORT }
  );
  io.observe(el);
  return () => io.disconnect();
}

export default function QrCode({ value, size = 128, className = "", alt }) {
  const [src, setSrc] = useState(null);
  const [wanted, setWanted] = useState(false);
  const boxRef = useRef(null);

  useEffect(() => {
    if (!value || wanted) return undefined;
    const el = boxRef.current;
    if (!el) return undefined;
    return whenNear(el, () => setWanted(true));
  }, [value, wanted]);

  useEffect(() => {
    let alive = true;
    if (!value) {
      setSrc(null);
      return;
    }
    if (!wanted) return undefined;
    import("qrcode")
      .then((mod) => {
        const QR = mod.default || mod;
        return QR.toDataURL(String(value), {
          width: size,
          margin: 1,
          errorCorrectionLevel: "M",
          color: { dark: "#05080f", light: "#ffffff" },
        });
      })
      .then((url) => {
        if (alive) setSrc(url);
      })
      .catch(() => {
        if (alive) setSrc(null);
      });
    return () => {
      alive = false;
    };
  }, [value, size, wanted]);

  if (!src) {
    return (
      <div
        ref={boxRef}
        aria-hidden="true"
        style={{ width: size, height: size }}
        className={`bg-white/5 border border-white/10 rounded ${className}`}
      />
    );
  }
  return (
    <img
      src={src}
      width={size}
      height={size}
      alt={alt || `QR code linking to ${value}`}
      className={`rounded bg-white p-1 ${className}`}
    />
  );
}
