// src/pages/AuthConfirm.jsx
// Landing route for Supabase signup-confirmation links (/auth/confirm).
// Exchanges the confirmation code/token for a session, then routes ONWARD
// through Noir's attestation gate: a confirmed account with no current
// research-use attestation goes to /register/attestation (not to a page the
// guard would bounce it from); a fully attested account continues to /home.
// Expired/invalid links get a "resend confirmation email" action.
import React, { useEffect, useRef, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { supabase } from "../lib/supabaseClient";
import { siteOrigin } from "../lib/siteUrl";
import { ATTESTATION_VERSION } from "../config/attestation";
import AuthLayout, { authInput, authLabel } from "../components/AuthLayout";

function linkErrorDescription() {
  try {
    const hash = new URLSearchParams(window.location.hash.replace(/^#/, ""));
    const query = new URLSearchParams(window.location.search);
    const desc = hash.get("error_description") || query.get("error_description");
    const code = hash.get("error_code") || query.get("error_code");
    if (desc) return desc.replace(/\+/g, " ");
    if (code) return code;
    return null;
  } catch {
    return null;
  }
}

export default function AuthConfirm() {
  const navigate = useNavigate();
  // phase: verifying → invalid | resent (success routes away immediately)
  const [phase, setPhase] = useState("verifying");
  const [linkError, setLinkError] = useState("");
  const [resendEmail, setResendEmail] = useState("");
  const [resendBusy, setResendBusy] = useState(false);
  const [resendMsg, setResendMsg] = useState("");
  const settled = useRef(false);

  useEffect(() => {
    if (!supabase) {
      setLinkError("Authentication is not configured in this environment.");
      setPhase("invalid");
      return undefined;
    }

    // Confirmed session → route through the attestation gate.
    const routeOnward = async (session) => {
      if (settled.current) return;
      settled.current = true;
      try {
        const { data: profile } = await supabase
          .from("profiles")
          .select("attestation_completed_at, attestation_version")
          .eq("id", session.user.id)
          .maybeSingle();
        const attested =
          Boolean(profile?.attestation_completed_at) &&
          profile?.attestation_version === ATTESTATION_VERSION;
        navigate(attested ? "/home" : "/register/attestation", { replace: true });
      } catch {
        // Profile unreadable — the route guards will sort it out downstream.
        navigate("/register/attestation", { replace: true });
      }
    };

    const fail = (msg) => {
      if (settled.current) return;
      settled.current = true;
      setLinkError(msg || "");
      setPhase("invalid");
    };

    const { data: sub } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === "SIGNED_IN" && session) routeOnward(session);
    });

    (async () => {
      const errDesc = linkErrorDescription();
      if (errDesc) return fail(errDesc);

      const code = new URLSearchParams(window.location.search).get("code");
      if (code) {
        const { data, error } = await supabase.auth.exchangeCodeForSession(code);
        if (error) return fail(error.message);
        if (data?.session) return routeOnward(data.session);
      }

      const { data } = await supabase.auth.getSession();
      if (data?.session) return routeOnward(data.session);

      // Legacy hash tokens are consumed asynchronously by the client; give it
      // a moment before declaring the link dead.
      setTimeout(async () => {
        const { data: late } = await supabase.auth.getSession();
        if (late?.session) return routeOnward(late.session);
        fail("This confirmation link is invalid, expired, or already used.");
      }, 2500);
    })();

    return () => sub?.subscription?.unsubscribe?.();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const resend = async (e) => {
    e.preventDefault();
    setResendBusy(true);
    setResendMsg("");
    try {
      await supabase.auth.resend({
        type: "signup",
        email: resendEmail,
        options: { emailRedirectTo: `${siteOrigin()}/auth/confirm` },
      });
    } catch {
      /* neutral response either way — never reveal whether the email exists */
    } finally {
      setResendBusy(false);
      setResendMsg("If an account exists for that address, a new confirmation email has been sent.");
    }
  };

  return (
    <AuthLayout title="Confirming Your Email" seoTitle="Confirm Email | Noir Peptides">
      {phase === "verifying" && (
        <div className="glass-panel p-8 text-center">
          <p className="text-[14px] text-se-bone/70 font-accent">Confirming your email…</p>
        </div>
      )}

      {phase === "invalid" && (
        <div className="glass-panel p-8 space-y-5">
          <p className="text-[14px] text-se-bone/80 font-accent leading-relaxed text-center">
            This confirmation link can&apos;t be used.
          </p>
          {linkError && (
            <p className="text-[12px] text-se-steel font-accent text-center">{linkError}</p>
          )}
          <form onSubmit={resend} className="space-y-3">
            <div>
              <label className={authLabel} htmlFor="ac-email">Email</label>
              <input id="ac-email" type="email" autoComplete="email" value={resendEmail}
                onChange={(e) => setResendEmail(e.target.value)} required className={authInput} />
            </div>
            <button type="submit" disabled={resendBusy} className="btn-primary w-full">
              {resendBusy ? "Sending…" : "Resend Confirmation Email"}
            </button>
            {resendMsg && <p className="text-[12px] text-se-bone/60 font-accent text-center">{resendMsg}</p>}
          </form>
          <p className="text-[11px] font-accent text-se-steel text-center">
            <Link to="/login" className="hover:text-se-gold transition">Back to log in</Link>
          </p>
        </div>
      )}
    </AuthLayout>
  );
}
