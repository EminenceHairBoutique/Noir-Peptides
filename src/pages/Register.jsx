// src/pages/Register.jsx — Step A: account credentials
import React, { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { MailCheck } from "lucide-react";
import { useUser } from "../context/UserContext";
import AuthLayout, { authInput, authLabel } from "../components/AuthLayout";

export default function Register() {
  const { register, authStatus, attestationComplete } = useUser();
  const navigate = useNavigate();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [needsVerify, setNeedsVerify] = useState(false);

  // If sign-up created a live session (email confirmation disabled), the user
  // is authed but not attested → go straight to Step B.
  useEffect(() => {
    if (authStatus === "authed" && !attestationComplete) {
      navigate("/register/attestation", { replace: true });
    }
  }, [authStatus, attestationComplete, navigate]);

  const handleRegister = async (e) => {
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
    setLoading(true);
    try {
      const data = await register({ email, password });
      // If no session returned, email verification is required.
      if (!data?.session) {
        setNeedsVerify(true);
        setLoading(false);
      }
      // else: effect routes to attestation.
    } catch (err) {
      setError(err?.message || "Unable to create account.");
      setLoading(false);
    }
  };

  if (needsVerify) {
    return (
      <AuthLayout title="Verify Your Email" seoTitle="Verify Email | Noir Peptides">
        <div className="glass-panel p-8 text-center">
          <MailCheck className="w-8 h-8 text-se-gold mx-auto mb-4" strokeWidth={1.5} />
          <p className="text-[14px] text-se-bone/70 font-accent leading-relaxed mb-6">
            We sent a verification link to <span className="text-se-bone">{email}</span>.
            Confirm your email, then return to log in and complete your
            research-use attestation.
          </p>
          <Link to="/login" className="btn-primary w-full">Back to Log In</Link>
        </div>
      </AuthLayout>
    );
  }

  return (
    <AuthLayout
      title="Create Account"
      seoTitle="Create Account | Noir Peptides"
      subtitle="Step 1 of 2 — account credentials. A research-use attestation follows."
    >
      <form onSubmit={handleRegister} className="glass-panel p-6 space-y-5">
        <div>
          <label className={authLabel} htmlFor="reg-email">Email</label>
          <input id="reg-email" type="email" autoComplete="email" value={email}
            onChange={(e) => setEmail(e.target.value)} required className={authInput} />
        </div>
        <div>
          <label className={authLabel} htmlFor="reg-password">Password</label>
          <input id="reg-password" type="password" autoComplete="new-password" value={password}
            onChange={(e) => setPassword(e.target.value)} required className={authInput} />
        </div>
        <div>
          <label className={authLabel} htmlFor="reg-confirm">Confirm Password</label>
          <input id="reg-confirm" type="password" autoComplete="new-password" value={confirm}
            onChange={(e) => setConfirm(e.target.value)} required className={authInput} />
        </div>

        {error && <p className="text-[12px] text-se-red-bright font-accent">{error}</p>}

        <button type="submit" disabled={loading} className="btn-primary w-full">
          {loading ? "Creating…" : "Continue to Attestation"}
        </button>

        <p className="text-[11px] font-accent text-se-steel text-center pt-1">
          Already have an account?{" "}
          <Link to="/login" className="text-se-gold hover:underline">Log in</Link>
        </p>
      </form>

      <p className="text-[10px] font-accent text-se-steel/80 text-center mt-6 leading-relaxed">
        By creating an account you confirm you are a qualified purchaser acquiring
        research materials for laboratory use only.
      </p>
    </AuthLayout>
  );
}
