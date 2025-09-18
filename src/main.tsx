import "./index.css"; // 👈 importa Tailwind + variables

import React from "react";
import { createRoot } from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import App from "./App";

// --- Fix GitHub Pages SPA: si venimos de 404.html habrá ?p=/ruta/original ---
(function fixGhPagesDeepLink() {
  try {
    const url = new URL(window.location.href);
    const p = url.searchParams.get("p");
    if (p) {
      // BASE_URL trae "/maracuya-pos-flow/" en producción
      const base = (import.meta.env.BASE_URL || "/").replace(/\/+$/, "");
      const next = base + p; // p ya comienza con "/"
      // Reescribe la barra de direcciones sin recargar
      window.history.replaceState(null, "", next);
    }
  } catch (e) {
    console.warn("[gh-pages-spa] no se pudo normalizar la URL:", e);
  }
})();

console.log("[main] cargando…", { base: import.meta.env.BASE_URL });

const rootEl = document.getElementById("root");
if (!rootEl) {
  console.error("[main] #root NO encontrado");
} else {
  createRoot(rootEl).render(
    <React.StrictMode>
      <BrowserRouter basename={import.meta.env.BASE_URL}>
        <App />
      </BrowserRouter>
    </React.StrictMode>
  );
  console.log("[main] renderizado");
}
