// src/pages/Partners.jsx — wholesale / institutional supply request
// (opt cycle 11, 4.14b). Posts to the existing POST /api/partners/apply;
// the Control Room "Partners" tab reviews applications by hand. Copy lives in
// src/data/pageCopy.js (PARTNERS_COPY) so the prerendered HTML, the corpus
// gate and this page read one source. No product benefit, no use case.
import React, { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import SEO from "../components/SEO";
import { PARTNERS_COPY } from "../data/pageCopy";
import { supabase } from "../lib/supabaseClient";

const VOLUMES = ["Under 25 vials / month", "25–100 vials / month", "100–500 vials / month", "500+ vials / month"];

export default function Partners() {
  const [form, setForm] = useState({
    fullName: "",
    email: "",
    businessName: "",
    country: "",
    monthlyVolume: "",
    interestedIn: "",
    websiteOrInstagram: "",
    message: "",
    website: "", // honeypot
  });
  const [status, setStatus] = useState("idle");
  // The success panel replaces the form; move focus to its heading so
  // keyboard and screen-reader users land on the confirmation (opt cycle 12).
  const successRef = useRef(null);
  useEffect(() => {
    if (status === "success") successRef.current?.focus();
  }, [status]);

  const update = (key) => (e) => setForm((p) => ({ ...p, [key]: e.target.value }));

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (form.website) return; // honeypot
    setStatus("loading");
    try {
      // A signed-in applicant is linked to their profile server-side.
      let token = null;
      try {
        token = supabase ? (await supabase.auth.getSession()).data?.session?.access_token || null : null;
      } catch {
        token = null;
      }
      const res = await fetch("/api/partners/apply", {
        method: "POST",
        headers: { "Content-Type": "application/json", ...(token ? { Authorization: `Bearer ${token}` } : {}) },
        body: JSON.stringify({ payload: form }),
      });
      if (!res.ok) throw new Error();
      setStatus("success");
    } catch {
      setStatus("error");
    }
  };

  const inputCls =
    "w-full px-4 py-3 bg-se-charcoal border border-se-concrete text-se-bone text-[13px] font-accent placeholder:text-se-steel focus:outline-none focus:border-se-gold transition";
  const labelCls = "text-[10px] font-accent uppercase tracking-[0.2em] text-se-steel block mb-2";

  return (
    <>
      <SEO
        title="Wholesale & Institutional Supply | Noir Peptides"
        description="Recurring reference-material supply for laboratories, contract research organisations and academic groups. Volume pricing quoted per account after review. For research use only."
      />

      <div className="bg-se-black text-se-bone min-h-screen">
        <section className="pt-32 pb-12 md:pt-40 border-b border-se-concrete">
          <div className="content-wide">
            <p className="text-overline mb-4">Supply accounts</p>
            <h1 className="font-display font-extrabold text-[clamp(2rem,6vw,4rem)] tracking-[0.01em] mb-4">
              {PARTNERS_COPY.heading}
            </h1>
            <p className="text-[15px] text-se-bone/50 max-w-2xl font-accent leading-relaxed">
              {PARTNERS_COPY.intro}
            </p>
          </div>
        </section>

        <section className="section-pad">
          <div className="content-wide grid md:grid-cols-[1fr,0.8fr] gap-12 md:gap-20">
            <div>
              <p className="text-[14px] text-se-bone/60 leading-relaxed font-accent mb-6">
                {PARTNERS_COPY.eligibility}
              </p>
              <p className="text-[14px] text-se-bone/60 leading-relaxed font-accent mb-8">
                {PARTNERS_COPY.noGuidance}
              </p>

              {PARTNERS_COPY.lists.map((list, li) => (
                <React.Fragment key={list.heading}>
                  <h2 className="font-display text-[15px] tracking-[0.04em] text-se-gold mb-3">{list.heading}</h2>
                  <ul
                    className={`list-disc list-outside pl-5 space-y-2 text-[14px] text-se-bone/60 font-accent${
                      li < PARTNERS_COPY.lists.length - 1 ? " mb-8" : ""
                    }`}
                  >
                    {list.items.map((item) => (
                      <li key={item}>{item}</li>
                    ))}
                  </ul>
                </React.Fragment>
              ))}

              <p className="text-[13px] text-se-bone/50 font-accent mt-8">
                Questions first?{" "}
                <Link to="/contact" className="text-se-gold underline underline-offset-2">Contact</Link>. Policies:{" "}
                <Link to="/legal/ruo-agreement" className="text-se-gold underline underline-offset-2">Research-Use Agreement</Link>.
              </p>
            </div>

            <div>
              {status === "success" ? (
                <div className="glass-panel p-10 text-center" role="status">
                  <h2 ref={successRef} tabIndex={-1} className="font-display text-[22px] tracking-[0.04em] mb-3 outline-none">APPLICATION RECEIVED</h2>
                  <p className="text-[14px] text-se-bone/55 font-accent">{PARTNERS_COPY.formNote}</p>
                </div>
              ) : (
                <form onSubmit={handleSubmit} className="glass-panel p-6 space-y-5" aria-describedby="pt-note">
                  <div>
                    <label htmlFor="pt-name" className={labelCls}>Full name</label>
                    <input type="text" id="pt-name" value={form.fullName} onChange={update("fullName")} required minLength={2} maxLength={200} autoComplete="name" className={inputCls} />
                  </div>
                  <div>
                    <label htmlFor="pt-email" className={labelCls}>Work email</label>
                    <input type="email" id="pt-email" value={form.email} onChange={update("email")} required maxLength={320} autoComplete="email" className={inputCls} />
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label htmlFor="pt-business" className={labelCls}>Institution / business</label>
                      <input type="text" id="pt-business" value={form.businessName} onChange={update("businessName")} required maxLength={200} autoComplete="organization" className={inputCls} />
                    </div>
                    <div>
                      <label htmlFor="pt-country" className={labelCls}>Country</label>
                      <input type="text" id="pt-country" value={form.country} onChange={update("country")} required maxLength={80} autoComplete="country-name" className={inputCls} />
                    </div>
                  </div>
                  <div>
                    <label htmlFor="pt-volume" className={labelCls}>Expected monthly volume</label>
                    <select id="pt-volume" value={form.monthlyVolume} onChange={update("monthlyVolume")} required className={inputCls}>
                      <option value="">Select a range</option>
                      {VOLUMES.map((v) => (
                        <option key={v} value={v}>{v}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label htmlFor="pt-interest" className={labelCls}>Materials of interest</label>
                    <input type="text" id="pt-interest" value={form.interestedIn} onChange={update("interestedIn")} required maxLength={300} className={inputCls} />
                  </div>
                  <div>
                    <label htmlFor="pt-site" className={labelCls}>Website or institutional page (optional)</label>
                    <input type="text" id="pt-site" value={form.websiteOrInstagram} onChange={update("websiteOrInstagram")} maxLength={300} autoComplete="url" className={inputCls} />
                  </div>
                  <div>
                    <label htmlFor="pt-message" className={labelCls}>Documentation needs and notes</label>
                    <textarea id="pt-message" value={form.message} onChange={update("message")} rows={4} maxLength={2000} className={`${inputCls} resize-none`} />
                  </div>
                  <input type="text" value={form.website} onChange={update("website")} className="hidden" tabIndex={-1} autoComplete="off" aria-hidden="true" />
                  <p id="pt-note" className="text-[10px] text-se-steel font-accent">{PARTNERS_COPY.formNote}</p>
                  <button type="submit" disabled={status === "loading"} className="btn-primary w-full">
                    {status === "loading" ? "Sending..." : "Submit application"}
                  </button>
                  {status === "error" && (
                    <p className="text-[12px] text-se-red-bright font-accent" role="alert">
                      Something went wrong. Try again, or email us from the contact page.
                    </p>
                  )}
                </form>
              )}
            </div>
          </div>
        </section>
      </div>
    </>
  );
}
