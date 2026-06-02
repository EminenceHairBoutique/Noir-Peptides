// src/components/RequireAuth.jsx
// The auth wall (UX layer). Supabase RLS is the real lock; this guard governs
// what renders. State machine: loading -> splash, guest -> /login,
// authed-but-unattested -> /register/attestation, else render.
import React from "react";
import { Navigate, useLocation } from "react-router-dom";
import { useUser } from "../context/UserContext";
import AuthSplash from "./AuthSplash";

export default function RequireAuth({ children }) {
  const { authStatus, needsAttestation } = useUser();
  const location = useLocation();

  // Resolve loading BEFORE deciding to redirect — never bounce on refresh.
  if (authStatus === "loading") return <AuthSplash />;

  if (authStatus === "guest") {
    return <Navigate to="/login" state={{ from: location.pathname }} replace />;
  }

  // Authenticated but attestation missing or stale-versioned.
  if (needsAttestation) {
    return <Navigate to="/register/attestation" replace />;
  }

  return children;
}
