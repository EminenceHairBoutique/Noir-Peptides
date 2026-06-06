import React, { createContext, useContext, useEffect, useMemo, useState } from "react";
import { supabase } from "../lib/supabaseClient";
import { ATTESTATION_VERSION } from "../config/attestation";


const UserContext = createContext();

/* =========================
   Base User Shape
========================= */

const EMPTY_USER = {
  id: null,
  name: "",
  email: "",
  phone: "",
  // Account access tier (separate from loyalty tiers)
  // - customer (default)
  // - partner_pending
  // - partner
  accountTier: "customer",
  partnerStatus: "none",
  partnerTier: null,
  loyaltyPoints: 0,
  orders: [],
  wishlist: [],
  address: {
    line1: "",
    line2: "",
    city: "",
    state: "",
    postalCode: "",
    country: "",
  },
  referrals: {
    code: "",
    referredCount: 0,
    rewardBalance: 0,
  },
  createdAt: null,
};

/* =========================
   Helpers
========================= */

const generateReferralCode = (idOrEmail = "") => {
  const base =
    idOrEmail.replace(/[^A-Za-z0-9]/g, "").slice(-5).toUpperCase() ||
    Date.now().toString().slice(-5);
  return `NP-${base}`;
};

const hydrateUser = (raw) => {
  if (!raw) return null;

  const mergedAddress = {
    ...EMPTY_USER.address,
    ...(raw.address || {}),
  };

  const mergedReferrals = {
    ...EMPTY_USER.referrals,
    ...(raw.referrals || {}),
  };

  if (!mergedReferrals.code) {
    mergedReferrals.code = generateReferralCode(raw.id || raw.email || "");
  }

  return {
    ...EMPTY_USER,
    ...raw,
    address: mergedAddress,
    referrals: mergedReferrals,
    createdAt: raw.createdAt || new Date().toISOString(),
  };
};

/* =========================
   Provider
========================= */

