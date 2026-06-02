// src/components/RequireAdmin.jsx
// Admin tier guard. Server-side admin enforcement still applies on every
// /api/admin/* call + RLS; this is the UX gate.
import React from "react";
import { Navigate, useLocation } from "react-router-dom";
import { useUser } from "../context/UserContext";
import AuthSplash from "./AuthSplash";

export default function RequireAdmin({ children }) {
  const { authStatus, isAdmin } = useUser();
  const location = useLocation();

  if (authStatus === "loading") return <AuthSplash />;

  if (authStatus === "guest") {
    return <Navigate to="/login" state={{ from: location.pathname }} replace />;
  }

  if (!isAdmin) {
    return <Navigate to="/" replace />;
  }

  return children;
}
