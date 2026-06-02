// src/components/AuthLayout.jsx
// Centered dark auth shell used by login / register / attestation / password.
import React from "react";
import { Link } from "react-router-dom";
import SEO from "./SEO";

export default function AuthLayout({ title, seoTitle, subtitle, children, wide = false }) {
  return (
    <>
      <SEO title={seoTitle || `${title} | Noir Peptides`} noindex />
      <main className="relative min-h-screen bg-se-black text-se-bone overflow-hidden">
        <div
          className="absolute inset-0 animate-glow-pulse"
          aria-hidden="true"
          style={{
            background:
              "radial-gradient(800px circle at 50% -10%, rgba(0,194,255,0.10), transparent 60%)",
          }}
        />
        <div className="relative flex flex-col items-center px-6 pt-24 pb-20">
          <Link to="/" className="flex items-center gap-2 leading-none mb-10">
            <span className="font-display text-[18px] tracking-[0.22em] text-se-bone font-extrabold">
              NOIR
            </span>
            <span
              className="inline-block w-1.5 h-1.5 rounded-full bg-se-gold"
              aria-hidden="true"
              style={{ boxShadow: "0 0 8px rgba(0,194,255,0.8)" }}
            />
            <span className="font-display text-[18px] tracking-[0.22em] text-se-bone font-extrabold">
              PEPTIDES
            </span>
          </Link>

          <div className={`w-full ${wide ? "max-w-2xl" : "max-w-md"}`}>
            <div className="text-center mb-8">
              <h1 className="font-display font-extrabold text-[clamp(1.6rem,4vw,2.2rem)] tracking-[0.02em]">
                {title}
              </h1>
              {subtitle && (
                <p className="text-[13px] text-se-bone/50 font-accent mt-3 leading-relaxed">
                  {subtitle}
                </p>
              )}
            </div>
            {children}
          </div>
        </div>
      </main>
    </>
  );
}

export const authInput =
  "w-full px-4 py-3 bg-se-charcoal border border-se-concrete text-se-bone text-[13px] font-accent placeholder:text-se-steel focus:outline-none focus:border-se-gold transition";
export const authLabel =
  "text-[10px] font-accent uppercase tracking-[0.2em] text-se-steel block mb-2";
