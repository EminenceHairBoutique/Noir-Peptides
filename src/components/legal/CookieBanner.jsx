import { useEffect, useState } from "react";
import { Link } from "react-router-dom";

const STORAGE_KEY = "np_cookie_consent";

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
    <div
      role="region"
      aria-label="Cookie notice"
      className="fixed left-4 right-4 z-50 max-w-4xl mx-auto bottom-[max(1rem,env(safe-area-inset-bottom))] max-md:bottom-[calc(52px+1rem+env(safe-area-inset-bottom))]"
    >
      {/* Below md the sheet clears the 52 px bottom nav instead of covering it (F2). */}
      {/* Opt cycle 11 (4.8 F2): a bottom sheet already; at phone widths it
          covered 39 % of the viewport (331 px of 844 at 390). Tighter padding
          and the two actions side by side keep the page behind it usable. */}
      <div className="border border-white/10 bg-se-charcoal/95 backdrop-blur-xl shadow-[0_18px_40px_rgba(0,0,0,0.5)] p-4 sm:p-6">
        <div className="space-y-4">
          <p className="text-[13px] text-se-bone/70 leading-relaxed">
            We use cookies and similar technologies to ensure the best experience,
            analyze traffic, and personalize content. You may accept all cookies
            or choose essential cookies only.
          </p>

          <p className="text-[11px] text-se-steel font-accent">
            Learn more in our{" "}
            <Link to="/privacy" className="inline-block py-[5px] text-se-bone/50 underline underline-offset-2 hover:text-se-bone">
              Privacy Policy
            </Link>
            {" "}or manage preferences in{" "}
            <Link to="/privacy-choices" className="inline-block py-[5px] text-se-bone/50 underline underline-offset-2 hover:text-se-bone">
              Your Privacy Choices
            </Link>
            .
          </p>

          <div className="flex flex-row gap-3 pt-1 sm:pt-2">
            <button onClick={acceptAll} className="btn-primary flex-1 sm:flex-none" type="button">
              Accept All
            </button>
            <button onClick={acceptEssential} className="btn-outline flex-1 sm:flex-none" type="button">
              Essential Only
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
