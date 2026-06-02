// src/components/CartDrawer.jsx — Noir Peptides
import { useEffect, useRef } from "react";
import { Link } from "react-router-dom";
import { X, Minus, Plus, Lock } from "lucide-react";
import { motion as Motion } from "framer-motion";
import { useCart } from "../context/CartContext";
import { DISCLAIMER_COMPACT } from "../config/compliance";

const money = (n) =>
  `$${Number(n).toLocaleString(undefined, { maximumFractionDigits: 0 })}`;

export default function CartDrawer() {
  const {
    isOpen = false,
    closeCart,
    items = [],
    total = 0,
    removeItem = () => {},
    updateQuantity = () => {},
  } = useCart();

  const closeCartRef = useRef(closeCart);
  useEffect(() => { closeCartRef.current = closeCart; }, [closeCart]);

  useEffect(() => {
    if (!isOpen) return;
    const onKey = (e) => { if (e.key === "Escape") closeCartRef.current?.(); };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [isOpen]);

  useEffect(() => {
    document.body.style.overflow = isOpen ? "hidden" : "";
    return () => (document.body.style.overflow = "");
  }, [isOpen]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50">
      <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-40" onClick={closeCart} />

      <Motion.aside
        initial={{ x: "100%" }}
        animate={{ x: 0 }}
        exit={{ x: "100%" }}
        transition={{ type: "spring", stiffness: 260, damping: 28 }}
        className="fixed right-0 top-0 h-full w-full max-w-[420px] z-50 bg-se-charcoal border-l border-white/5 flex flex-col"
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-5 border-b border-white/[0.06]">
          <p className="text-[11px] font-accent tracking-[0.22em] uppercase text-se-bone">
            Cart
          </p>
          <button onClick={closeCart} aria-label="Close cart" className="text-se-steel hover:text-se-bone transition">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Items */}
        <div className="flex-1 overflow-y-auto px-6 py-6 space-y-6">
          {items.length === 0 ? (
            <div className="text-center py-16">
              <p className="text-[13px] text-se-steel font-accent">Your cart is empty.</p>
              <Link to="/shop" onClick={closeCart} className="btn-outline mt-6 text-[10px]">
                Browse Catalog
              </Link>
            </div>
          ) : (
            items.map((item) => (
              <div key={item.cartKey || item.id} className="flex gap-4">
                {item.image ? (
                  <img
                    src={item.image}
                    alt={item.name}
                    className="w-20 h-24 object-cover bg-se-asphalt border border-white/5"
                  />
                ) : (
                  <div
                    className="vial-visual w-20 h-24 border border-se-concrete"
                    aria-hidden="true"
                  />
                )}

                <div className="flex-1 min-w-0">
                  <p className="text-[13px] text-se-bone font-accent truncate">{item.name}</p>

                  <p className="text-[11px] text-se-steel mt-1">
                    {item.size && `Size ${item.size}`}
                    {item.colorway && ` · ${item.colorway}`}
                    {` · Qty ${item.quantity}`}
                  </p>

                  {item.isPreorder && (
                    <p className="mt-1 text-[9px] uppercase tracking-[0.2em] text-se-gold font-accent">
                      Pre-Order
                    </p>
                  )}

                  <div className="mt-3 flex items-center gap-3">
                    <div className="flex items-center border border-white/10">
                      <button
                        onClick={() => updateQuantity(item.id, item.variant, Math.max(1, item.quantity - 1))}
                        className="px-2.5 py-1 text-se-steel hover:text-se-bone transition"
                        type="button"
                      >
                        <Minus size={12} />
                      </button>
                      <span className="px-2 text-[11px] text-se-bone font-accent">{item.quantity}</span>
                      <button
                        onClick={() => updateQuantity(item.id, item.variant, item.quantity + 1)}
                        className="px-2.5 py-1 text-se-steel hover:text-se-bone transition"
                        type="button"
                      >
                        <Plus size={12} />
                      </button>
                    </div>

                    <button
                      onClick={() => removeItem(item.id, item.variant)}
                      className="text-[10px] font-accent uppercase tracking-[0.15em] text-se-steel hover:text-se-bone transition"
                      type="button"
                    >
                      Remove
                    </button>
                  </div>
                </div>

                <p className="text-[13px] text-se-bone font-accent">
                  {money(item.price * item.quantity)}
                </p>
              </div>
            ))
          )}
        </div>

        {/* Footer */}
        {items.length > 0 && (
          <div className="border-t border-white/[0.06] px-6 py-6 space-y-4">
            <div className="flex justify-between text-[13px] font-accent text-se-bone">
              <span>Subtotal</span>
              <span>{money(total)}</span>
            </div>

            <p className="text-[10px] text-se-steel font-accent">
              Shipping calculated at checkout.
            </p>

            <p className="text-[10px] text-se-steel font-accent uppercase tracking-[0.12em] border border-se-red/30 bg-[#180a0d] px-3 py-2 text-center">
              {DISCLAIMER_COMPACT}
            </p>

            <Link
              to="/checkout"
              onClick={closeCart}
              className="btn-primary w-full text-center block"
            >
              Secure Checkout
            </Link>

            <div className="flex items-center justify-center gap-2 text-[10px] text-se-steel font-accent">
              <Lock className="w-3 h-3" />
              Encrypted checkout via Stripe
            </div>
          </div>
        )}
      </Motion.aside>
    </div>
  );
}
