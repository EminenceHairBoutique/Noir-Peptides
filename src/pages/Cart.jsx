// src/pages/Cart.jsx — Noir Peptides
import React from "react";
import { Link } from "react-router-dom";
import { Minus, Plus } from "lucide-react";
import { useCart } from "../context/CartContext";
import SEO from "../components/SEO";
import DisclaimerBanner from "../components/DisclaimerBanner";

const money = (n) =>
  `$${Number(n).toLocaleString(undefined, { maximumFractionDigits: 0 })}`;
import FreeShipProgress from "../components/FreeShipProgress";
import CryptoIncentive from "../components/CryptoIncentive";

export default function Cart() {
  const {
    cartItems = [],
    items = [],
    updateQuantity,
    removeFromCart,
    removeItem,
    subtotal,
    total,
  } = useCart();
  const cartList = cartItems?.length ? cartItems : items || [];
  const cartTotal = subtotal ?? total ?? 0;

  if (!cartList.length) {
    return (
      <>
        <SEO title="Cart — Noir Peptides" noindex={true} />
        <div className="bg-se-black text-se-bone min-h-[70vh] pt-32 text-center">
          <h1 className="font-display text-[28px] tracking-[0.04em] mb-4">
            YOUR CART IS EMPTY
          </h1>
          <p className="text-[14px] text-se-bone/40 mb-8 font-accent">
            No research materials selected yet.
          </p>
          <Link to="/shop" className="btn-primary">
            Browse Research Catalog
          </Link>
        </div>
      </>
    );
  }

  return (
    <>
      <SEO title="Cart — Noir Peptides" noindex={true} />
      <div className="bg-se-black text-se-bone min-h-screen">
        <section className="pt-28 pb-24">
          <div className="content-wide">
            <h1 className="font-display font-extrabold text-[clamp(1.5rem,4vw,2.5rem)] tracking-[0.02em] mb-8">
              CART
            </h1>

            <DisclaimerBanner className="mb-10" />

            <div className="grid lg:grid-cols-[1fr,0.4fr] gap-12">
              <div className="space-y-0">
                {cartList.map((item) => (
                  <div
                    key={item.cartKey || item.id}
                    className="flex gap-5 py-6 border-b border-se-concrete"
                  >
                    {item.image ? (
                      <img
                        src={item.image}
                        alt={item.name}
                        className="w-24 h-24 object-cover bg-se-asphalt border border-se-concrete"
                      />
                    ) : (
                      <div
                        className="vial-visual w-24 h-24 border border-se-concrete"
                        aria-hidden="true"
                      />
                    )}

                    <div className="flex-1 min-w-0">
                      <Link
                        to={`/products/${item.slug || item.id}`}
                        className="text-[14px] font-display text-se-bone hover:text-se-gold transition"
                      >
                        {item.name}
                      </Link>
                      <p className="text-[11px] text-se-steel mt-1 font-accent uppercase tracking-[0.12em]">
                        Lyophilized research material
                      </p>

                      <div className="flex items-center gap-4 mt-4">
                        <div className="flex items-center border border-se-concrete">
                          <button
                            onClick={() =>
                              (updateQuantity || (() => {}))(
                                item.id,
                                item.variant,
                                Math.max(1, item.quantity - 1)
                              )
                            }
                            className="px-2.5 py-1.5 text-se-steel hover:text-se-gold transition"
                            type="button"
                            aria-label="Decrease quantity"
                          >
                            <Minus size={12} />
                          </button>
                          <span className="px-3 text-[12px] font-accent">
                            {item.quantity}
                          </span>
                          <button
                            onClick={() =>
                              (updateQuantity || (() => {}))(
                                item.id,
                                item.variant,
                                item.quantity + 1
                              )
                            }
                            className="px-2.5 py-1.5 text-se-steel hover:text-se-gold transition"
                            type="button"
                            aria-label="Increase quantity"
                          >
                            <Plus size={12} />
                          </button>
                        </div>

                        <button
                          onClick={() =>
                            (removeFromCart || removeItem || (() => {}))(
                              item.id,
                              item.variant
                            )
                          }
                          className="text-[10px] font-accent uppercase tracking-[0.15em] text-se-steel hover:text-se-red-bright transition"
                          type="button"
                        >
                          Remove
                        </button>
                      </div>
                    </div>

                    <p className="text-[14px] font-accent text-se-bone">
                      {money(item.price * item.quantity)}
                    </p>
                  </div>
                ))}
              </div>

              <div className="lg:sticky lg:top-28 self-start">
                <div className="glass-panel p-6 space-y-5">
                  <h2 className="font-display text-[14px] tracking-[0.1em]">
                    ORDER SUMMARY
                  </h2>
                  <div className="divider" />
                  <div className="flex justify-between text-[13px] font-accent">
                    <span className="text-se-bone/60">Subtotal</span>
                    <span>{money(cartTotal)}</span>
                  </div>
                  {/* Task 5: free-shipping progress, reading the SAME threshold
                      the server prices against — display cannot drift from charge. */}
                  <FreeShipProgress subtotal={cartTotal} />
                  <div className="flex justify-between text-[13px] font-accent">
                    <span className="text-se-bone/60">Shipping</span>
                    <span className="text-se-steel">At checkout</span>
                  </div>
                  {/* Task 4: the crypto saving, surfaced where it can affect
                      the decision. Renders only when the SERVER reports a live
                      crypto rail and a real discount percentage. */}
                  <CryptoIncentive subtotal={cartTotal} />
                  <div className="divider" />
                  <div className="flex justify-between text-[15px] font-accent font-medium">
                    <span>Total</span>
                    <span>{money(cartTotal)}</span>
                  </div>

                  <Link
                    to="/checkout"
                    className="btn-primary w-full text-center block mt-4"
                  >
                    Proceed to Checkout
                  </Link>

                  <p className="text-[10px] text-se-steel font-accent text-center uppercase tracking-[0.12em]">
                    Research use only · Not for human or veterinary use
                  </p>
                </div>
              </div>
            </div>
          </div>
        </section>
      </div>
    </>
  );
}
