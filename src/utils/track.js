const CONSENT_KEY = "se_cookie_consent";

function readConsent() {
  try {
    const raw = window?.localStorage?.getItem?.(CONSENT_KEY);
    if (!raw) return { analytics: false, marketing: false };
    const consent = JSON.parse(raw);
    return {
      analytics: Boolean(consent?.analytics),
      marketing: Boolean(consent?.marketing),
    };
  } catch {
    return { analytics: false, marketing: false };
  }
}

export function trackGA(event, params = {}) {
  try {
    const { analytics } = readConsent();
    if (!analytics) return;
    if (typeof window?.gtag !== "function") return;
    window.gtag("event", event, params);
  } catch {
    // ignore
  }
}

export function trackPixel(event, params = {}) {
  try {
    const { marketing } = readConsent();
    if (!marketing) return;
    if (typeof window?.fbq !== "function") return;
    window.fbq("track", event, params);
  } catch {
    // ignore
  }
}

export function trackViewItem(product, { value } = {}) {
  if (!product) return;

  const item = {
    item_id: product.id || product.slug || product.name,
    item_name: product.displayName || product.name,
    item_category: product.type || "product",
    item_brand: "Noir Peptides",
    price: typeof value === "number" ? value : undefined,
  };

  trackGA("view_item", {
    currency: "USD",
    value: typeof value === "number" ? value : undefined,
    items: [item],
  });

  trackPixel("ViewContent", {
    content_name: item.item_name,
    content_ids: [item.item_id],
    content_type: "product",
    value: typeof value === "number" ? value : undefined,
    currency: "USD",
  });
}

export function trackAddToCart(lineItem) {
  if (!lineItem) return;

  const item = {
    item_id: lineItem.id || lineItem.slug || lineItem.name,
    item_name: lineItem.name,
    item_category: lineItem.type || "product",
    item_brand: "Noir Peptides",
    price: Number(lineItem.price || 0) || undefined,
    quantity: Number(lineItem.quantity || 1) || 1,
  };

  trackGA("add_to_cart", {
    currency: "USD",
    value: Number(lineItem.price || 0) * Number(lineItem.quantity || 1) || undefined,
    items: [item],
  });

  trackPixel("AddToCart", {
    content_name: item.item_name,
    content_ids: [item.item_id],
    content_type: "product",
    value: Number(lineItem.price || 0) * Number(lineItem.quantity || 1) || undefined,
    currency: "USD",
  });
}

export function trackBeginCheckout({ items = [], value } = {}) {
  const safeItems = (Array.isArray(items) ? items : []).map((it) => ({
    item_id: it.id || it.slug || it.name,
    item_name: it.name,
    item_category: it.type || "product",
    item_brand: "Noir Peptides",
    price: Number(it.price || 0) || undefined,
    quantity: Number(it.quantity || 1) || 1,
  }));

  trackGA("begin_checkout", {
    currency: "USD",
    value: typeof value === "number" ? value : undefined,
    items: safeItems,
  });

  trackPixel("InitiateCheckout", {
    num_items: safeItems.reduce((total, it) => total + (it.quantity || 1), 0),
    value: typeof value === "number" ? value : undefined,
    currency: "USD",
  });
}

export function trackPurchase({ transaction_id, value, items = [] } = {}) {
  const safeItems = (Array.isArray(items) ? items : []).map((it) => ({
    item_id: it.id || it.slug || it.name,
    item_name: it.name,
    item_category: it.type || "product",
    item_brand: "Noir Peptides",
    price: Number(it.price || 0) || undefined,
    quantity: Number(it.quantity || 1) || 1,
  }));

  trackGA("purchase", {
    transaction_id: transaction_id || undefined,
    currency: "USD",
    value: typeof value === "number" ? value : undefined,
    items: safeItems,
  });

  trackPixel("Purchase", {
    value: typeof value === "number" ? value : undefined,
    currency: "USD",
  });
}
