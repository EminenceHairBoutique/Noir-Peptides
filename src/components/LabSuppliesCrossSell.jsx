// src/components/LabSuppliesCrossSell.jsx
// Laboratory consumables offered alongside the cart (Task 8).
//
// COMPLIANCE: these are listed as catalogue items a laboratory may want to
// order in the same shipment. Nothing here states or implies what they are for
// in relation to the peptides — no reconstitution step, no ratio, no protocol,
// no "you will need this to use your order". That framing is the line between
// selling a consumable and giving usage guidance, and this component stays on
// the selling side of it.
//
// Renders NOTHING when no products are marked product_type = 'lab_supply'
// (the default: migration 0033 seeds none), when everything on offer is
// already in the cart, or when a supply has no purchasable variant — the
// server re-prices from a variant, so an item without one could not be bought.
import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Plus } from "lucide-react";
import { useCart } from "../context/CartContext";
import { getLabSupplies, getVariants } from "../lib/catalog";

const money = (n) => `$${Number(n || 0).toLocaleString(undefined, { maximumFractionDigits: 2 })}`;

export default function LabSuppliesCrossSell({ cartList = [] }) {
  const { addToCart } = useCart();
  const [offers, setOffers] = useState([]);

  useEffect(() => {
    let alive = true;
    (async () => {
      const supplies = await getLabSupplies();
      if (!alive || !supplies.length) return;
      // Pair each supply with its cheapest purchasable variant.
      const withVariants = await Promise.all(
        supplies.map(async (p) => {
          const variants = await getVariants(p.id);
          const variant = variants.find((v) => v.stock_status !== "out_of_stock") || null;
          return variant ? { product: p, variant } : null;
        })
      );
      if (alive) setOffers(withVariants.filter(Boolean));
    })();
    return () => {
      alive = false;
    };
  }, []);

  const inCart = new Set(cartList.map((i) => i.variantId).filter(Boolean));
  const visible = offers.filter((o) => !inCart.has(o.variant.id));
  if (!visible.length) return null;

  return (
    <section className="mt-10" aria-labelledby="lab-supplies-heading" data-testid="lab-supplies-crosssell">
      <h2 id="lab-supplies-heading" className="font-display text-[14px] tracking-[0.1em] text-se-bone">
        LABORATORY CONSUMABLES
      </h2>
      <p className="mt-1 text-[12px] font-accent text-se-steel">
        Available to add to this shipment.
      </p>
      <ul className="mt-4 divide-y divide-white/10 border-y border-white/10">
        {visible.map(({ product, variant }) => (
          <li key={variant.id} className="flex items-center justify-between gap-4 py-3">
            <div className="min-w-0">
              <Link
                to={`/product/${product.slug}`}
                className="block text-[13.5px] text-se-bone hover:text-se-gold transition truncate"
              >
                {product.name}
              </Link>
              <span className="text-[12px] font-accent text-se-steel">
                {variant.size_label || variant.sku}
                {" · "}
                {money(variant.price)}
              </span>
            </div>
            <button
              type="button"
              onClick={() =>
                addToCart(product, {
                  variantId: variant.id,
                  sku: variant.sku,
                  sizeLabel: variant.size_label,
                  basePrice: variant.price,
                  quantity: 1,
                })
              }
              className="shrink-0 inline-flex items-center gap-1.5 min-h-[44px] px-4 border border-se-concrete hover:border-se-gold/50 text-[12px] font-accent text-se-bone transition"
            >
              <Plus className="w-3.5 h-3.5" aria-hidden="true" />
              Add
            </button>
          </li>
        ))}
      </ul>
    </section>
  );
}
