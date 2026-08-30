import React from "react";
import ReactDOM from "react-dom/client";
import { BrowserRouter } from "react-router-dom";

import App from "./App";
import { CartProvider } from "./context/CartContext";
import { WishlistProvider } from "./context/WishlistContext";
import { AuthProvider } from "./context/AuthContext";
import "./index.css";

// Dark mode was never fully styled (most components don't have `dark:`
// variants), so it's disabled — the toggle is removed and this clears any
// `dark` class/preference a browser session already picked up before that,
// so nobody gets stuck on a half-styled page.
document.documentElement.classList.remove("dark");
try {
  window.localStorage.removeItem("lookbook_theme");
} catch {
  /* private mode */
}

// Registered after load so it never competes with the initial page render
// for bandwidth/CPU — see future.md §12.1 (PWA installability/offline shell).
if ("serviceWorker" in navigator) {
  window.addEventListener("load", () => {
    navigator.serviceWorker.register("/sw.js").catch(() => {
      // Best-effort — the app works identically without an active SW,
      // just without offline-shell caching.
    });
  });
}

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <BrowserRouter>
      <AuthProvider>
        <CartProvider>
          <WishlistProvider>
            <App />
          </WishlistProvider>
        </CartProvider>
      </AuthProvider>
    </BrowserRouter>
  </React.StrictMode>
);
