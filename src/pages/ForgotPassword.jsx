// src/pages/ForgotPassword.jsx
import React, { useState } from "react";
import { Link } from "react-router-dom";
import { supabase } from "../lib/supabaseClient";
import { siteOrigin } from "../lib/siteUrl";
import AuthLayout, { authInput, authLabel } from "../components/AuthLayout";

export default function ForgotPassword() {
  const [email, setEmail] = useState("");
  const [status, setStatus] = useState("idle");
  const [error, setError] = useState("");

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    if (!supabase) {
      setError("Auth not configured.");
      return;
    }
    setStatus("loading");
    try {
      const { error: err } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: `${siteOrigin()}/reset-password`,
      });
      if (err) throw err;
      setStatus("sent");
    } catch (err) {
      setError(err?.message || "Unable to send reset email.");
      setStatus("idle");
    }
  };

  return (
    <AuthLayout title="Reset Password" seoTitle="Reset Password | Noir Peptides">
      {status === "sent" ? (
        <div className="glass-panel p-8 text-center">
          <p className="text-[14px] text-se-bone/70 font-accent leading-relaxed mb-6">
            If an account exists for <span className="text-se-bone">{email}</span>,
            a password reset link is on its way.
          </p>
          <Link to="/login" className="btn-primary w-full">Back to Log In</Link>
        </div>
      ) : (
        <form onSubmit={handleSubmit} className="glass-panel p-6 space-y-5">
          <div>
            <label className={authLabel} htmlFor="fp-email">Email</label>
            <input id="fp-email" type="email" autoComplete="email" value={email}
              onChange={(e) => setEmail(e.target.value)} required className={authInput} />
          </div>
          {error && <p className="text-[12px] text-se-red-bright font-accent">{error}</p>}
          <button type="submit" disabled={status === "loading"} className="btn-primary w-full">
            {status === "loading" ? "Sending…" : "Send Reset Link"}
          </button>
          <p className="text-[11px] font-accent text-se-steel text-center">
            <Link to="/login" className="hover:text-se-gold transition">Back to log in</Link>
          </p>
        </form>
      )}
    </AuthLayout>
  );
}
