// src/pages/AdminHome.jsx — admin tier placeholder (Phase 6 CMS lands here)
import React from "react";
import { Link } from "react-router-dom";
import SEO from "../components/SEO";

export default function AdminHome() {
  return (
    <>
      <SEO title="Admin | Noir Peptides" noindex />
      <div className="bg-se-black text-se-bone min-h-screen pt-28 pb-24">
        <div className="content-wide">
          <p className="text-overline mb-3">Admin</p>
          <h1 className="font-display font-extrabold text-[clamp(1.6rem,4vw,2.6rem)] tracking-[0.02em] mb-4">
            CONTROL ROOM
          </h1>
          <p className="text-[14px] text-se-bone/55 font-accent max-w-xl mb-8">
            Catalog, variant &amp; price-tier editor, COA uploader, order
            management, and legal/CMS editing land here in Phase 6. Access is
            restricted to admin profiles via route guard and Supabase RLS.
          </p>
          <Link to="/home" className="btn-outline">Back to Store</Link>
        </div>
      </div>
    </>
  );
}
