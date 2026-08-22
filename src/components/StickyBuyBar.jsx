// src/components/StickyBuyBar.jsx
// Mobile-only sticky purchase bar for the PDP (MOBILE_ROADMAP #1). The product
// page is long on phones and the buy action strands at the top; this surfaces
// it once the inline CTA scrolls out of view.
//
// Behavior:
//   - md:hidden — phones/tablets only; desktop keeps the inline CTA.
//   - Appears only when the inline CTA is NOT in view (IntersectionObserver on
//     a ref the PDP passes in), so it never double-stacks with the real button.
//   - Hidden while the cart drawer is open (avoids a control under the overlay).
//   - env(safe-area-inset-bottom) padding so it clears the iOS home indicator.
//   - A real <button>; aria-hidden + inert-ish (tabIndex -1) while off so a
//     screen reader / keyboard never reaches a hidden duplicate of the CTA.
import React, { useEffect, useRef, useState } from "react";

export default function StickyBuyBar({ ctaRef, name, sizeLabel, priceLabel, isOut, cartOpen, onAdd, onNotify }) {
  const [visible, setVisible] = useState(false);
  const raf = useRef(0);

  useEffect(() => {
    const el = ctaRef?.current;
    if (!el || typeof IntersectionObserver === "undefined") return undefined;
    const io = new IntersectionObserver(
      (entries) => {
        // Show the bar when the inline CTA has scrolled out of view.
        entries.forEach((e) => {
          cancelAnimationFrame(raf.current);
          raf.current = requestAnimationFrame(() => setVisible(!e.isIntersecting));
        });
      },
      { rootMargin: "0px 0px -12px 0px", threshold: 0 }
    );
    io.observe(el);
    return () => { io.disconnect(); cancelAnimationFrame(raf.current); };
  }, [ctaRef]);

  const shown = visible && !cartOpen;

  return (
    <div
      aria-hidden={!shown}
      className={`md:hidden fixed inset-x-0 bottom-0 z-40 transition-transform duration-300 ease-out ${
        shown ? "translate-y-0" : "translate-y-full pointer-events-none"
      }`}
      style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
    >
      <div className="bg-se-charcoal/95 backdrop-blur-md border-t border-se-concrete px-4 py-3 flex items-center gap-3">
        <div className="min-w-0 flex-1">
          <p className="text-[12px] font-accent text-se-bone truncate">{name}</p>
          <p className="text-[11px] font-accent text-se-steel truncate">
            {sizeLabel ? `${sizeLabel} · ` : ""}{priceLabel}
          </p>
        </div>
        {isOut ? (
          <button
            type="button"
            tabIndex={shown ? 0 : -1}
            onClick={onNotify}
            className="btn-outline shrink-0 text-[11px] px-4 min-h-[44px] whitespace-nowrap"
          >
            Notify Me
          </button>
        ) : (
          <button
            type="button"
            tabIndex={shown ? 0 : -1}
            onClick={onAdd}
            className="btn-primary shrink-0 text-[11px] tracking-[0.14em] px-5 min-h-[44px] whitespace-nowrap"
          >
            Add to Cart
          </button>
        )}
      </div>
    </div>
  );
}
