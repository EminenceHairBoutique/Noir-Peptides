// src/pages/ResetPassword.jsx
// Landing route for Supabase password-recovery links. The link format depends
// on client version + email template, so BOTH arrival shapes are handled:
//   - PKCE:   ?code=<uuid>  → exchangeCodeForSession
//   - Legacy: #access_token=…&type=recovery → consumed automatically by the
//     client (detectSessionInUrl) into a recovery session
// plus the PASSWORD_RECOVERY auth event as a belt-and-braces signal. Expired /
// invalid / already-used links get a clear message and a "send a new link"
// action — never a blank screen or a doomed form.
import React, { useEffect, useRef, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { supabase } from "../lib/supabaseClient";
import AuthLayout, { authInput, authLabel } from "../components/AuthLayout";

// Supabase appends error params (hash or query) on expired/invalid links.
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

export default function ResetPassword() {
  const navigate = useNavigate();
  // phase: verifying → form → done | invalid
  const [phase, setPhase] = useState("verifying");
  const [linkError, setLinkError] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const settled = useRef(false);

  useEffect(() => {
    if (!supabase) {
      setLinkError("Authentication is not configured in this environment.");
      setPhase("invalid");
      return undefined;
    }

    const settle = (next, msg = "") => {
      if (settled.current) return;
      settled.current = true;
      setLinkError(msg);
      setPhase(next);
    };

    // Belt-and-braces: the recovery event fires when the client consumes a
    // legacy hash token (possibly after our initial checks ran).
    const { data: sub } = supabase.auth.onAuthStateChange((event) => {
      if (event === "PASSWORD_RECOVERY" || event === "SIGNED_IN") settle("form");
    });

    (async () => {
      // 1. An explicit error on the link (expired/invalid/used) wins.
      const errDesc = linkErrorDescription();
      if (errDesc) return settle("invalid", errDesc);

      // 2. PKCE arrival: ?code= must be exchanged explicitly.
      const code = new URLSearchParams(window.location.search).get("code");
      if (code) {
        const { error: xErr } = await supabase.auth.exchangeCodeForSession(code);
        if (xErr) return settle("invalid", xErr.message);
        return settle("form");
      }

      // 3. Legacy hash arrival: detectSessionInUrl already consumed it — a
      //    session now exists. (Also covers re-visits within the session.)
      const { data } = await supabase.auth.getSession();
      if (data?.session) return settle("form");

      // 4. Give the client a moment to finish consuming a hash token, then
      //    conclude the link is missing/expired.
      setTimeout(async () => {
        const { data: late } = await supabase.auth.getSession();
        if (late?.session) return settle("form");
        settle("invalid", "This reset link is invalid, expired, or already used.");
      }, 2500);
    })();

    return () => sub?.subscription?.unsubscribe?.();
  }, []);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    if (password !== confirm) return setError("Passwords do not match.");
    if (password.length < 8) return setError("Use at least 8 characters.");
    setBusy(true);
    try {
      const { error: err } = await supabase.auth.updateUser({ password });
      if (err) throw err;
      setPhase("done");
      // The recovery session has served its purpose — sign out so the user
      // re-authenticates with the new password.
      await supabase.auth.signOut();
      setTimeout(() => navigate("/login", { replace: true }), 1800);
    } catch (err) {
      setError(err?.message || "Unable to update password.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <AuthLayout title="Set New Password" seoTitle="Set New Password | Noir Peptides">
      {phase === "verifying" && (
        <div className="glass-panel p-8 text-center">
          <p className="text-[14px] text-se-bone/70 font-accent">Verifying your reset link…</p>
        </div>
      )}

      {phase === "invalid" && (
        <div className="glass-panel p-8 text-center space-y-5">
          <p className="text-[14px] text-se-bone/80 font-accent leading-relaxed">
            This password reset link can&apos;t be used.
          </p>
          {linkError && <p className="text-[12px] text-se-steel font-accent">{linkError}</p>}
          <Link to="/forgot-password" className="btn-primary w-full">Send a New Reset Link</Link>
          <p className="text-[11px] font-accent text-se-steel">
            <Link to="/login" className="hover:text-se-gold transition">Back to log in</Link>
          </p>
        </div>
      )}

      {phase === "done" && (
        <div className="glass-panel p-8 text-center">
          <p className="text-[14px] text-se-bone/70 font-accent">
            Password updated. Redirecting to log in…
          </p>
        </div>
      )}

      {phase === "form" && (
        <form onSubmit={handleSubmit} className="glass-panel p-6 space-y-5">
          <div>
            <label className={authLabel} htmlFor="rp-password">New Password</label>
            <input id="rp-password" type="password" autoComplete="new-password" value={password}
              onChange={(e) => setPassword(e.target.value)} required minLength={8} className={authInput} />
          </div>
          <div>
            <label className={authLabel} htmlFor="rp-confirm">Confirm New Password</label>
            <input id="rp-confirm" type="password" autoComplete="new-password" value={confirm}
              onChange={(e) => setConfirm(e.target.value)} required minLength={8} className={authInput} />
          </div>
          {error && <p className="text-[12px] text-se-red-bright font-accent">{error}</p>}
          <button type="submit" disabled={busy} className="btn-primary w-full">
            {busy ? "Updating…" : "Update Password"}
          </button>
          <p className="text-[11px] font-accent text-se-steel text-center">
            <Link to="/login" className="hover:text-se-gold transition">Back to log in</Link>
          </p>
        </form>
      )}
    </AuthLayout>
  );
}
