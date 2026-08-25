import React from "react";
import ReactDOM from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
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
  window.addEventListener("load", () => {
    navigator.serviceWorker.register("/sw.js").catch(() => {
      /* offline shell is progressive — registration failure is non-fatal */
    });
  });
}

ReactDOM.createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <BrowserRouter>
      <UserProvider>
        <CartProvider>
          <App />
        </CartProvider>
      </UserProvider>
    </BrowserRouter>
  </React.StrictMode>
);
