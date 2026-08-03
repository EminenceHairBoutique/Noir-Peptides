// src/pages/Login.jsx
import React, { useEffect, useState } from "react";
import { Link, useNavigate, useLocation } from "react-router-dom";
import { useUser } from "../context/UserContext";
import AuthLayout, { authInput, authLabel } from "../components/AuthLayout";
import { safeRedirectPath } from "../lib/safeRedirect";

export default function Login() {
  const { login, loginWithGoogle, authStatus, attestationComplete } = useUser();
  const navigate = useNavigate();
  const location = useLocation();
  const intended = location.state?.from;

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  // Once the session resolves to authed, route based on attestation state.
  useEffect(() => {
    if (authStatus !== "authed") return;
    if (!attestationComplete) {
      navigate("/register/attestation", { replace: true });
    } else {
      // Open-redirect guard: a stored pathname like "//evil.example" is
      // protocol-relative and would navigate off-site (see lib/safeRedirect.js).
      navigate(safeRedirectPath(intended), { replace: true });
    }
  }, [authStatus, attestationComplete, intended, navigate]);

  const handleLogin = async (e) => {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      await login({ email, password });
      // Navigation handled by the effect above once authStatus flips.
    } catch (err) {
      setError(err?.message || "Unable to sign in.");
      setLoading(false);
    }
  };

  return (
    <AuthLayout
      title="Log In"
      seoTitle="Log In | Noir Peptides"
      subtitle="Access the research catalog. Qualified purchasers only."
    >
      <form onSubmit={handleLogin} className="glass-panel p-6 space-y-5">
        <div>
          <label className={authLabel} htmlFor="login-email">Email</label>
          <input id="login-email" type="email" autoComplete="email" value={email}
            onChange={(e) => setEmail(e.target.value)} required className={authInput} />
        </div>
        <div>
          <label className={authLabel} htmlFor="login-password">Password</label>
          <input id="login-password" type="password" autoComplete="current-password" value={password}
            onChange={(e) => setPassword(e.target.value)} required className={authInput} />
        </div>

        {error && <p className="text-[12px] text-se-red-bright font-accent">{error}</p>}

        <button type="submit" disabled={loading} className="btn-primary w-full">
          {loading ? "Signing in…" : "Log In"}
        </button>

        <button
          type="button"
          onClick={() => loginWithGoogle().catch((e) => setError(e?.message || "OAuth failed"))}
          className="btn-outline w-full"
        >
          Continue with Google
        </button>

        <div className="flex items-center justify-between pt-2 text-[11px] font-accent text-se-steel">
          <Link to="/forgot-password" className="hover:text-se-gold transition">Forgot password?</Link>
          <Link to="/register" className="hover:text-se-gold transition">Create account</Link>
        </div>
      </form>

      <p className="text-[10px] font-accent uppercase tracking-[0.16em] text-se-steel text-center mt-6">
        For research use only · Not for human or veterinary use
      </p>
    </AuthLayout>
  );
}
