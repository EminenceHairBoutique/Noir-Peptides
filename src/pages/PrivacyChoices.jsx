// src/pages/PrivacyChoices.jsx — Noir Peptides
import React, { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import SEO from "../components/SEO";

const STORAGE_KEY = "se_cookie_consent";

function safeParse(json) {
  try { return JSON.parse(json); } catch { return null; }
}

function getDefaultConsent() {
  const gpc = typeof navigator !== "undefined" && Boolean(navigator.globalPrivacyControl);
  return { necessary: true, analytics: !gpc, marketing: !gpc, timestamp: Date.now() };
}

function readConsent() {
  if (typeof window === "undefined") return null;
  const raw = window.localStorage?.getItem?.(STORAGE_KEY);
  if (!raw) return null;
  const parsed = safeParse(raw);
  if (!parsed || typeof parsed !== "object") return null;
  return { necessary: true, analytics: Boolean(parsed.analytics), marketing: Boolean(parsed.marketing), timestamp: Number(parsed.timestamp || Date.now()) };
}

function writeConsent(next) {
  if (typeof window === "undefined") return;
  window.localStorage?.setItem?.(STORAGE_KEY, JSON.stringify({ necessary: true, analytics: Boolean(next.analytics), marketing: Boolean(next.marketing), timestamp: Date.now() }));
}

export default function PrivacyChoices() {
  const gpc = useMemo(() => typeof navigator !== "undefined" && Boolean(navigator.globalPrivacyControl), []);
  const [consent, setConsent] = useState(() => readConsent() || getDefaultConsent());
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    if (!gpc) return;
    const existing = readConsent();
    if (!existing) {
      const next = getDefaultConsent();
      writeConsent(next);
      setConsent(next);
    }
  }, [gpc]);

  const save = () => { writeConsent(consent); setSaved(true); setTimeout(() => setSaved(false), 1200); };
  const acceptAll = () => { const next = { necessary: true, analytics: true, marketing: true, timestamp: Date.now() }; setConsent(next); writeConsent(next); setSaved(true); setTimeout(() => setSaved(false), 1200); };
  const essentialOnly = () => { const next = { necessary: true, analytics: false, marketing: false, timestamp: Date.now() }; setConsent(next); writeConsent(next); setSaved(true); setTimeout(() => setSaved(false), 1200); };

  return (
    <>
      <SEO title="Your Privacy Choices | Noir Peptides" description="Control how non-essential technologies are used on the Noir Peptides website." />

      <div className="bg-se-black text-se-bone min-h-screen">
        <section className="pt-32 pb-16 md:pt-40 md:pb-24 border-b border-white/5">
          <div className="content-wide">
            <p className="text-overline mb-4">Privacy</p>
            <h1 className="font-display text-[clamp(2rem,6vw,4rem)] tracking-[0.04em]">YOUR PRIVACY CHOICES</h1>
            <p className="text-[14px] text-se-bone/40 mt-4 max-w-lg">
              Control how non-essential technologies are used on this site. Necessary features are always enabled.
            </p>
            {gpc && (
              <div className="mt-4 border border-white/10 bg-se-charcoal p-4 text-[13px] text-se-bone/50 max-w-lg">
                Global Privacy Control (GPC) detected. We treat this as a request to opt out of non-essential processing.
              </div>
            )}
          </div>
        </section>

        <section className="section-pad">
          <div className="content-wrap max-w-3xl space-y-8">
            {/* Necessary */}
            <div className="border border-white/5 bg-se-charcoal p-6">
              <div className="flex items-center justify-between mb-2">
                <h2 className="font-display text-[14px] tracking-[0.12em]">NECESSARY</h2>
                <span className="text-[10px] font-accent uppercase tracking-[0.2em] text-se-gold">Always On</span>
              </div>
              <p className="text-[13px] text-se-bone/40 leading-relaxed">
                Core functionality, security, and fraud prevention. Cannot be disabled.
              </p>
            </div>

            {/* Analytics */}
            <div className="border border-white/5 bg-se-charcoal p-6">
              <div className="flex items-center justify-between mb-2">
                <h2 className="font-display text-[14px] tracking-[0.12em]">ANALYTICS</h2>
                <label className="flex items-center gap-2 cursor-pointer">
                  <input type="checkbox" checked={Boolean(consent.analytics)} onChange={(e) => setConsent((c) => ({ ...c, analytics: e.target.checked }))}
                    className="accent-se-gold" />
                  <span className="text-[11px] font-accent text-se-steel">{consent.analytics ? "Enabled" : "Disabled"}</span>
                </label>
              </div>
              <p className="text-[13px] text-se-bone/40 leading-relaxed">
                Helps us understand how the site is used so we can improve content and performance.
              </p>
            </div>

            {/* Marketing */}
            <div className="border border-white/5 bg-se-charcoal p-6">
              <div className="flex items-center justify-between mb-2">
                <h2 className="font-display text-[14px] tracking-[0.12em]">MARKETING</h2>
                <label className="flex items-center gap-2 cursor-pointer">
                  <input type="checkbox" checked={Boolean(consent.marketing)} onChange={(e) => setConsent((c) => ({ ...c, marketing: e.target.checked }))}
                    className="accent-se-gold" />
                  <span className="text-[11px] font-accent text-se-steel">{consent.marketing ? "Enabled" : "Disabled"}</span>
                </label>
              </div>
              <p className="text-[13px] text-se-bone/40 leading-relaxed">
                Helps personalize content and measure marketing performance.
              </p>
            </div>

            {/* Actions */}
            <div className="flex flex-wrap gap-3 pt-4">
              <button type="button" onClick={save} className="btn-primary">
                {saved ? "Saved" : "Save Preferences"}
              </button>
              <button type="button" onClick={acceptAll} className="btn-outline">Accept All</button>
              <button type="button" onClick={essentialOnly} className="btn-outline">Essential Only</button>
            </div>

            <p className="text-[11px] text-se-steel font-accent">
              Read our <Link to="/privacy" className="text-se-bone/50 underline underline-offset-4 hover:text-se-bone transition">Privacy Policy</Link> for full details.
            </p>
          </div>
        </section>
      </div>
    </>
  );
}
