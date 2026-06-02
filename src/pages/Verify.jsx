// src/pages/Verify.jsx
// Post-signup email verification notice. Supabase confirms the email via its
// own link; this page is the informational landing + a path back to log in.
import React from "react";
import { Link } from "react-router-dom";
import { MailCheck } from "lucide-react";
import AuthLayout from "../components/AuthLayout";

export default function Verify() {
  return (
    <AuthLayout title="Verify Your Email" seoTitle="Verify Email | Noir Peptides">
      <div className="glass-panel p-8 text-center">
        <MailCheck className="w-8 h-8 text-se-gold mx-auto mb-4" strokeWidth={1.5} />
        <p className="text-[14px] text-se-bone/70 font-accent leading-relaxed mb-6">
          Check your inbox for a verification link. After confirming your email,
          log in to complete your research-use attestation and access the
          catalog.
        </p>
        <Link to="/login" className="btn-primary w-full">Back to Log In</Link>
      </div>
    </AuthLayout>
  );
}
