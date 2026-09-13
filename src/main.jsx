import React from "react";
import ReactDOM from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import { MotionConfig } from "framer-motion";
import App from "./App.jsx";
import "./index.css";
import { CartProvider } from "./context/CartContext";
import { UserProvider } from "./context/UserContext";
import { installErrorReporter } from "./lib/errorReporter";

installErrorReporter();

// Installable shell + offline catalog (MOBILE_ROADMAP #7). PROD-only so dev
// server behavior is never cached; the worker itself excludes /api/* and all
// non-font cross-origin traffic.
if (import.meta.env.PROD && "serviceWorker" in navigator) {
  const registerSw = () => {
    navigator.serviceWorker.register("/sw.js").catch(() => {
      /* offline shell is progressive — registration failure is non-fatal */
    });
  };
  // Opt cycle 11: the paint-first loader (public/boot.js) runs this module
  // after the first frame — on a fast load the window "load" event has
  // already fired by then, and a listener alone would never register the
  // worker (the PWA shell went missing under vite preview in CI).
  if (document.readyState === "complete") registerSw();
  else window.addEventListener("load", registerSw);
}

ReactDOM.createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <BrowserRouter>
      {/* Site-wide: framer-motion animations collapse to instant transitions
          for users whose OS asks for reduced motion (MOBILE_ROADMAP #12). */}
      <MotionConfig reducedMotion="user">
      <UserProvider>
        <CartProvider>
          <App />
        </CartProvider>
      </UserProvider>
      </MotionConfig>
    </BrowserRouter>
  </React.StrictMode>
);
