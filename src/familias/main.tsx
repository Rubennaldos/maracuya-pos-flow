// src/familias/main.tsx
import "../index.css";
import React from "react";
import { createRoot } from "react-dom/client";
import { HashRouter, Routes, Route } from "react-router-dom";
import App from "./App"; // 👈 antes decía './FamiliasApp'

const rootEl = document.getElementById("root");
if (!rootEl) {
  console.error("[familias] #root NO encontrado");
} else {
  createRoot(rootEl).render(
    <React.StrictMode>
      <HashRouter>
        <Routes>
          <Route path="/*" element={<App />} />
        </Routes>
      </HashRouter>
    </React.StrictMode>
  );
}
