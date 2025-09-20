// src/main.tsx
import "./index.css";
import React from "react";
import { createRoot } from "react-dom/client";
import { HashRouter } from "react-router-dom";
import App from "./App";

console.log("[main] cargando…");

const rootEl = document.getElementById("root");
if (!rootEl) {
  console.error("[main] #root NO encontrado");
} else {
  createRoot(rootEl).render(
    <React.StrictMode>
      {/* HashRouter evita 404 en GitHub Pages */}
      <HashRouter>
        <App />
      </HashRouter>
    </React.StrictMode>
  );
  console.log("[main] renderizado");
}
