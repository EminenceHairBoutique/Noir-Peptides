// src/pages/ResetPassword.jsx
// Supabase delivers a recovery session via the email link; updateUser sets the
// new password for that session.
import React, { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { supabase } from "../lib/supabaseClient";
import AuthLayout, { authInput, authLabel } from "../components/AuthLayout";

export default function ResetPassword() {
  const navigate = useNavigate();
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [status, setStatus] = useState("idle");
  const [error, setError] = useState("");

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    if (password !== confirm) {
      setError("Passwords do not match.");
      return;
    }
    if (password.length < 8) {
      setError("Use at least 8 characters.");
      return;
    }
    if (!supabase) {
      setError("Auth not configured.");
      return;
    }
    setStatus("loading");
    try {
      const { error: err } = await supabase.auth.updateUser({ password });
      if (err) throw err;
      setStatus("done");
      setTimeout(() => navigate("/login", { replace: true }), 1500);
    } catch (err) {
      setError(err?.message || "Unable to update password.");
      setStatus("idle");
    }
  };

  return (
    <AuthLayout title="Set New Password" seoTitle="Set New Password | Noir Peptides">
      {status === "done" ? (
        <div className="glass-panel p-8 text-center">
          <p className="text-[14px] text-se-bone/70 font-accent">
            Password updated. Redirecting to log in…
          </p>
        </div>
      ) : (
        <form onSubmit={handleSubmit} className="glass-panel p-6 space-y-5">
          <div>
            <label className={authLabel} htmlFor="rp-password">New Password</label>
            <input id="rp-password" type="password" autoComplete="new-password" value={password}
              onChange={(e) => setPassword(e.target.value)} required className={authInput} />
          </div>
          <div>
            <label className={authLabel} htmlFor="rp-confirm">Confirm New Password</label>
            <input id="rp-confirm" type="password" autoComplete="new-password" value={confirm}
              onChange={(e) => setConfirm(e.target.value)} required className={authInput} />
          </div>
          {error && <p className="text-[12px] text-se-red-bright font-accent">{error}</p>}
          <button type="submit" disabled={status === "loading"} className="btn-primary w-full">
            {status === "loading" ? "Updating…" : "Update Password"}
          </button>
          <p className="text-[11px] font-accent text-se-steel text-center">
            <Link to="/login" className="hover:text-se-gold transition">Back to log in</Link>
          </p>
        </form>
      )}
    </AuthLayout>
  );
}
