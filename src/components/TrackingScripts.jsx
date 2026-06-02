import { useEffect, useMemo, useState } from "react";

const STORAGE_KEY = "se_cookie_consent";

function readConsent() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    return {
      necessary: Boolean(parsed?.necessary),
      analytics: Boolean(parsed?.analytics),
      marketing: Boolean(parsed?.marketing),
      timestamp: parsed?.timestamp,
    };
  } catch {
    return null;
  }
}

function loadScriptOnce(id, src) {
  if (!src) return;
  if (document.getElementById(id)) return;
  const s = document.createElement("script");
  s.id = id;
  s.async = true;
  s.src = src;
  document.head.appendChild(s);
}

function runInlineOnce(id, code) {
  if (!code) return;
  if (document.getElementById(id)) return;
  const s = document.createElement("script");
  s.id = id;
  s.text = code;
  document.head.appendChild(s);
}

export default function TrackingScripts() {
  const gaId = useMemo(() => import.meta?.env?.VITE_GA_MEASUREMENT_ID || "", []);
  const metaPixelId = useMemo(() => import.meta?.env?.VITE_META_PIXEL_ID || "", []);

  const [consent, setConsent] = useState(null);

  useEffect(() => {
    // Initial read
    setConsent(readConsent());

    // Update when user accepts/declines in CookieBanner
    const onUpdate = () => setConsent(readConsent());
    window.addEventListener("se_consent_updated", onUpdate);

    // Also refresh on tab focus (covers edge cases)
    window.addEventListener("focus", onUpdate);

    return () => {
      window.removeEventListener("se_consent_updated", onUpdate);
      window.removeEventListener("focus", onUpdate);
    };
  }, []);

  useEffect(() => {
    if (!consent) return;

    // ---------- Google Analytics 4 (optional) ----------
    if (consent.analytics && gaId) {
      // Load GA library
      loadScriptOnce("ga4-lib", `https://www.googletagmanager.com/gtag/js?id=${encodeURIComponent(gaId)}`);

      // Init GA with send_page_view disabled (SPA page views handled in useRouteAnalytics)
      runInlineOnce(
        "ga4-init",
        `window.dataLayer = window.dataLayer || [];
function gtag(){dataLayer.push(arguments);} 
window.gtag = window.gtag || gtag;
gtag('js', new Date());
// Disable automatic page_view; SPA route changes will send page views manually.
gtag('config', '${gaId}', { send_page_view: false, anonymize_ip: true });
// Track the initial page view once GA is initialized.
gtag('event', 'page_view', { page_path: window.location.pathname, page_location: window.location.href, page_title: document.title });`
      );
    }

    // ---------- Meta Pixel (optional) ----------
    if (consent.marketing && metaPixelId) {
      runInlineOnce(
        "meta-pixel-init",
        `!function(f,b,e,v,n,t,s){if(f.fbq)return;n=f.fbq=function(){n.callMethod?
 n.callMethod.apply(n,arguments):n.queue.push(arguments)};if(!f._fbq)f._fbq=n;
 n.push=n;n.loaded=!0;n.version='2.0';n.queue=[];t=b.createElement(e);t.async=!0;
 t.src=v;s=b.getElementsByTagName(e)[0];s.parentNode.insertBefore(t,s)}(window, document,'script',
 'https://connect.facebook.net/en_US/fbevents.js');
fbq('init', '${metaPixelId}');
fbq('track', 'PageView');`
      );
    }
  }, [consent, gaId, metaPixelId]);

  return null;
}
