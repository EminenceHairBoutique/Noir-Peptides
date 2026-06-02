// src/components/BrandPromise.jsx — Noir Peptides
// Research-transparency trust strip. Reusable across pages.
import React from "react";
import { FlaskConical, FileCheck2, Boxes, Lock } from "lucide-react";

const PROMISES = [
  { icon: FlaskConical, label: "Third-Party Tested" },
  { icon: Boxes, label: "Batch Traceable" },
  { icon: FileCheck2, label: "COA Available" },
  { icon: Lock, label: "Secure Checkout" },
];

export default function BrandPromise() {
  return (
    <div className="trust-bar py-5 md:py-6 bg-se-charcoal/50">
      <div className="content-wide">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 md:gap-0">
          {PROMISES.map((item) => {
            const PromiseIcon = item.icon;
            return (
              <div
                key={item.label}
                className="flex items-center justify-center gap-2.5 py-1"
              >
                <PromiseIcon className="w-4 h-4 text-se-gold" strokeWidth={1.5} />
                <span className="text-[9px] md:text-[10px] font-accent tracking-[0.18em] uppercase text-se-bone/60">
                  {item.label}
                </span>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
