// src/components/QrCode.jsx
// Self-hosted QR code, rendered to a data-URL on the client. The `qrcode`
// library is dynamically imported so it never lands in the main bundle — it
// loads only on the COA / lot-verification surfaces that actually show a QR.
import { useEffect, useState } from "react";

export default function QrCode({ value, size = 128, className = "", alt }) {
  const [src, setSrc] = useState(null);

  useEffect(() => {
    let alive = true;
    if (!value) {
      setSrc(null);
      return;
    }
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
  }, [value, size]);

  if (!src) {
    return (
      <div
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
