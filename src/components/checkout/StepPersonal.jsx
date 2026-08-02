// src/components/checkout/StepPersonal.jsx
// Checkout Step 1 (Personal): contact, shipping address (+ optional billing),
// research information, shipping method with a free-shipping nudge, and the
// three RUO certifications. Validation is delegated to the pure
// lib/checkoutValidation module; this component owns layout + a11y wiring.
import React, { useMemo } from "react";
import { Link } from "react-router-dom";
import AddressFields from "./AddressFields";
import { RESEARCH_ENTITIES, RESEARCH_PROTOCOLS, SHIPPING_METHODS, freeShipProgress } from "../../config/checkout";
import { CHECKOUT_ATTESTATIONS } from "../../config/checkoutAttestations";
import { validateStep1 } from "../../lib/checkoutValidation";

const money = (cents) => `$${(cents / 100).toFixed(2)}`;
const field =
  "w-full px-4 py-3 bg-se-charcoal border text-se-bone text-[14px] font-accent placeholder:text-se-steel/70 focus:outline-none focus:border-se-gold transition";

export default function StepPersonal({ state, setState, subtotalDollars, showErrors, onContinue, user }) {
  const errors = useMemo(() => (showErrors ? validateStep1(state) : {}), [showErrors, state]);
  const ship = freeShipProgress(subtotalDollars);
  const patch = (path, v) => setState((s) => ({ ...s, [path]: v }));

  const Err = ({ k }) => (errors[k] ? <p className="text-[11px] text-se-red-bright font-accent mt-1">{errors[k]}</p> : null);
  const border = (k) => (errors[k] ? "border-se-red-bright" : "border-se-concrete");

  return (
    <div className="space-y-8">
      {user && (
        <div className="glass-panel px-4 py-3 text-[12.5px] font-accent text-se-bone/70">
          Signed in as <span className="text-se-bone">{user.name || user.email}</span>
          {user.name && user.email ? <span className="text-se-steel"> ({user.email})</span> : null}
        </div>
      )}

      {/* Contact */}
      <section aria-labelledby="ct-h" className="glass-panel p-6 space-y-4">
        <h2 id="ct-h" className="font-display text-[15px] tracking-[0.08em]">CONTACT INFORMATION</h2>
        <div className="grid sm:grid-cols-2 gap-4">
          <div>
            <label htmlFor="ct-first" className="text-[11px] font-accent uppercase tracking-[0.16em] text-se-steel block mb-1.5">First name</label>
            <input id="ct-first" type="text" required autoComplete="given-name"
              value={state.contact.firstName} onChange={(e) => patch("contact", { ...state.contact, firstName: e.target.value })}
              aria-invalid={!!errors.firstName} aria-describedby={errors.firstName ? "ct-first-err" : undefined}
              className={`${field} ${border("firstName")}`} />
            {errors.firstName && <p id="ct-first-err" className="text-[11px] text-se-red-bright font-accent mt-1">{errors.firstName}</p>}
          </div>
          <div>
            <label htmlFor="ct-last" className="text-[11px] font-accent uppercase tracking-[0.16em] text-se-steel block mb-1.5">Last name</label>
            <input id="ct-last" type="text" required autoComplete="family-name"
              value={state.contact.lastName} onChange={(e) => patch("contact", { ...state.contact, lastName: e.target.value })}
              aria-invalid={!!errors.lastName} aria-describedby={errors.lastName ? "ct-last-err" : undefined}
              className={`${field} ${border("lastName")}`} />
            {errors.lastName && <p id="ct-last-err" className="text-[11px] text-se-red-bright font-accent mt-1">{errors.lastName}</p>}
          </div>
        </div>
        <div className="grid sm:grid-cols-2 gap-4">
          <div>
            <label htmlFor="ct-email" className="text-[11px] font-accent uppercase tracking-[0.16em] text-se-steel block mb-1.5">Email</label>
            <input id="ct-email" type="email" required autoComplete="email"
              value={state.contact.email} onChange={(e) => patch("contact", { ...state.contact, email: e.target.value })}
              aria-invalid={!!errors.email} aria-describedby={errors.email ? "ct-email-err" : undefined}
              className={`${field} ${border("email")}`} />
            {errors.email && <p id="ct-email-err" className="text-[11px] text-se-red-bright font-accent mt-1">{errors.email}</p>}
          </div>
          <div>
            <label htmlFor="ct-phone" className="text-[11px] font-accent uppercase tracking-[0.16em] text-se-steel block mb-1.5">
              Phone <span className="text-se-steel/60 normal-case tracking-normal">(optional)</span>
            </label>
            <input id="ct-phone" type="tel" autoComplete="tel"
              value={state.contact.phone} onChange={(e) => patch("contact", { ...state.contact, phone: e.target.value })}
              className={`${field} ${border("phone")}`} />
            <Err k="phone" />
          </div>
        </div>
      </section>

      {/* Shipping address */}
      <section aria-labelledby="sh-h" className="glass-panel p-6 space-y-4">
        <h2 id="sh-h" className="font-display text-[15px] tracking-[0.08em]">SHIPPING ADDRESS</h2>
        <AddressFields idBase="ship" autoTokenScope="shipping"
          value={state.shipping} onChange={(v) => patch("shipping", v)} errors={errors} />
        <label className="flex items-center gap-2.5 text-[12.5px] font-accent text-se-bone/75 pt-1 cursor-pointer">
          <input type="checkbox" checked={state.billingDifferent}
            onChange={(e) => patch("billingDifferent", e.target.checked)}
            className="w-4 h-4 accent-se-gold" />
          Different billing address?
        </label>
        {state.billingDifferent && (
          <div className="border-t border-se-concrete pt-4 mt-2">
            <p className="text-[11px] font-accent uppercase tracking-[0.16em] text-se-steel mb-3">Billing address</p>
            <AddressFields idBase="bill" autoTokenScope="billing"
              value={state.billing} onChange={(v) => patch("billing", v)} errors={errors} prefix="billing_" />
          </div>
        )}
      </section>

      {/* Research information */}
      <section aria-labelledby="ri-h" className="glass-panel p-6 space-y-4">
        <h2 id="ri-h" className="font-display text-[15px] tracking-[0.08em]">RESEARCH INFORMATION</h2>
        <p className="text-[12px] text-se-bone/50 font-accent">Required for research-use compliance records.</p>
        <div className="grid sm:grid-cols-2 gap-4">
          <div>
            <label htmlFor="ri-entity" className="text-[11px] font-accent uppercase tracking-[0.16em] text-se-steel block mb-1.5">Research entity</label>
            <select id="ri-entity" required value={state.research.entity}
              onChange={(e) => patch("research", { ...state.research, entity: e.target.value })}
              aria-invalid={!!errors.entity} aria-describedby={errors.entity ? "ri-entity-err" : undefined}
              className={`${field} ${border("entity")}`}>
              <option value="">Select…</option>
              {RESEARCH_ENTITIES.map((o) => <option key={o} value={o}>{o}</option>)}
            </select>
            {errors.entity && <p id="ri-entity-err" className="text-[11px] text-se-red-bright font-accent mt-1">{errors.entity}</p>}
          </div>
          <div>
            <label htmlFor="ri-protocol" className="text-[11px] font-accent uppercase tracking-[0.16em] text-se-steel block mb-1.5">Intended research use</label>
            <select id="ri-protocol" required value={state.research.protocol}
              onChange={(e) => patch("research", { ...state.research, protocol: e.target.value })}
              aria-invalid={!!errors.protocol} aria-describedby={errors.protocol ? "ri-protocol-err" : undefined}
              className={`${field} ${border("protocol")}`}>
              <option value="">Select…</option>
              {RESEARCH_PROTOCOLS.map((o) => <option key={o} value={o}>{o}</option>)}
            </select>
            {errors.protocol && <p id="ri-protocol-err" className="text-[11px] text-se-red-bright font-accent mt-1">{errors.protocol}</p>}
          </div>
        </div>
      </section>

      {/* Shipping method */}
      <section aria-labelledby="sm-h" className="glass-panel p-6 space-y-3">
        <h2 id="sm-h" className="font-display text-[15px] tracking-[0.08em]">SHIPPING METHOD</h2>
        {ship.qualifies ? (
          <p className="text-[12px] font-accent text-emerald-300">✓ This order qualifies for free US shipping.</p>
        ) : (
          <div>
            <p className="text-[12px] font-accent text-se-gold">Add {money(ship.remaining * 100)} more to qualify for free shipping.</p>
            <div className="h-1.5 bg-se-charcoal rounded mt-2 overflow-hidden" aria-hidden="true">
              <div className="h-full bg-se-gold transition-all" style={{ width: `${ship.pct}%` }} />
            </div>
          </div>
        )}
        <fieldset className="space-y-2.5 pt-1">
          <legend className="sr-only">Shipping method</legend>
          {SHIPPING_METHODS.map((m) => (
            <label key={m.id} className={`flex items-center gap-3 p-3.5 border cursor-pointer transition ${
              state.shippingMethod === m.id ? "border-se-gold bg-se-gold/5" : "border-se-concrete hover:border-se-steel"}`}>
              <input type="radio" name="shipmethod" value={m.id} checked={state.shippingMethod === m.id}
                onChange={() => patch("shippingMethod", m.id)} className="w-4 h-4 accent-se-gold" />
              <span className="flex-1 min-w-0">
                <span className="block text-[13.5px] font-accent text-se-bone">{m.label}</span>
                <span className="block text-[11.5px] text-se-steel font-accent">{m.detail}</span>
              </span>
              <span className="text-[13px] font-accent text-se-bone/80">{ship.qualifies ? "Free" : money(m.priceCents)}</span>
            </label>
          ))}
        </fieldset>
        <Err k="shippingMethod" />
      </section>

      {/* RUO certification */}
      <section aria-labelledby="at-h" className="glass-panel p-6 space-y-4">
        <h2 id="at-h" className="font-display text-[15px] tracking-[0.08em]">RUO CERTIFICATION</h2>
        <div className="space-y-3" role="group" aria-describedby={errors.attestations ? "at-err" : undefined}>
          {CHECKOUT_ATTESTATIONS.map((a) => (
            <label key={a.id} className="flex items-start gap-3 cursor-pointer">
              <input type="checkbox" checked={!!state.attestations[a.id]}
                onChange={(e) => patch("attestations", { ...state.attestations, [a.id]: e.target.checked })}
                className="w-4 h-4 mt-0.5 accent-se-gold shrink-0" />
              <span className="text-[12.5px] font-accent text-se-bone/80 leading-relaxed">
                {a.links ? (
                  <>
                    I have read and agree to the{" "}
                    {a.links.map((l, i) => (
                      <React.Fragment key={l.to}>
                        <Link to={l.to} className="text-se-gold underline underline-offset-2" target="_blank">{l.label}</Link>
                        {i < a.links.length - 1 ? " and the " : "."}
                      </React.Fragment>
                    ))}
                  </>
                ) : a.text}
              </span>
            </label>
          ))}
        </div>
        {errors.attestations && <p id="at-err" className="text-[11px] text-se-red-bright font-accent">{errors.attestations}</p>}
      </section>

      <button type="button" onClick={onContinue} className="btn-primary w-full">
        Continue to Payment
      </button>
    </div>
  );
}
