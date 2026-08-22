import React, { useEffect, useMemo, useState } from "react";
import { Link, NavLink, useLocation } from "react-router-dom";
import { ShoppingBag, Menu, X, User, ChevronRight } from "lucide-react";
import { useCart } from "../context/CartContext";
import { useUser } from "../context/UserContext";

function Logo({ className = "" }) {
  return (
    <Link to="/" className={`flex items-center gap-2 leading-none ${className}`}>
      <span className="font-display text-[15px] sm:text-[17px] md:text-[19px] tracking-[0.12em] sm:tracking-[0.22em] text-se-bone font-extrabold whitespace-nowrap">
        NOIR
      </span>
      <span
        className="inline-block w-1.5 h-1.5 rounded-full bg-se-gold"
        aria-hidden="true"
        style={{ boxShadow: "0 0 8px rgba(0,194,255,0.8)" }}
      />
      <span className="font-display text-[15px] sm:text-[17px] md:text-[19px] tracking-[0.12em] sm:tracking-[0.22em] text-se-bone font-extrabold whitespace-nowrap">
        PEPTIDES
      </span>
    </Link>
  );
}

export default function Navbar() {
  const { items, openCart } = useCart();
  const { authStatus } = useUser();
  const location = useLocation();
  const isAuthed = authStatus === "authed";

  const [mobileOpen, setMobileOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    setMobileOpen(false);
  }, [location.pathname]);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 30);
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  useEffect(() => {
    document.body.style.overflow = mobileOpen ? "hidden" : "";
    return () => {
      document.body.style.overflow = "";
    };
  }, [mobileOpen]);

  const navLinks = useMemo(
    () => [
      { label: "Research Catalog", href: "/shop" },
      { label: "COA Policy", href: "/coa-policy" },
      { label: "About", href: "/about" },
      { label: "FAQ", href: "/faqs" },
      { label: "Disclaimer", href: "/legal/fda-disclaimer" },
    ],
    []
  );

  const mobileLinks = useMemo(
    () => [
      { label: "Research Catalog", href: "/shop" },
      { label: "COA Policy", href: "/coa-policy" },
      { label: "Quality & Batch Standards", href: "/quality" },
      { label: "About", href: "/about" },
      { label: "FAQ", href: "/faqs" },
      { divider: true },
      { label: "Contact", href: "/contact" },
      { label: "Account", href: "/account" },
      { label: "Research-Use Policy", href: "/legal/research-use-policy" },
      { label: "Disclaimer", href: "/legal/fda-disclaimer" },
    ],
    []
  );

  const itemCount = items.reduce((sum, i) => sum + (i.quantity || 1), 0);

  return (
    <>
      <header
        style={{ paddingTop: "env(safe-area-inset-top)" }}
        className={`fixed top-0 left-0 w-full z-50 transition-all duration-300 ${
          scrolled
            ? "bg-se-black/95 backdrop-blur-md border-b border-se-concrete"
            : "bg-se-black/70 backdrop-blur-sm border-b border-transparent"
        }`}
      >
        {/* Compliance announcement bar. Tracking relaxes below sm: heavy
            letter-spacing on this long line at 320px orphaned "use" onto its
            own line. balanced wrap keeps it to two even lines when it must. */}
        <div className="bg-se-charcoal border-b border-se-concrete text-center py-1.5 px-3">
          <p className="text-label text-[9px] tracking-[0.1em] sm:tracking-[0.25em] text-se-steel [text-wrap:balance]">
            For research use only — Not for human or veterinary use
          </p>
        </div>

        <div className="max-w-[1440px] mx-auto px-4 sm:px-6 py-4 flex items-center justify-between gap-2">
          {isAuthed ? (
            <button
              type="button"
              onClick={() => setMobileOpen(true)}
              className="md:hidden p-2 -ml-2"
              aria-label="Open menu"
            >
              <Menu size={22} className="text-se-bone" />
            </button>
          ) : (
            <span className="md:hidden w-6" aria-hidden="true" />
          )}

          <Logo />

          {isAuthed ? (
            <>
              <nav className="hidden md:flex items-center gap-8 text-[11px] uppercase tracking-[0.18em] font-accent text-se-bone/60">
                {navLinks.map((link) => (
                  <NavLink
                    key={link.href}
                    to={link.href}
                    className={({ isActive }) =>
                      `link-hover transition-colors duration-200 ${
                        isActive ? "text-se-gold" : "hover:text-se-bone"
                      }`
                    }
                  >
                    {link.label}
                  </NavLink>
                ))}
              </nav>

              <div className="flex items-center gap-1">
                <Link
                  to="/account"
                  className="hidden sm:inline-flex p-2 rounded-full hover:bg-white/5 transition"
                  aria-label="My account"
                >
                  <User size={18} className="text-se-bone/60 hover:text-se-gold transition-colors" />
                </Link>
                <button
                  onClick={openCart}
                  className="relative p-2 rounded-full hover:bg-white/5 transition"
                  aria-label="Open cart"
                >
                  <ShoppingBag size={18} className="text-se-bone/60 hover:text-se-gold transition-colors" />
                  {itemCount > 0 && (
                    <span className="absolute -top-0.5 -right-0.5 bg-se-gold text-[#04121b] text-[9px] font-accent font-semibold rounded-full h-4 w-4 flex items-center justify-center">
                      {itemCount}
                    </span>
                  )}
                </button>
              </div>
            </>
          ) : (
            // Guest chrome (only shown on public legal pages) — auth entry only.
            // shrink-0 + no-wrap so at 320px these never overlap the wordmark or
            // clip off the right edge; tracking/padding relax below sm.
            <div className="flex items-center gap-3 shrink-0">
              <Link
                to="/login"
                className="text-[11px] font-accent uppercase tracking-[0.1em] sm:tracking-[0.18em] text-se-bone/70 hover:text-se-gold transition whitespace-nowrap"
              >
                Log In
              </Link>
              {/* Three inline elements (wordmark + both actions) can't fit
                  320px, so the CTA is hidden below sm. Wrapped in a span so the
                  `hidden` actually applies — btn-primary sets display:inline-flex,
                  which overrides a `hidden` placed directly on the Link. The Log
                  In link above reaches /login (which links to registration), so
                  both auth paths stay one tap away. */}
              <span className="hidden sm:inline-flex">
                <Link to="/register" className="btn-primary text-[10px] px-4 py-2 whitespace-nowrap">
                  Create Account
                </Link>
              </span>
            </div>
          )}
        </div>
      </header>

      {/* Mobile drawer (authed only) */}
      {isAuthed && mobileOpen && (
        <div className="fixed inset-0 z-[100]">
          <div
            className="absolute inset-0 bg-black/70 backdrop-blur-sm"
            onClick={() => setMobileOpen(false)}
          />
          <div className="absolute left-0 top-0 h-full w-[85%] max-w-[360px] bg-se-charcoal border-r border-se-concrete overflow-y-auto animate-dropdown-in">
            <div className="flex items-center justify-between p-6 border-b border-se-concrete">
              <Logo />
              <button onClick={() => setMobileOpen(false)} className="p-2 -mr-2" aria-label="Close menu">
                <X size={20} className="text-se-bone/70" />
              </button>
            </div>

            <nav className="p-6 space-y-1">
              {mobileLinks.map((link, i) =>
                link.divider ? (
                  <hr key={`div-${i}`} className="divider my-4" />
                ) : (
                  <Link
                    key={link.href}
                    to={link.href}
                    className="flex items-center justify-between py-3 text-[13px] tracking-[0.1em] uppercase font-accent text-se-bone/80 hover:text-se-gold transition"
                  >
                    {link.label}
                    <ChevronRight size={14} className="text-se-steel" />
                  </Link>
                )
              )}
            </nav>

            <div className="p-6 border-t border-se-concrete">
              <p className="text-[10px] text-se-steel tracking-[0.15em] uppercase font-accent">
                For research use only · Not for human or veterinary use
              </p>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
