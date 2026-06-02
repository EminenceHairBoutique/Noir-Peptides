// src/utils/locale.js
// Lightweight locale helpers for international UX.
// This is intentionally conservative: no IP geolocation and no external FX API calls.
// We only show *approximate* currency hints to reduce friction for UK/EU shoppers.

export const FX_RATES = {
  // Approximate display-only rates (USD -> target). Update occasionally.
  GBP: 0.79,
  EUR: 0.92,
};

export const FX_LAST_UPDATED = "2026-01";

/**
 * Best-effort currency detection using browser locale/timezone.
 * Returns USD by default.
 */
export function detectPreferredCurrency() {
  if (typeof window === "undefined") return "USD";
  const lang = String(navigator.language || "en-US").toLowerCase();
  const tz = String(Intl.DateTimeFormat().resolvedOptions().timeZone || "").toLowerCase();

  // UK
  if (lang.includes("en-gb") || tz.includes("europe/london")) return "GBP";

  // EU (very broad heuristic)
  const euLangPrefixes = ["fr", "de", "es", "it", "nl", "pt", "sv", "da", "fi", "pl", "cs", "ro", "hu", "el"]; // etc.
  if (tz.startsWith("europe/") || euLangPrefixes.some((p) => lang.startsWith(`${p}-`))) {
    return "EUR";
  }

  // Default
  return "USD";
}

export function formatApproxCurrencyFromUSD(amountUSD, currency) {
  const amountValue = Number(amountUSD || 0);
  if (!Number.isFinite(amountValue)) return "";

  if (currency === "GBP") {
    const convertedAmount = amountValue * FX_RATES.GBP;
    return `≈ £${Math.round(convertedAmount).toLocaleString()}`;
  }

  if (currency === "EUR") {
    const convertedAmount = amountValue * FX_RATES.EUR;
    return `≈ €${Math.round(convertedAmount).toLocaleString()}`;
  }

  return "";
}

export function detectRegionLabel() {
  if (typeof window === "undefined") return "Worldwide";
  const tz = String(Intl.DateTimeFormat().resolvedOptions().timeZone || "").toLowerCase();
  const lang = String(navigator.language || "en-US").toLowerCase();

  if (tz.includes("europe/") || lang.includes("-gb") || lang.includes("-ie")) return "UK/EU";
  if (tz.includes("africa/")) return "Africa";
  if (lang.includes("pt-br") || tz.includes("america/sao_paulo") || tz.includes("america/buenos_aires")) return "South America";
  return "US/Canada";
}
