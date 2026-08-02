import React, { Suspense, lazy } from "react";
import { Routes, Route, useLocation, useParams, Navigate } from "react-router-dom";
import { motion as Motion } from "framer-motion";
import { useCart } from "./context/CartContext";
import CookieBanner from "./components/legal/CookieBanner";
import TrackingScripts from "./components/TrackingScripts";
import AgeGate from "./components/AgeGate";
const CartDrawer = lazy(() => import("./components/CartDrawer"));
import useRouteAnalytics from "./hooks/useRouteAnalytics";

// Layout
import Navbar from "./components/Navbar";
import Footer from "./components/Footer";
import ScrollToTop from "./components/ScrollToTop";

// Guards
import RequireAuth from "./components/RequireAuth";
import RequireAdmin from "./components/RequireAdmin";
import ErrorBoundary from "./components/ErrorBoundary";
import RouteSkeleton from "./components/RouteSkeleton";

// ── Public tier (logged-out reachable) ──
const PublicLanding = lazy(() => import("./pages/PublicLanding"));
const Login = lazy(() => import("./pages/Login"));
const Register = lazy(() => import("./pages/Register"));
const RegisterAttestation = lazy(() => import("./pages/RegisterAttestation"));
const Verify = lazy(() => import("./pages/Verify"));
const ForgotPassword = lazy(() => import("./pages/ForgotPassword"));
const ResetPassword = lazy(() => import("./pages/ResetPassword"));
const AuthConfirm = lazy(() => import("./pages/AuthConfirm"));

// ── Public education (indexable, non-commerce) ──
const Research = lazy(() => import("./pages/Research"));
const ResearchArticle = lazy(() => import("./pages/ResearchArticle"));
const Calculator = lazy(() => import("./pages/Calculator"));
const Deals = lazy(() => import("./pages/Deals"));
const TestResults = lazy(() => import("./pages/TestResults"));
const VerifyLot = lazy(() => import("./pages/VerifyLot"));

// ── Public legal docs ──
const Terms = lazy(() => import("./pages/Terms"));
const Privacy = lazy(() => import("./pages/Privacy"));
const ResearchUsePolicy = lazy(() => import("./pages/ResearchUsePolicy"));
const FdaDisclaimer = lazy(() => import("./pages/FdaDisclaimer"));
const ShippingRefunds = lazy(() => import("./pages/ShippingRefunds"));

// ── Gated tier (require auth + attestation) ──
const ResearcherConsole = lazy(() => import("./pages/ResearcherConsole"));
const Assistant = lazy(() => import("./pages/Assistant"));
const About = lazy(() => import("./pages/About"));
const Shop = lazy(() => import("./pages/Shop"));
const ProductDetail = lazy(() => import("./pages/ProductDetail"));
const Cart = lazy(() => import("./pages/Cart"));
// Two-step checkout (1 Personal → 2 Payment). The previous single-step flow
// remains at src/pages/Checkout.jsx as a rollback target — revert this one
// import to restore it.
const Checkout = lazy(() => import("./pages/CheckoutTwoStep"));
const Success = lazy(() => import("./pages/Success"));
const Cancel = lazy(() => import("./pages/Cancel"));
const Account = lazy(() => import("./pages/Account"));
const Contact = lazy(() => import("./pages/Contact"));
const Faqs = lazy(() => import("./pages/Faqs"));
const CoaPolicy = lazy(() => import("./pages/CoaPolicy"));
const Quality = lazy(() => import("./pages/Quality"));
const PrivacyChoices = lazy(() => import("./pages/PrivacyChoices"));

// ── Admin tier ──
const AdminHome = lazy(() => import("./pages/AdminHome"));
const LabelStudio = lazy(() => import("./pages/LabelStudio"));

const NotFound = lazy(() => import("./pages/NotFound"));

// Routes that render their own full-page chrome (no global Navbar/Footer).
// NOTE: "/verify" is matched EXACTLY (email-confirmation screen) so that
// /verify-lot and /v/:code keep the normal site chrome.
const BARE_PREFIXES = ["/login", "/register", "/forgot-password", "/reset-password", "/auth/confirm"];
const BARE_EXACT = ["/verify"];

// Redirect the legacy plural product path to the canonical singular one.
function ProductAliasRedirect() {
  const { slug } = useParams();
  return <Navigate to={`/product/${slug}`} replace />;
}

function Page({ children }) {
  return (
    <Motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.3, ease: "easeOut" }}
    >
      <Suspense fallback={<RouteSkeleton />}>{children}</Suspense>
    </Motion.div>
  );
}

