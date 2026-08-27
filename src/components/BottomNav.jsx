// src/components/BottomNav.jsx
// Mobile bottom navigation (MOBILE_ROADMAP #8): Catalog · Verify · Account ·
// Cart in thumb reach. md:hidden — desktop keeps the top chrome. Hidden on
// product pages, where the sticky buy bar owns the bottom edge (stacking both
// would spend ~110px of a small viewport on chrome). Fixed position, so it
// never causes layout shift; App adds matching bottom padding to keep the
// footer reachable above it.
import { NavLink, useLocation } from "react-router-dom";
import { LayoutGrid, ScanLine, User, ShoppingBag } from "lucide-react";
import { useCart } from "../context/CartContext";
import { useUser } from "../context/UserContext";

const linkBase =
  "flex flex-col items-center justify-center gap-1 flex-1 min-h-[52px] text-[9px] font-accent uppercase tracking-[0.12em] transition-colors";

function tabClass({ isActive }) {
  return `${linkBase} ${isActive ? "text-se-gold" : "text-se-steel hover:text-se-bone"}`;
}

export default function BottomNav() {
  const { items, isOpen, openCart } = useCart();
  const { authStatus } = useUser();
  const location = useLocation();

  // The PDP's sticky buy bar owns the bottom edge there.
  if (location.pathname.startsWith("/product/") || location.pathname.startsWith("/products/")) {
    return null;
  }

  const count = items.reduce((n, it) => n + (it.quantity || 0), 0);
  const accountTo = authStatus === "authed" ? "/account" : "/login";

  return (
    <>
      {/* In-flow spacer: keeps the footer reachable above the fixed bar.
          Rendered together with the bar, so pages where the bar is absent
          (PDP) pay no dead space. */}
      <div aria-hidden="true" className="md:hidden" style={{ height: "calc(52px + env(safe-area-inset-bottom))" }} />
      <nav
      aria-label="Primary"
      className="md:hidden fixed inset-x-0 bottom-0 z-40 border-t border-se-concrete bg-se-black/95 backdrop-blur-sm"
      style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
    >
      <div className="flex items-stretch">
        <NavLink to="/shop" className={tabClass}>
          <LayoutGrid size={18} aria-hidden="true" />
          Catalog
        </NavLink>
        <NavLink to="/verify-lot" className={tabClass}>
          <ScanLine size={18} aria-hidden="true" />
          Verify
        </NavLink>
        <NavLink to={accountTo} className={tabClass}>
          <User size={18} aria-hidden="true" />
          Account
        </NavLink>
        <button
          type="button"
          onClick={openCart}
          aria-haspopup="dialog"
          aria-expanded={isOpen}
          className={`${linkBase} relative ${isOpen ? "text-se-gold" : "text-se-steel hover:text-se-bone"}`}
        >
          <span className="relative">
            <ShoppingBag size={18} aria-hidden="true" />
            {count > 0 && (
              <span
                aria-hidden="true"
                className="absolute -top-1.5 -right-2 min-w-[15px] h-[15px] px-0.5 rounded-full bg-se-gold text-se-black text-[9px] font-bold leading-[15px] text-center"
              >
                {count > 99 ? "99+" : count}
              </span>
            )}
          </span>
          Cart{count > 0 ? ` (${count})` : ""}
        </button>
      </div>
      </nav>
    </>
  );
}
