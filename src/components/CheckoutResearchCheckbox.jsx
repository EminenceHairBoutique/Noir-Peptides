// src/components/CheckoutResearchCheckbox.jsx
// Required purchaser acknowledgment before checkout may proceed.
import React from "react";
import { CHECKOUT_ACK } from "../config/compliance";

export default function CheckoutResearchCheckbox({ checked, onChange, className = "" }) {
  return (
    <label
      className={`flex items-start gap-3 cursor-pointer select-none border border-se-concrete bg-se-asphalt/40 p-4 ${className}`}
    >
      <input
        type="checkbox"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        className="mt-0.5 h-4 w-4 shrink-0 accent-[#00c2ff] cursor-pointer"
        aria-label="Research use purchaser acknowledgment"
      />
      <span className="text-[12px] text-se-bone/70 leading-relaxed font-accent">
        {CHECKOUT_ACK}
      </span>
    </label>
  );
}
