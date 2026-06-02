import { useEffect } from "react";
import { useLocation } from "react-router-dom";

const CONSENT_KEY = "se_cookie_consent";
const UTM_KEY = "se_utm";
const REFERRAL_KEY = "se_referral";

/**
 * Route analytics helper (SPA)
 * - Sends GA4 page_view on route changes (only after analytics consent).
 * - Sends Meta Pixel PageView on route changes (only after marketing consent).
 * - Captures UTM params (only after analytics/marketing consent) so you can attribute
 *   email signups + purchases.
 */
export default function useRouteAnalytics() {
  const location = useLocation();

  useEffect(() => {
    try {
      const gpc =
        typeof navigator !== "undefined" && Boolean(navigator.globalPrivacyControl);
      if (gpc) return;

      const raw = window?.localStorage?.getItem?.(CONSENT_KEY);
      const consent = raw ? JSON.parse(raw) : null;

      const allowAnalytics = Boolean(consent?.analytics);
      const allowMarketing = Boolean(consent?.marketing);

      // ---- Capture referral code (?ref=CODE) — no consent required, not PII ----
      if (location.search) {
        const params = new URLSearchParams(location.search);
        const refCode = params.get("ref");
        if (refCode && /^[A-Za-z0-9_-]{3,40}$/.test(refCode)) {
          try {
            window.localStorage.setItem(REFERRAL_KEY, JSON.stringify({ code: refCode, timestamp: Date.now() }));
          } catch { /* ignore */ }
        }
      }

      // ---- Capture UTMs (for attribution) ----
      if ((allowAnalytics || allowMarketing) && location.search) {
        const params = new URLSearchParams(location.search);
        const utm = {
          utm_source: params.get("utm_source") || "",
          utm_medium: params.get("utm_medium") || "",
          utm_campaign: params.get("utm_campaign") || "",
          utm_term: params.get("utm_term") || "",
          utm_content: params.get("utm_content") || "",
          gclid: params.get("gclid") || "",
          fbclid: params.get("fbclid") || "",
          ttclid: params.get("ttclid") || "",
          msclkid: params.get("msclkid") || "",
          timestamp: Date.now(),
          landing_path: window.location.pathname,
        };

        const hasAny =
          utm.utm_source ||
          utm.utm_medium ||
          utm.utm_campaign ||
          utm.utm_term ||
          utm.utm_content ||
          utm.gclid ||
          utm.fbclid ||
          utm.ttclid ||
          utm.msclkid;

        if (hasAny) {
          window.localStorage.setItem(UTM_KEY, JSON.stringify(utm));
        }
      }

      // ---- GA4 page views (manual SPA) ----
      if (allowAnalytics && typeof window?.gtag === "function") {
        window.gtag("event", "page_view", {
          page_path: location.pathname,
          page_location: window.location.href,
          page_title: document.title,
        });
      }

      // ---- Meta Pixel page views (manual SPA) ----
      if (allowMarketing && typeof window?.fbq === "function") {
        window.fbq("track", "PageView");
      }
    } catch {
      // fail closed (no analytics)
    }
  }, [location.pathname, location.search]);
}
