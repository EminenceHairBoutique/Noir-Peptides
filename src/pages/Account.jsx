// src/pages/Account.jsx
// Gated account dashboard. This route is wrapped in <RequireAuth>, so a
// session is guaranteed here; the dedicated /login and /register pages own
// authentication. Dashboard shows profile, orders, and the attestation record.
import React from "react";
import AccountDashboard from "../components/account/AccountDashboard";

export default function Account() {
  return <AccountDashboard />;
}
