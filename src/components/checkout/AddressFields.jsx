// src/components/checkout/AddressFields.jsx
// Reused for shipping and (when revealed) billing. Every input has a real
// <label>, autocomplete attributes for fast mobile entry, and errors wired via
// aria-describedby. `prefix` namespaces ids + error keys for the billing copy.
import React from "react";
import { US_STATES } from "../../lib/usStates";

const field =
  "w-full px-4 py-3 bg-se-charcoal border text-se-bone text-[14px] font-accent placeholder:text-se-steel/70 focus:outline-none focus:border-se-gold transition";

export default function AddressFields({ value, onChange, errors = {}, prefix = "", idBase, autoTokenScope = "shipping" }) {
  const set = (k, v) => onChange({ ...value, [k]: v });
  const ek = (k) => `${prefix}${k}`;
  const err = (k) => errors[ek(k)];
  const border = (k) => (err(k) ? "border-se-red-bright" : "border-se-concrete");
  const id = (k) => `${idBase}-${k}`;
  const ac = (token) => `${autoTokenScope} ${token}`;

  const Err = ({ k }) =>
    err(k) ? (
      <p id={`${id(k)}-err`} className="text-[11px] text-se-red-bright font-accent mt-1">{err(k)}</p>
    ) : null;

  return (
    <div className="space-y-4">
      <div>
        <label htmlFor={id("institution")} className="text-[11px] font-accent uppercase tracking-[0.16em] text-se-steel block mb-1.5">
          Institution / Organization <span className="text-se-steel/60 normal-case tracking-normal">(optional)</span>
        </label>
        <input id={id("institution")} type="text" value={value.institution || ""} autoComplete={ac("organization")}
          onChange={(e) => set("institution", e.target.value)} placeholder="e.g. Ridgeline Research LLC"
          className={`${field} border-se-concrete`} />
      </div>

      <div className="grid sm:grid-cols-2 gap-4">
        <div>
          <label htmlFor={id("contactName")} className="text-[11px] font-accent uppercase tracking-[0.16em] text-se-steel block mb-1.5">
            Contact name <span className="text-se-steel/60 normal-case tracking-normal">(optional)</span>
          </label>
          <input id={id("contactName")} type="text" value={value.contactName || ""} autoComplete={ac("name")}
            onChange={(e) => set("contactName", e.target.value)} className={`${field} border-se-concrete`} />
        </div>
        <div>
          <label htmlFor={id("phone")} className="text-[11px] font-accent uppercase tracking-[0.16em] text-se-steel block mb-1.5">
            Phone <span className="text-se-steel/60 normal-case tracking-normal">(optional)</span>
          </label>
          <input id={id("phone")} type="tel" value={value.phone || ""} autoComplete={ac("tel")}
            onChange={(e) => set("phone", e.target.value)} className={`${field} border-se-concrete`} />
        </div>
      </div>

      <div>
        <label htmlFor={id("line1")} className="text-[11px] font-accent uppercase tracking-[0.16em] text-se-steel block mb-1.5">
          Street address
        </label>
        <input id={id("line1")} type="text" value={value.line1 || ""} required autoComplete={ac("address-line1")}
          aria-invalid={!!err("line1")} aria-describedby={err("line1") ? `${id("line1")}-err` : undefined}
          onChange={(e) => set("line1", e.target.value)} className={`${field} ${border("line1")}`} />
        <Err k="line1" />
      </div>

      <div>
        <label htmlFor={id("line2")} className="text-[11px] font-accent uppercase tracking-[0.16em] text-se-steel block mb-1.5">
          Apartment / suite / unit <span className="text-se-steel/60 normal-case tracking-normal">(optional)</span>
        </label>
        <input id={id("line2")} type="text" value={value.line2 || ""} autoComplete={ac("address-line2")}
          onChange={(e) => set("line2", e.target.value)} className={`${field} border-se-concrete`} />
      </div>

      <div className="grid sm:grid-cols-3 gap-4">
        <div>
          <label htmlFor={id("city")} className="text-[11px] font-accent uppercase tracking-[0.16em] text-se-steel block mb-1.5">Town / City</label>
          <input id={id("city")} type="text" value={value.city || ""} required autoComplete={ac("address-level2")}
            aria-invalid={!!err("city")} aria-describedby={err("city") ? `${id("city")}-err` : undefined}
            onChange={(e) => set("city", e.target.value)} className={`${field} ${border("city")}`} />
          <Err k="city" />
        </div>
        <div>
          <label htmlFor={id("state")} className="text-[11px] font-accent uppercase tracking-[0.16em] text-se-steel block mb-1.5">State</label>
          <select id={id("state")} value={value.state || ""} required autoComplete={ac("address-level1")}
            aria-invalid={!!err("state")} aria-describedby={err("state") ? `${id("state")}-err` : undefined}
            onChange={(e) => set("state", e.target.value)} className={`${field} ${border("state")}`}>
            <option value="">Select…</option>
            {US_STATES.map(([code, name]) => <option key={code} value={code}>{name}</option>)}
          </select>
          <Err k="state" />
        </div>
        <div>
          <label htmlFor={id("zip")} className="text-[11px] font-accent uppercase tracking-[0.16em] text-se-steel block mb-1.5">ZIP</label>
          <input id={id("zip")} type="text" inputMode="numeric" value={value.zip || ""} required autoComplete={ac("postal-code")}
            aria-invalid={!!err("zip")} aria-describedby={err("zip") ? `${id("zip")}-err` : undefined}
            onChange={(e) => set("zip", e.target.value)} className={`${field} ${border("zip")}`} />
          <Err k="zip" />
        </div>
      </div>
    </div>
  );
}
