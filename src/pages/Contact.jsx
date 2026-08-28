// src/pages/Contact.jsx — Noir Peptides
import React, { useState } from "react";
import { Mail } from "lucide-react";
import SEO from "../components/SEO";
import { BRAND } from "../config/brand";

export default function Contact() {
  const [form, setForm] = useState({
    firstName: "",
    lastName: "",
    email: "",
    orderNumber: "",
    reason: "",
    message: "",
    website: "",
  });
  const [status, setStatus] = useState("idle");

  const update = (key) => (e) => setForm((p) => ({ ...p, [key]: e.target.value }));

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (form.website) return; // honeypot
    setStatus("loading");
    try {
      const res = await fetch("/api/contact", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...form, type: form.reason || "contact" }),
      });
      if (!res.ok) throw new Error();
      setStatus("success");
    } catch {
      setStatus("error");
    }
  };

  const inputCls =
    "w-full px-4 py-3 bg-se-charcoal border border-se-concrete text-se-bone text-[13px] font-accent placeholder:text-se-steel focus:outline-none focus:border-se-gold transition";
  const labelCls =
    "text-[10px] font-accent uppercase tracking-[0.2em] text-se-steel block mb-2";

  return (
    <>
      <SEO
        title="Contact | Noir Peptides"
        description="Contact Noir Peptides for order support, documentation requests, batch inquiries, or qualified research supply questions."
      />

      <div className="bg-se-black text-se-bone min-h-screen">
        <section className="pt-32 pb-12 md:pt-40 border-b border-se-concrete">
          <div className="content-wide">
            <p className="text-overline mb-4">Support</p>
            <h1 className="font-display font-extrabold text-[clamp(2rem,6vw,4rem)] tracking-[0.01em] mb-4">
              CONTACT NOIR PEPTIDES
            </h1>
            <p className="text-[15px] text-se-bone/50 max-w-2xl font-accent leading-relaxed">
              For order support, documentation requests, batch inquiries, or
              qualified research supply questions, contact our team.
            </p>
          </div>
        </section>

        <section className="section-pad">
          <div className="content-wide grid md:grid-cols-[1fr,0.7fr] gap-12 md:gap-20">
            {/* Exact spec copy */}
            <div>
              <div className="glass-panel p-6 mb-8">
                <div className="flex items-center gap-3">
                  <Mail size={16} className="text-se-gold" />
                  <a
                    href={`mailto:${BRAND.supportEmail}`}
                    className="text-[15px] font-accent text-se-gold underline underline-offset-2"
                  >
                    {BRAND.supportEmail}
                  </a>
                </div>
                {/* Phone/address/guarantee/cutoff — only when set in
                    src/config/business.js; renders nothing by default. */}
                <BusinessIdentity variant="contact" />
              </div>

              <p className="text-[14px] text-se-bone/60 leading-relaxed font-accent mb-8">
                Before contacting us, please note: Noir Peptides does not
                provide dosing, administration, injection, ingestion,
                reconstitution-ratio, treatment, clinical, or human/veterinary-use
                guidance.
              </p>

              <h2 className="font-display text-[15px] tracking-[0.04em] text-se-gold mb-3">
                For order issues, include:
              </h2>
              <ul className="list-disc list-outside pl-5 space-y-2 mb-8 text-[14px] text-se-bone/60 font-accent">
                <li>Order number</li>
                <li>Email used at checkout</li>
                <li>Photos if reporting damage, missing items, or incorrect items</li>
                <li>Brief description of the issue</li>
              </ul>

              <h2 className="font-display text-[15px] tracking-[0.04em] text-se-gold mb-3">
                For COA requests, include:
              </h2>
              <ul className="list-disc list-outside pl-5 space-y-2 text-[14px] text-se-bone/60 font-accent">
                <li>Product name</li>
                <li>Batch number if available</li>
                <li>Order number if applicable</li>
              </ul>
            </div>

            {/* Working contact form */}
            <div>
              {status === "success" ? (
                <div className="glass-panel p-10 text-center">
                  <h2 className="font-display text-[22px] tracking-[0.04em] mb-3">
                    MESSAGE SENT
                  </h2>
                  <p className="text-[14px] text-se-bone/45 font-accent">
                    We'll respond to qualified inquiries shortly.
                  </p>
                </div>
              ) : (
                <form onSubmit={handleSubmit} className="glass-panel p-6 space-y-5">
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className={labelCls}>First Name</label>
                      <input type="text" value={form.firstName} onChange={update("firstName")} required className={inputCls} />
                    </div>
                    <div>
                      <label className={labelCls}>Last Name</label>
                      <input type="text" value={form.lastName} onChange={update("lastName")} required className={inputCls} />
                    </div>
                  </div>
                  <div>
                    <label className={labelCls}>Email</label>
                    <input type="email" value={form.email} onChange={update("email")} required className={inputCls} />
                  </div>
                  <div>
                    <label className={labelCls}>Order / Batch Number (optional)</label>
                    <input type="text" value={form.orderNumber} onChange={update("orderNumber")} className={inputCls} />
                  </div>
                  <div>
                    <label className={labelCls}>Reason</label>
                    <select value={form.reason} onChange={update("reason")} required className={inputCls}>
                      <option value="">Select a reason</option>
                      <option value="order">Order question</option>
                      <option value="coa">COA / batch documentation request</option>
                      <option value="bulk">Bulk / research-supply inquiry</option>
                      <option value="transit">Damaged or incorrect order</option>
                      <option value="other">Other</option>
                    </select>
                  </div>
                  <div>
                    <label className={labelCls}>Message</label>
                    <textarea value={form.message} onChange={update("message")} required rows={5} className={`${inputCls} resize-none`} />
                  </div>
                  <input type="text" value={form.website} onChange={update("website")} className="hidden" tabIndex={-1} autoComplete="off" />
                  <button type="submit" disabled={status === "loading"} className="btn-primary w-full">
                    {status === "loading" ? "Sending..." : "Send Message"}
                  </button>
                  {status === "error" && (
                    <p className="text-[12px] text-se-red-bright font-accent">
                      Something went wrong. Try again.
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
