// src/components/AgeGate.jsx
// 21+ age-verification interstitial. Shown once before site access and then
// persisted (localStorage), so it is dismissible-once. This is a front-of-site
// affirmation; the binding, logged consent is the research-use attestation at
// registration/checkout. Claim-safe: states the 21+ requirement and the RUO
// nature of the catalog only.
import { useEffect, useRef, useState } from "react";

const ACK_KEY = "np_age_ack_v1";

export default function AgeGate() {
  // Default to acknowledged during SSR/prerender so the static HTML is never
  // the gate (crawlers index content, not the interstitial). On the client we
  // re-check localStorage in the effect below.
  const [ack, setAck] = useState(true);
  const [declined, setDeclined] = useState(false);

  useEffect(() => {
    try {
      setAck(localStorage.getItem(ACK_KEY) === "1");
    } catch {
      setAck(true); // storage blocked → don't trap the user
    }
  }, []);

  // Prevent background scroll while the gate is up.
  useEffect(() => {
    if (!ack) {
      const prev = document.body.style.overflow;
      document.body.style.overflow = "hidden";
      return () => {
        document.body.style.overflow = prev;
      };
    }
  }, [ack]);

  // Opt cycle 12 (4.9): a modal that takes and keeps focus. While the gate is
  // up the page behind it is inert (no Tab into the catalog behind the 21+
  // acknowledgement); focus starts on the primary button and wraps between
  // the dialog's controls; Escape does nothing (the gate is mandatory). On
  // confirm, focus lands on the page's main landmark.
  const dialogRef = useRef(null);
  const primaryRef = useRef(null);
  useEffect(() => {
    if (ack) return undefined;
    const root = document.getElementById("root");
    const outside = root ? [...root.children].filter((el) => !el.contains(dialogRef.current)) : [];
    for (const el of outside) el.inert = true;
    primaryRef.current?.focus();
    const onKey = (e) => {
      if (e.key !== "Tab" || !dialogRef.current) return;
      const focusables = [...dialogRef.current.querySelectorAll("button:not([disabled]), a[href]")];
      if (!focusables.length) return;
      const first = focusables[0], last = focusables[focusables.length - 1];
      if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
      else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
    };
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("keydown", onKey);
      for (const el of outside) el.inert = false;
    };
  }, [ack, declined]);

  if (ack) return null;

  function confirm() {
    try {
      localStorage.setItem(ACK_KEY, "1");
    } catch {
      /* ignore */
    }
    setAck(true);
    // The dialog unmounts; give focus a destination instead of <body>.
    setTimeout(() => document.getElementById("main")?.focus(), 0);
  }

  return (
    <div
      ref={dialogRef}
      role="dialog"
      aria-modal="true"
      aria-labelledby="age-gate-title"
      className="fixed inset-0 z-[100] flex items-center justify-center bg-se-black/95 backdrop-blur-sm px-5"
    >
      <div className="w-full max-w-md rounded-2xl border border-white/10 bg-[#0a0e16] p-8 text-center shadow-2xl">
        <p className="text-[11px] font-accent uppercase tracking-[0.25em] text-se-gold">
          Age Verification
        </p>
        <h2 id="age-gate-title" className="mt-3 font-display text-2xl text-se-bone">
          You must be 21 or older
        </h2>

        {declined ? (
          <p className="mt-4 text-sm text-se-steel">
            We’re sorry, but you must be at least 21 years of age to enter this site.
          </p>
        ) : (
          <>
            <p className="mt-4 text-sm text-se-steel">
              This site sells peptide reference materials supplied{" "}
              <strong className="text-se-bone">for laboratory research use only</strong> —
              not for human or veterinary use. By entering, you confirm you are at least
              21 years old and a qualified purchaser.
            </p>

            <div className="mt-7 flex flex-col gap-3">
              <button
                ref={primaryRef}
                type="button"
                onClick={confirm}
                className="w-full rounded-lg bg-se-gold px-5 py-3 font-accent text-sm uppercase tracking-wide text-se-black hover:opacity-90"
              >
                I am 21 or older — Enter
              </button>
              <button
                type="button"
                onClick={() => setDeclined(true)}
                className="w-full rounded-lg border border-white/15 px-5 py-3 font-accent text-sm uppercase tracking-wide text-se-steel hover:text-se-bone"
              >
                I am under 21
              </button>
            </div>
          </>
        )}

        <p className="mt-6 text-[11px] text-se-steel/80">
          For research use only. Not for human or veterinary use.
        </p>
      </div>
    </div>
  );
}
