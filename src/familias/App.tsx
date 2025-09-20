// src/familias/App.tsx
import React from "react";
import Familias from "@/pages/Familias";

/**
 * Envoltorio mínimo para el portal independiente.
 * No trae navbar del admin ni guards del sistema.
 */
export default function App() {
  return (
    <div className="min-h-screen bg-background">
      <Familias />
    </div>
  );
}
