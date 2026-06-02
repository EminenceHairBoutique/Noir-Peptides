import { useEffect, useState } from "react";
import { Link } from "react-router-dom";

const STORAGE_KEY = "se_cookie_consent";

export default function CookieBanner() {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (!stored) setVisible(true);
  }, []);

  useEffect(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      const gpc = typeof navigator !== "undefined" && Boolean(navigator.globalPrivacyControl);
      if (!stored && gpc) {
        localStorage.setItem(
          STORAGE_KEY,
          JSON.stringify({
            necessary: true,
            analytics: false,
            marketing: false,
            timestamp: Date.now(),
            source: "gpc",
          })
        );
        setVisible(false);
        try { window.dispatchEvent(new Event("se_consent_updated")); } catch (_e) { /* ignore */ }
      }
    } catch { /* ignore */ }
  }, []);

  const acceptAll = () => {
    localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({
        necessary: true,
        analytics: true,
        marketing: true,
        timestamp: Date.now(),
      })
    );
    setVisible(false);
    try { window.dispatchEvent(new Event("se_consent_updated")); } catch (_e) { /* ignore */ }
  };

  const acceptEssential = () => {
    localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({
        necessary: true,
        analytics: false,
        marketing: false,
        timestamp: Date.now(),
      })
    );
    setVisible(false);
    try { window.dispatchEvent(new Event("se_consent_updated")); } catch (_e) { /* ignore */ }
  };

  if (!visible) return null;

  return (
    <div className="fixed bottom-4 left-4 right-4 z-50 max-w-4xl mx-auto">
      <div className="border border-white/10 bg-se-charcoal/95 backdrop-blur-xl shadow-[0_18px_40px_rgba(0,0,0,0.5)] p-6">
        <div className="space-y-4">
          <p className="text-[13px] text-se-bone/70 leading-relaxed">
            We use cookies and similar technologies to ensure the best experience,
            analyze traffic, and personalize content. You may accept all cookies
            or choose essential cookies only.
          </p>

          <p className="text-[11px] text-se-steel font-accent">
            Learn more in our{" "}
            <Link to="/privacy" className="text-se-bone/50 underline underline-offset-2 hover:text-se-bone">
              Privacy Policy
            </Link>
            {" "}or manage preferences in{" "}
            <Link to="/privacy-choices" className="text-se-bone/50 underline underline-offset-2 hover:text-se-bone">
              Your Privacy Choices
            </Link>
            .
          </p>

          <div className="flex flex-col sm:flex-row gap-3 pt-2">
            <button onClick={acceptAll} className="btn-primary" type="button">
              Accept All
            </button>
            <button onClick={acceptEssential} className="btn-outline" type="button">
              Essential Only
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
