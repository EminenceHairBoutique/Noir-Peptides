// src/components/RecentlyViewed.jsx
// PDP strip of products the researcher opened earlier this session/device.
// Reads slugs from localStorage (lib/recentlyViewed) and resolves them
// against the catalog (which already falls back to the bundled static data),
// so the strip works even when Supabase is unreachable. Renders nothing when
// there's no history — no empty-state noise.
import { useEffect, useState } from "react";
import { getProducts } from "../lib/catalog";
import { getRecentlyViewedSlugs } from "../lib/recentlyViewed";
import ProductCard from "./ProductCard";

export default function RecentlyViewed({ excludeSlug }) {
  const [items, setItems] = useState([]);

  useEffect(() => {
    let active = true;
    const slugs = getRecentlyViewedSlugs(excludeSlug);
    if (!slugs.length) {
      setItems([]);
      return undefined;
    }
    getProducts()
      .then((all) => {
        if (!active) return;
        const bySlug = new Map((all || []).map((p) => [p.slug, p]));
        setItems(slugs.map((s) => bySlug.get(s)).filter(Boolean).slice(0, 4));
      })
      .catch(() => {});
    return () => {
      active = false;
    };
  }, [excludeSlug]);

  if (!items.length) return null;

  return (
    <section className="section-pad border-t border-se-concrete">
      <div className="content-wide">
        <h2 className="font-display text-xl tracking-[0.04em] text-se-bone mb-10">
          RECENTLY VIEWED
        </h2>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-5">
          {items.map((p) => (
            <ProductCard key={p.id} product={p} />
          ))}
        </div>
      </div>
    </section>
  );
}