export default function App() {
  useRouteAnalytics();
  const location = useLocation();
  const { isOpen: isCartOpen } = useCart();

  const isBare =
    location.pathname === "/" ||
    BARE_EXACT.includes(location.pathname) ||
    BARE_PREFIXES.some((p) => location.pathname.startsWith(p));

  return (
    <>
      <AgeGate />
      <TrackingScripts />
      <Suspense fallback={null}>
        <CartDrawer />
      </Suspense>

      <div
        className={`transition-all duration-300 ${
          isCartOpen ? "blur-sm pointer-events-none select-none" : ""
        }`}
      >
        {!isBare && <Navbar />}
        <ScrollToTop />

        <ErrorBoundary>
          <Routes>
              {/* ── PUBLIC ── */}
              <Route path="/" element={<Page><PublicLanding /></Page>} />
              <Route path="/login" element={<Page><Login /></Page>} />
              <Route path="/register" element={<Page><Register /></Page>} />
              <Route path="/register/attestation" element={<Page><RegisterAttestation /></Page>} />
              <Route path="/verify" element={<Page><Verify /></Page>} />
              <Route path="/forgot-password" element={<Page><ForgotPassword /></Page>} />
              <Route path="/reset-password" element={<Page><ResetPassword /></Page>} />
              <Route path="/auth/confirm" element={<Page><AuthConfirm /></Page>} />

              {/* ── PUBLIC EDUCATION (indexable, non-commerce) ── */}
              <Route path="/research" element={<Page><Research /></Page>} />
              <Route path="/research/:slug" element={<Page><ResearchArticle /></Page>} />
              <Route path="/calculator" element={<Page><Calculator /></Page>} />
              <Route path="/deals" element={<Page><Deals /></Page>} />
              <Route path="/test-results" element={<Page><TestResults /></Page>} />
              <Route path="/verify-lot" element={<Page><VerifyLot /></Page>} />
              {/* Label QR deep link: short, non-enumerable verification code. */}
              <Route path="/v/:code" element={<Page><VerifyLot /></Page>} />

              {/* ── PUBLIC LEGAL ── */}
              <Route path="/legal/terms" element={<Page><Terms /></Page>} />
              <Route path="/legal/privacy" element={<Page><Privacy /></Page>} />
              <Route path="/legal/research-use-policy" element={<Page><ResearchUsePolicy /></Page>} />
              <Route path="/legal/fda-disclaimer" element={<Page><FdaDisclaimer /></Page>} />
              <Route path="/legal/shipping" element={<Page><ShippingRefunds /></Page>} />
              <Route path="/legal/returns" element={<Page><ShippingRefunds /></Page>} />

              {/* ── PUBLIC CATALOG (browse without login; purchase is gated) ──
                   Catalog reads are public at the data layer (migration 0013)
                   so these pages are crawlable/indexable. Adding to cart is
                   allowed for anyone; CHECKOUT requires auth + a current
                   research-use attestation (route guards below + the
                   server-side attestation gate in the checkout endpoints). */}
              <Route path="/shop" element={<Page><Shop /></Page>} />
              <Route path="/shop/:category" element={<Page><Shop /></Page>} />
              <Route path="/catalog" element={<Page><Shop /></Page>} />
              <Route path="/catalog/:category" element={<Page><Shop /></Page>} />
              <Route path="/product/:slug" element={<Page><ProductDetail /></Page>} />
              {/* Plural alias → canonical singular (avoids duplicate content). */}
              <Route path="/products/:slug" element={<ProductAliasRedirect />} />

              {/* ── PUBLIC INFORMATIONAL (trust/SEO; no commerce action) ── */}
              <Route path="/coa" element={<Page><CoaPolicy /></Page>} />
              <Route path="/coa-policy" element={<Page><CoaPolicy /></Page>} />
              <Route path="/quality" element={<Page><Quality /></Page>} />
              <Route path="/about" element={<Page><About /></Page>} />
              <Route path="/faq" element={<Page><Faqs /></Page>} />
              <Route path="/faqs" element={<Page><Faqs /></Page>} />
              <Route path="/contact" element={<Page><Contact /></Page>} />

              {/* ── GATED (auth + attestation) ── */}
              <Route path="/home" element={<Page><RequireAuth><ResearcherConsole /></RequireAuth></Page>} />
              <Route path="/assistant" element={<Page><RequireAuth><Assistant /></RequireAuth></Page>} />
              <Route path="/cart" element={<Page><RequireAuth><Cart /></RequireAuth></Page>} />
              <Route path="/checkout" element={<Page><RequireAuth><Checkout /></RequireAuth></Page>} />
              <Route path="/success" element={<Page><RequireAuth><Success /></RequireAuth></Page>} />
              <Route path="/cancel" element={<Page><RequireAuth><Cancel /></RequireAuth></Page>} />
              <Route path="/account" element={<Page><RequireAuth><Account /></RequireAuth></Page>} />
              <Route path="/account/orders" element={<Page><RequireAuth><Account /></RequireAuth></Page>} />
              <Route path="/privacy-choices" element={<Page><RequireAuth><PrivacyChoices /></RequireAuth></Page>} />

              {/* ── ADMIN ── */}
              <Route path="/admin" element={<Page><RequireAdmin><AdminHome /></RequireAdmin></Page>} />
              <Route path="/admin/labels" element={<Page><RequireAdmin><LabelStudio /></RequireAdmin></Page>} />

              {/* ── Redirects (old paths → canonical) ── */}
              <Route path="/disclaimer" element={<Navigate to="/legal/research-use-policy" replace />} />
              <Route path="/terms" element={<Navigate to="/legal/terms" replace />} />
              <Route path="/privacy" element={<Navigate to="/legal/privacy" replace />} />
              <Route path="/shipping-refunds" element={<Navigate to="/legal/shipping" replace />} />
              <Route path="/returns" element={<Navigate to="/legal/returns" replace />} />
              <Route path="/help" element={<Navigate to="/faqs" replace />} />
              <Route path="/collections" element={<Navigate to="/shop" replace />} />
              <Route path="/drops" element={<Navigate to="/shop" replace />} />

              <Route path="*" element={<Page><NotFound /></Page>} />
          </Routes>
        </ErrorBoundary>

        {!isBare && <CookieBanner />}
        {!isBare && <Footer />}
      </div>
    </>
  );
}
