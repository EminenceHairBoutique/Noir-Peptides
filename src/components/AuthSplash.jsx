// src/components/AuthSplash.jsx
// Neutral loading splash shown while the auth session resolves. Prevents the
// refresh-induced redirect-to-login race (the AdminRoute lesson).
import React from "react";

export default function AuthSplash() {
  return (
    <div className="min-h-screen bg-se-black flex flex-col items-center justify-center gap-5">
      <div className="flex items-center gap-2 leading-none">
        <span className="font-display text-[18px] tracking-[0.22em] text-se-bone font-extrabold">
          NOIR
        </span>
        <span
          className="inline-block w-1.5 h-1.5 rounded-full bg-se-gold animate-subtle-pulse"
          aria-hidden="true"
        />
        <span className="font-display text-[18px] tracking-[0.22em] text-se-bone font-extrabold">
          PEPTIDES
        </span>
      </div>
      <div className="h-px w-40 overflow-hidden bg-se-concrete">
        <div className="h-full w-1/2 bg-se-gold animate-line-grow" />
      </div>
      <p className="sr-only">Loading secure session…</p>
    </div>
  );
}
