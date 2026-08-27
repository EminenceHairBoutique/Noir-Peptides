// src/components/product3d/MediaGallery.jsx
// Swipeable PDP media gallery (MOBILE_ROADMAP #9). Slides are strictly
// renders of the APPROVED label config — the interactive 3D vial plus the
// label engine's flat front and full-wrap views. No product photography
// exists in the catalog and nothing here invents any.
//
// CSS scroll-snap does the swiping — no gesture library. Note the 3D slide's
// canvas claims horizontal drags for rotation (touch-action: pan-y), which is
// intended: swiping ON the vial rotates it; the dots (and swipes that start
// outside the canvas) change slides.
import { useEffect, useRef, useState } from "react";
import VialPreview from "./VialPreview";
import LabelPreview from "../labels/LabelPreview";

export default function MediaGallery({ vialLabel }) {
  const scrollerRef = useRef(null);
  const [active, setActive] = useState(0);

  const slides = [
    { key: "vial", name: "Interactive 3D vial" },
    { key: "front", name: "Label — front panel" },
    { key: "wrap", name: "Label — full wrap" },
  ];

  // Track the visible slide from scroll position (rAF-throttled).
  useEffect(() => {
    const el = scrollerRef.current;
    if (!el) return undefined;
    let raf = 0;
    const onScroll = () => {
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(() => {
        setActive(Math.round(el.scrollLeft / Math.max(1, el.clientWidth)));
      });
    };
    el.addEventListener("scroll", onScroll, { passive: true });
    return () => {
      el.removeEventListener("scroll", onScroll);
      cancelAnimationFrame(raf);
    };
  }, []);

  const goTo = (i) => {
    const el = scrollerRef.current;
    if (!el) return;
    const reduced = window.matchMedia?.("(prefers-reduced-motion: reduce)")?.matches;
    el.scrollTo({ left: i * el.clientWidth, behavior: reduced ? "auto" : "smooth" });
  };

  return (
    <div
      role="region"
      aria-roledescription="carousel"
      aria-label="Product media"
      className="h-full w-full"
    >
      <div
        ref={scrollerRef}
        className="flex h-full w-full overflow-x-auto snap-x snap-mandatory scrollbar-hide"
      >
        {slides.map((s, i) => (
          <div
            key={s.key}
            role="group"
            aria-roledescription="slide"
            aria-label={`${i + 1} of ${slides.length} — ${s.name}`}
            className="h-full w-full shrink-0 snap-center"
          >
            {s.key === "vial" ? (
              <div className="h-full w-full p-2">
                <VialPreview config={vialLabel} templateId={vialLabel.template_id} />
              </div>
            ) : (
              <div className="h-full w-full flex items-center justify-center p-4 overflow-y-auto">
                <LabelPreview
                  config={vialLabel}
                  templateId={vialLabel.template_id}
                  presetId={s.key === "front" ? "front" : "full_wrap"}
                />
              </div>
            )}
          </div>
        ))}
      </div>

      {/* Dot navigation — inside the fixed square (absolute), so appearing
          with the gallery can never shift page layout. lg keeps clear of the
          caption overlay at bottom-0. */}
      <div className="absolute inset-x-0 bottom-2 lg:bottom-10 flex justify-center gap-2 pointer-events-none">
        {slides.map((s, i) => (
          <button
            key={s.key}
            type="button"
            onClick={() => goTo(i)}
            aria-label={`Show slide ${i + 1}: ${s.name}`}
            aria-current={active === i ? "true" : undefined}
            className="pointer-events-auto p-2 -m-1 group"
          >
            <span
              aria-hidden="true"
              className={`block h-1.5 rounded-full transition-all ${
                active === i ? "w-5 bg-se-gold" : "w-1.5 bg-se-steel/60 group-hover:bg-se-bone/60"
              }`}
            />
          </button>
        ))}
      </div>
    </div>
  );
}
