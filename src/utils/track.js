// src/utils/track.js
// Provider-agnostic analytics abstraction.
//
// Canonical commerce events (view_item, add_to_cart, begin_checkout, purchase)
// are emitted ONCE via track(); a provider registry fans them out to whichever
// destinations are wired and consented. GA4 is "prepared, not activated" — it
// only fires when VITE_GA_MEASUREMENT_ID is set AND window.gtag exists AND the
// user granted analytics consent, so it can be switched on later by env alone
// with no architectural change. Meta Pixel works the same way on marketing
// consent. Adding a third destination = adding one provider object below.

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

// ── Providers ─────────────────────────────────────────────────────────────
// Each provider declares the consent category it needs, whether it is ready
// (env wired + global present), and how to map a canonical event to its own
// API. Keeping the mapping inside the provider is what makes this swappable.

const ga4Provider = {
  name: "ga4",
  consent: "analytics",
  ready: () =>
    typeof window !== "undefined" &&
    typeof window.gtag === "function" &&
    Boolean(import.meta?.env?.VITE_GA_MEASUREMENT_ID),
  send(event, payload) {
    // GA4 uses the canonical event names directly.
    window.gtag("event", event, {
      currency: "USD",
      value: payload.value,
      items: payload.items,
      transaction_id: payload.transaction_id,
    });
  },
};

const META_EVENT_MAP = {
  view_item: "ViewContent",
  add_to_cart: "AddToCart",
  begin_checkout: "InitiateCheckout",
  purchase: "Purchase",
};

const metaProvider = {
  name: "meta",
  consent: "marketing",
  ready: () =>
    typeof window !== "undefined" &&
    typeof window.fbq === "function" &&
    Boolean(import.meta?.env?.VITE_META_PIXEL_ID),
  send(event, payload) {
    const mapped = META_EVENT_MAP[event];
    if (!mapped) return;
    const first = payload.items?.[0];
    window.fbq("track", mapped, {
      content_name: first?.item_name,
      content_ids: (payload.items || []).map((i) => i.item_id).filter(Boolean),
      content_type: "product",
      num_items: (payload.items || []).reduce((t, i) => t + (i.quantity || 1), 0) || undefined,
      value: payload.value,
      currency: "USD",
    });
  },
};

const PROVIDERS = [ga4Provider, metaProvider];

/**
 * Emit a canonical analytics event to every consented, ready provider.
 * @param {string} event - canonical name (view_item|add_to_cart|begin_checkout|purchase|...)
 * @param {object} payload - { value, items, transaction_id }
 */
export function track(event, payload = {}) {
  let consent;
  try {
    consent = readConsent();
  } catch {
    return;
  }
  for (const provider of PROVIDERS) {
    try {
      if (!consent[provider.consent]) continue;
      if (!provider.ready()) continue;
      provider.send(event, payload);
    } catch {
      /* a misbehaving provider must never break the page */
    }
  }
}

// ── Low-level passthroughs (back-compat) ────────────────────────────────────
export function trackGA(event, params = {}) {
  try {
    if (!readConsent().analytics || !ga4Provider.ready()) return;
    window.gtag("event", event, params);
  } catch {
    /* ignore */
  }
}

export function trackPixel(event, params = {}) {
  try {
    if (!readConsent().marketing || !metaProvider.ready()) return;
    window.fbq("track", event, params);
  } catch {
    /* ignore */
  }
}

// ── Item normalization ──────────────────────────────────────────────────────
function toItem(src = {}) {
  return {
    item_id: src.id || src.slug || src.name,
    item_name: src.displayName || src.name,
    item_category: src.type || src.category_slug || "product",
    item_brand: "Noir Peptides",
    price: Number(src.price || 0) || undefined,
    quantity: Number(src.quantity || 1) || 1,
  };
}

// ── Canonical commerce events ───────────────────────────────────────────────
export function trackViewItem(product, { value } = {}) {
  if (!product) return;
  const item = toItem(product);
  if (typeof value === "number") item.price = value;
  track("view_item", { value: typeof value === "number" ? value : item.price, items: [item] });
}

export function trackAddToCart(lineItem) {
  if (!lineItem) return;
  const item = toItem(lineItem);
  track("add_to_cart", { value: (item.price || 0) * (item.quantity || 1) || undefined, items: [item] });
}

export function trackBeginCheckout({ items = [], value } = {}) {
  const safeItems = (Array.isArray(items) ? items : []).map(toItem);
  track("begin_checkout", { value: typeof value === "number" ? value : undefined, items: safeItems });
}

export function trackPurchase({ transaction_id, value, items = [] } = {}) {
  const safeItems = (Array.isArray(items) ? items : []).map(toItem);
  track("purchase", {
    transaction_id: transaction_id || undefined,
    value: typeof value === "number" ? value : undefined,
    items: safeItems,
  });
}
