const UTM_KEY = "se_utm";
const CONSENT_KEY = "se_cookie_consent";

function readJsonFromStorage(key) {
  try {
    const raw = window?.localStorage?.getItem?.(key);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

export function getUtmSnapshot() {
  const utm = readJsonFromStorage(UTM_KEY);
  if (!utm) return null;
  // keep only safe fields
  return {
    utm_source: utm.utm_source || "",
    utm_medium: utm.utm_medium || "",
    utm_campaign: utm.utm_campaign || "",
    utm_term: utm.utm_term || "",
    utm_content: utm.utm_content || "",
    gclid: utm.gclid || "",
    fbclid: utm.fbclid || "",
    ttclid: utm.ttclid || "",
    msclkid: utm.msclkid || "",
    landing_path: utm.landing_path || "",
    timestamp: utm.timestamp || null,
  };
}

export function getConsentSnapshot() {
  const consent = readJsonFromStorage(CONSENT_KEY);
  if (!consent) return null;
  return {
    necessary: Boolean(consent.necessary),
    analytics: Boolean(consent.analytics),
    marketing: Boolean(consent.marketing),
    timestamp: consent.timestamp || null,
    source: consent.source || "manual",
  };
}

export async function subscribeEmail({ email, source = "newsletter", firstName = "" } = {}) {
  const safeEmail = String(email || "").trim();
  if (!safeEmail) throw new Error("Email is required");

  const payload = {
    email: safeEmail,
    firstName: String(firstName || "").trim(),
    source,
    path: typeof window !== "undefined" ? window.location.pathname : "",
    utm: getUtmSnapshot(),
    consent: getConsentSnapshot(),
  };

  const res = await fetch("/api/subscribe", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(text || "Failed to subscribe");
  }

  const data = await res.json().catch(() => ({}));
  return data;
}
