// src/components/AgeGate.jsx
// 21+ age-verification interstitial. Shown once before site access and then
// persisted (localStorage), so it is dismissible-once. This is a front-of-site
// affirmation; the binding, logged consent is the research-use attestation at
// registration/checkout. Claim-safe: states the 21+ requirement and the RUO
// nature of the catalog only.
import { useEffect, useState } from "react";

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

  if (ack) return null;

  function confirm() {
    try {
      localStorage.setItem(ACK_KEY, "1");
    } catch {
      /* ignore */
    }
    setAck(true);
  }

  return (
    <div
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

        <p className="mt-6 text-[11px] text-se-steel/70">
          For research use only. Not for human or veterinary use.
        </p>
      </div>
    </div>
  );
}
