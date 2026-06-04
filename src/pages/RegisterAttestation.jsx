// src/pages/RegisterAttestation.jsx — Step B: recorded research-use attestation
import React, { useMemo, useState } from "react";
import { Link, Navigate, useNavigate } from "react-router-dom";
import { useUser } from "../context/UserContext";
import AuthLayout from "../components/AuthLayout";
import AuthSplash from "../components/AuthSplash";
import {
  ATTESTATION_STATEMENTS,
  ATTESTATION_VERSION,
  CONFIRM_PHRASE,
} from "../config/attestation";

export default function RegisterAttestation() {
  const { authStatus, attestationComplete, recordAttestation } = useUser();
  const navigate = useNavigate();

  const [checked, setChecked] = useState(() =>
    Object.fromEntries(ATTESTATION_STATEMENTS.map((s) => [s.id, false]))
  );
  const [legalName, setLegalName] = useState("");
  const [confirm, setConfirm] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  const allChecked = useMemo(
    () => ATTESTATION_STATEMENTS.every((s) => checked[s.id]),
    [checked]
  );
  const phraseOk = confirm.trim().toUpperCase() === CONFIRM_PHRASE;
  const nameOk = legalName.trim().length >= 2;
  const canSubmit = allChecked && phraseOk && nameOk && !submitting;

  // Gate: must be signed in; if already attested, into the store.
  if (authStatus === "loading") return <AuthSplash />;
  if (authStatus === "guest") return <Navigate to="/login" replace />;
  if (attestationComplete) return <Navigate to="/home" replace />;

  const toggle = (id) => setChecked((c) => ({ ...c, [id]: !c[id] }));

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!canSubmit) return;
    setError("");
    setSubmitting(true);
    try {
      const statements = ATTESTATION_STATEMENTS.map((s) => ({
        id: s.id,
        text: s.text,
        agreed: true,
      }));
      await recordAttestation({
        statements,
        legalName: legalName.trim(),
        version: ATTESTATION_VERSION,
      });
      navigate("/home", { replace: true });
    } catch (err) {
      setError(
        err?.message ||
          "We could not record your attestation. Please try again."
      );
      setSubmitting(false);
    }
  };

  return (
    <AuthLayout
      title="Research-Use Attestation"
      seoTitle="Research-Use Attestation | Noir Peptides"
      subtitle="Step 2 of 2 — a legally binding confirmation required before catalog access."
      wide
    >
      <form onSubmit={handleSubmit} className="glass-panel p-6 md:p-8 space-y-6">
        <div className="border border-se-red/40 bg-[#180a0d] px-4 py-3">
          <p className="text-[11px] font-accent text-se-bone/80 leading-relaxed">
            Noir Peptides products are sold strictly for laboratory and research
            use only. You must affirm each statement below. This confirmation is
            recorded with a timestamp and version for compliance.
          </p>
        </div>

        <fieldset className="space-y-3">
          <legend className="sr-only">Research-use affirmations</legend>
          {ATTESTATION_STATEMENTS.map((s) => (
            <label
              key={s.id}
              className="flex items-start gap-3 cursor-pointer select-none border border-se-concrete bg-se-asphalt/40 p-3 hover:border-se-gold/40 transition"
            >
              <input
                type="checkbox"
                checked={checked[s.id]}
                onChange={() => toggle(s.id)}
                className="mt-0.5 h-4 w-4 shrink-0 accent-[#00c2ff] cursor-pointer"
              />
              <span className="text-[12px] text-se-bone/75 leading-relaxed font-accent">
                {s.id === "terms_privacy" ? (
                  <>
                    I have read and agree to the{" "}
                    <Link to="/legal/terms" target="_blank" className="text-se-gold underline underline-offset-2">Terms &amp; Conditions</Link>,{" "}
                    <Link to="/legal/privacy" target="_blank" className="text-se-gold underline underline-offset-2">Privacy Policy</Link>, and{" "}
                    <Link to="/legal/research-use-policy" target="_blank" className="text-se-gold underline underline-offset-2">Research-Use Policy</Link>.
                  </>
                ) : (
                  s.text
                )}
              </span>
            </label>
          ))}
        </fieldset>

        <div>
          <label className="text-[10px] font-accent uppercase tracking-[0.2em] text-se-steel block mb-2" htmlFor="att-name">
            Full Legal Name
          </label>
          <input
            id="att-name"
            type="text"
            value={legalName}
            onChange={(e) => setLegalName(e.target.value)}
            autoComplete="name"
            className="w-full px-4 py-3 bg-se-charcoal border border-se-concrete text-se-bone text-[13px] font-accent placeholder:text-se-steel focus:outline-none focus:border-se-gold transition"
          />
        </div>

        <div>
          <label className="text-[10px] font-accent uppercase tracking-[0.2em] text-se-steel block mb-2" htmlFor="att-confirm">
            Type <span className="text-se-gold">{CONFIRM_PHRASE}</span> to confirm
          </label>
          <input
            id="att-confirm"
            type="text"
            value={confirm}
            onChange={(e) => setConfirm(e.target.value)}
            placeholder={CONFIRM_PHRASE}
            autoComplete="off"
            autoCorrect="off"
            autoCapitalize="off"
            spellCheck="false"
            aria-label={`Type ${CONFIRM_PHRASE} to confirm`}
            className="w-full px-4 py-3 bg-se-charcoal border border-se-concrete text-se-bone text-[13px] font-accent tracking-[0.12em] placeholder:text-se-steel focus:outline-none focus:border-se-gold transition"
          />
        </div>

        {error && <p className="text-[12px] text-se-red-bright font-accent">{error}</p>}

        <button
          type="submit"
          disabled={!canSubmit}
          className={`w-full ${canSubmit ? "btn-primary" : "btn-outline opacity-50 cursor-not-allowed"}`}
        >
          {submitting ? "Recording…" : "Confirm & Enter Catalog"}
        </button>

        <p className="text-[10px] font-accent text-se-steel/70 text-center leading-relaxed">
          Attestation version {ATTESTATION_VERSION}. These statements are
          templates, not legal advice; final policies should be reviewed by a
          licensed attorney before launch.
        </p>
      </form>
    </AuthLayout>
  );
}
