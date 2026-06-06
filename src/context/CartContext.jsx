// src/context/CartContext.jsx
// Noir Peptides — Cart state + drawer controls.

import React, {
  createContext,
  useContext,
  useMemo,
  useState,
  useEffect,
} from "react";
import { resolveProductImages } from "../utils/productMedia";
import { unitPriceForQuantity } from "../lib/catalog";

const CartContext = createContext(null);

const STORAGE_KEY = "np_cart";

export function CartProvider({ children }) {
  const [cartItems, setCartItems] = useState(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });
  const [isOpen, setIsOpen] = useState(false);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(cartItems));
  }, [cartItems]);

  const openCart = () => setIsOpen(true);
  const closeCart = () => setIsOpen(false);
  const toggleCart = () => setIsOpen((v) => !v);

  const addToCart = (product, options = {}) => {
    if (!product?.id) return;

    const quantity = Number(options.quantity ?? 1) || 1;

    // Variant + bundle-tier identity (the server re-prices from these).
    const variantId = options.variantId ?? product.variantId ?? null;
    const sku = options.sku ?? product.sku ?? null;
    const sizeLabel = options.sizeLabel ?? product.sizeLabel ?? null;
    const tiers = options.tiers ?? product.tiers ?? [];
    const basePrice = Number(options.basePrice ?? options.price ?? product.price ?? 0);

    // Unit price reflects the bundle tier for the chosen quantity (matches the
    // server's authoritative price).
    const price = unitPriceForQuantity(basePrice, tiers, quantity);

    const images = resolveProductImages(product);
    const image =
      options.image || product.image || images?.[0] || product.images?.[0] || null;

    const isPreorder = Boolean(options.isPreorder ?? product.isPreorder ?? false);
    const leadTimeDays = Number(options.leadTimeDays ?? product.leadTimeDays ?? 0);

    // One cart line per variant (each dosage is distinct).
    const cartKey = variantId ? `v:${variantId}` : `${product.id}`;

    const normalized = {
      id: product.id,
      slug: product.slug,
      name: product.displayName || product.name,
      image,
      variantId,
      sku,
      sizeLabel,
      tiers,
      basePrice,
      price,
      quantity,
      isPreorder,
      leadTimeDays,
      cartKey,
      variant: cartKey,
    };

    setCartItems((prev) => {
      const idx = prev.findIndex((p) => p.cartKey === normalized.cartKey);
      if (idx >= 0) {
        const copy = [...prev];
        const q = copy[idx].quantity + normalized.quantity;
        copy[idx] = {
          ...copy[idx],
          quantity: q,
          price: unitPriceForQuantity(copy[idx].basePrice, copy[idx].tiers, q),
        };
        return copy;
      }
      return [...prev, normalized];
    });

    setIsOpen(true);
  };

  const updateQuantity = (id, a, b) => {
    const hasVariant = typeof a === "string";
    const variant = hasVariant ? a : null;
    const qty = hasVariant ? b : a;
    const nextQty = Math.max(1, Number(qty) || 1);

    setCartItems((prev) =>
      prev.map((p) => {
        if (p.id !== id) return p;
        if (variant && p.variant !== variant) return p;
        // Re-apply the bundle tier for the new quantity.
        const price = unitPriceForQuantity(p.basePrice ?? p.price, p.tiers, nextQty);
        return { ...p, quantity: nextQty, price };
      })
    );
  };

  const updateItemOptions = (id, cartKey, next = {}) => {
    setCartItems((prev) => {
      const current = prev.find((x) => (x.cartKey || x.variant) === cartKey);
      if (!current) return prev;

      const size = next.size ?? current.size;
      const colorway = next.colorway ?? current.colorway;
      const newCartKey = `${id}::${size || ""}::${colorway || ""}`;

      const updated = {
        ...current,
        size,
        colorway,
        cartKey: newCartKey,
        variant: newCartKey,
      };

      let nextArr = prev.filter((x) => (x.cartKey || x.variant) !== cartKey);
      const mergeIdx = nextArr.findIndex((x) => (x.cartKey || x.variant) === newCartKey);
      if (mergeIdx >= 0) {
        const copy = [...nextArr];
        copy[mergeIdx] = {
          ...copy[mergeIdx],
          quantity: Number(copy[mergeIdx].quantity || 0) + Number(updated.quantity || 0),
        };
        return copy;
      }

      return [...nextArr, updated];
    });
  };

  const removeFromCart = (id, variant = null) => {
    setCartItems((prev) =>
      prev.filter((p) => {
        if (p.id !== id) return true;
        if (!variant) return false;
        return p.variant !== variant;
      })
    );
  };

  const removeItem = (id) => removeFromCart(id, null);

  const clearCart = () => {
    setCartItems([]);
    localStorage.removeItem(STORAGE_KEY);
    setIsOpen(false);
  };

  const subtotal = useMemo(
    () =>
      cartItems.reduce(
        (sum, item) => sum + Number(item.price || 0) * Number(item.quantity || 0),
        0
      ),
    [cartItems]
  );

  const total = subtotal;

  const value = {
    isOpen,
    openCart,
    closeCart,
    toggleCart,
    cartItems,
    addToCart,
    updateQuantity,
    updateItemOptions,
    removeFromCart,
    removeItem,
    clearCart,
    items: cartItems,
    setItems: setCartItems,
    subtotal,
    total,
  };

  return <CartContext.Provider value={value}>{children}</CartContext.Provider>;
}

export function useCart() {
  const ctx = useContext(CartContext);
  if (!ctx) {
    throw new Error("useCart must be used within a CartProvider");
  }
  return ctx;
}