export const UserProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  // Load account access + attestation state from public.profiles.
  // The attestation fields back the hard auth wall (see RequireAuth).
  // Columns are selected defensively so the app degrades safely if a given
  // migration hasn't been applied yet.
  const FALLBACK_ACCESS = {
    accountTier: "customer",
    partnerStatus: "none",
    partnerTier: null,
    role: "customer",
    attestationCompletedAt: null,
    attestationVersion: null,
  };

  const fetchAccountAccess = async (userId) => {
    if (!userId || !supabase) return { ...FALLBACK_ACCESS };
    try {
      const { data, error } = await supabase
        .from("profiles")
        .select(
          "account_tier, partner_status, partner_tier, role, attestation_completed_at, attestation_version"
        )
        .eq("id", userId)
        .maybeSingle();

      if (error) return { ...FALLBACK_ACCESS };

      return {
        accountTier: data?.account_tier || "customer",
        partnerStatus: data?.partner_status || "none",
        partnerTier: data?.partner_tier ?? null,
        role: data?.role || "customer",
        attestationCompletedAt: data?.attestation_completed_at ?? null,
        attestationVersion: data?.attestation_version ?? null,
      };
    } catch (_e) {
      return { ...FALLBACK_ACCESS };
    }
  };

  /* ---------- SESSION HYDRATION ---------- */
  useEffect(() => {
    let mounted = true;
    let subscriptionRef = null;

    (async () => {
      if (!supabase) { if (mounted) setLoading(false); return; }
      try {
        const { data } = await supabase.auth.getSession();
        const supaUser = data?.session?.user;
        if (!mounted) return;
        if (supaUser) {
          const access = await fetchAccountAccess(supaUser.id);
          setUser(
            hydrateUser({
              id: supaUser.id,
              email: supaUser.email,
              name: supaUser.user_metadata?.full_name || "",
              ...access,
            })
          );
        } else {
          setUser(null);
        }
      } catch (_err) {
        // ignore - keep user null
      } finally {
        if (mounted) setLoading(false);
      }
    })();

    if (!supabase) return () => {};
    const res = supabase.auth.onAuthStateChange((_event, session) => {
      const supaUser = session?.user;
      if (!mounted) return;
      if (!supaUser) {
        setUser(null);
        setLoading(false);
        return;
      }
      // CRITICAL: never `await` a Supabase call directly inside this callback.
      // The auth client holds an internal lock while the callback runs, so a
      // nested query (fetchAccountAccess -> supabase.from) deadlocks and never
      // resolves — the symptom is login getting stuck on "Signing in…".
      // Defer the profile fetch to a fresh macrotask so the lock is released
      // first. Keep loading=true until access is known so the attestation
      // redirect uses the real value (no false bounce to /register/attestation).
      setTimeout(async () => {
        if (!mounted) return;
        const access = await fetchAccountAccess(supaUser.id);
        if (!mounted) return;
        setUser(
          hydrateUser({
            id: supaUser.id,
            email: supaUser.email,
            name: supaUser.user_metadata?.full_name || "",
            ...access,
          })
        );
        setLoading(false);
      }, 0);
    });

    // handle different return shapes across supabase clients
    subscriptionRef = res?.data?.subscription ?? res?.subscription ?? res?.data;

    return () => {
      mounted = false;
      if (subscriptionRef) {
        if (typeof subscriptionRef.unsubscribe === "function") {
          subscriptionRef.unsubscribe();
        } else if (typeof subscriptionRef.remove === "function") {
          subscriptionRef.remove();
        }
      }
    };
  }, []);

  /* =========================
     AUTH METHODS (REAL)
  ========================= */

  const register = async ({ email, password }) => {
    if (!supabase) throw new Error("Auth not configured");
    const { data, error } = await supabase.auth.signUp({ email, password });
    if (error) throw error;
    return data;
  };

  const login = async ({ email, password }) => {
    if (!supabase) throw new Error("Auth not configured");
    const { data, error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) throw error;
    return data;
  };

  const loginWithGoogle = async () => {
    if (!supabase) throw new Error("Auth not configured");
    const { error } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: { redirectTo: window.location.origin },
    });
    if (error) throw error;
  };

  const logout = async () => {
    if (supabase) await supabase.auth.signOut();
    setUser(null);
  };

  /* =========================
     RESEARCH-USE ATTESTATION
  ========================= */

  // Records the attestation through the server route (which derives IP/UA and
  // writes the append-only audit row), then refreshes local profile state so
  // the route guard immediately unlocks the storefront.
  const recordAttestation = async ({ statements, legalName, version }) => {
    if (!supabase) throw new Error("Auth not configured");
    const { data: sessionData } = await supabase.auth.getSession();
    const token = sessionData?.session?.access_token;
    if (!token) throw new Error("You must be signed in to attest.");

    const res = await fetch("/api/attestation", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({
        version: version || ATTESTATION_VERSION,
        statements,
        legalName,
      }),
    });

    if (!res.ok) {
      const msg = await res.text().catch(() => "");
      throw new Error(msg || "Failed to record attestation.");
    }

    const data = await res.json();
    setUser((prev) =>
      prev
        ? {
            ...prev,
            attestationCompletedAt:
              data.attestation_completed_at || new Date().toISOString(),
            attestationVersion: data.attestation_version || ATTESTATION_VERSION,
          }
        : prev
    );
    return data;
  };

  // Re-pull profile (used after OAuth return or external changes).
  const refreshProfile = async () => {
    if (!user?.id) return;
    const access = await fetchAccountAccess(user.id);
    setUser((prev) => (prev ? hydrateUser({ ...prev, ...access }) : prev));
  };

  /* =========================
     PROFILE / COMMERCE LOGIC
     (UNCHANGED FROM YOUR WORK)
  ========================= */

  const addOrder = (order) => {
    setUser((prev) => {
      if (!prev) return prev;
      const orderWithDefaults = {
        id: order.id || Date.now().toString(),
        createdAt: order.createdAt || new Date().toISOString(),
        status: order.status || "Processing",
        items: order.items || [],
        total: order.total || 0,
      };
      return {
        ...prev,
        orders: [orderWithDefaults, ...(prev.orders || [])],
        loyaltyPoints:
          (prev.loyaltyPoints || 0) +
          Math.round((orderWithDefaults.total || 0) / 10),
      };
    });
  };

  const addLoyaltyPoints = (points) => {
    setUser((prev) => {
      if (!prev) return prev;
      return {
        ...prev,
        loyaltyPoints: (prev.loyaltyPoints || 0) + (points || 0),
      };
    });
  };

  const updateProfile = (updates) => {
    setUser((prev) => {
      if (!prev) return prev;
      return hydrateUser({
        ...prev,
        ...updates,
        address: {
          ...(prev.address || EMPTY_USER.address),
          ...(updates.address || {}),
        },
      });
    });
  };

  const toggleWishlistItem = (item) => {
    setUser((prev) => {
      if (!prev) return prev;
      const wishlist = prev.wishlist || [];
      const exists = wishlist.find((p) => p.id === item.id);
      return {
        ...prev,
        wishlist: exists
          ? wishlist.filter((p) => p.id !== item.id)
          : [...wishlist, item],
      };
    });
  };

  /* =========================
     DERIVED AUTH STATE (the wall reads this)
  ========================= */

  // Explicit state machine: render a splash while "loading" so a logged-in
  // user is never bounced to /login on refresh (the AdminRoute race lesson).
  const authStatus = loading ? "loading" : user ? "authed" : "guest";

  // Attestation is "complete" only if recorded AND on the current version.
  const attestationComplete = useMemo(() => {
    if (!user?.attestationCompletedAt) return false;
    return user.attestationVersion === ATTESTATION_VERSION;
  }, [user]);

  const needsAttestation = authStatus === "authed" && !attestationComplete;
  const isAdmin = (user?.role || "") === "admin";

  return (
    <UserContext.Provider
      value={{
        user,
        loading,
        authStatus,
        attestationComplete,
        needsAttestation,
        isAdmin,
        register,
        login,
        loginWithGoogle,
        logout,
        recordAttestation,
        refreshProfile,
        addOrder,
        addLoyaltyPoints,
        updateProfile,
        toggleWishlistItem,
      }}
    >
      {children}
    </UserContext.Provider>
  );
};

export const useUser = () => useContext(UserContext);
