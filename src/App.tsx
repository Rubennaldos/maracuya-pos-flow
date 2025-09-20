// src/App.tsx
import React, { useMemo } from "react";
import { Routes, Route, NavLink, useLocation, useNavigate } from "react-router-dom";

import Index from "./pages/Index";
import Pedidos from "./pages/Pedidos";
import Familias from "./pages/Familias";
import NotFound from "./pages/NotFound";

// 🔐 usamos tu sesión real
import { useSession } from "@/state/session";
// tu login de PIN existente
import RTDBLogin from "@/components/modules/RTDBLogin";

/* ============== Pantalla de bloqueo (inline) ============== */
function LockedScreen({ onBackToFamilies }: { onBackToFamilies: () => void }) {
  return (
    <div className="min-h-screen bg-gradient-to-br from-background to-muted p-4 flex items-center justify-center">
      <div className="w-full max-w-5xl grid md:grid-cols-2 gap-6">
        {/* Columna izquierda: Mensaje + volver */}
        <div className="bg-white border rounded-2xl p-6 shadow-sm flex flex-col justify-between">
          <div>
            <h1 className="text-2xl font-bold mb-2">Acceso restringido</h1>
            <p className="text-muted-foreground mb-6">
              Esta sección es solo para administradores. Si eres padre de familia, por favor vuelve
              al portal de almuerzos.
            </p>
          </div>
          <button
            type="button"
            onClick={onBackToFamilies}
            className="inline-flex items-center justify-center rounded-md border px-4 py-2 text-sm font-medium hover:bg-accent"
          >
            ← Volver al módulo de almuerzos
          </button>
        </div>

        {/* Columna derecha: Login admin (PIN) */}
        <div className="bg-white border rounded-2xl p-2 shadow-sm">
          <RTDBLogin />
        </div>
      </div>
    </div>
  );
}

/* ================= Wrapper de ruta protegida ================= */
function Protected({ element }: { element: JSX.Element }) {
  const navigate = useNavigate();
  const { user } = useSession(); // ← sin localStorage
  const isAdmin = user?.role === "admin";

  if (isAdmin) return element;
  // si NO es admin, no redirigimos: mostramos el candado con login + botón volver
  return <LockedScreen onBackToFamilies={() => navigate("/familias", { replace: true })} />;
}

/* ===================== App ===================== */
export default function App() {
  const location = useLocation();

  // En HashRouter, pathname refleja la ruta (# ya lo maneja el router)
  const isFamilies = location.pathname.startsWith("/familias");

  // Navbar solo si sesión admin y NO estamos en /familias
  const { user } = useSession();
  const showNav = useMemo(() => user?.role === "admin" && !isFamilies, [user?.role, isFamilies]);

  return (
    <>
      {showNav && (
        <nav
          style={{
            padding: 12,
            borderBottom: "1px solid #ddd",
            display: "flex",
            gap: 12,
          }}
        >
          <NavLink to="/" end>
            Inicio
          </NavLink>
          <NavLink to="/pedidos">Pedidos</NavLink>
          <NavLink to="/familias">Familias</NavLink>
        </nav>
      )}

      <Routes>
        {/* 🔓 Público */}
        <Route path="/familias" element={<Familias />} />

        {/* 🔒 Protegidas (si no hay admin → LockedScreen inline) */}
        <Route path="/" element={<Protected element={<Index />} />} />
        <Route path="/pedidos" element={<Protected element={<Pedidos />} />} />

        {/* 404 también protegida para no exponer nada */}
        <Route path="*" element={<Protected element={<NotFound />} />} />
      </Routes>
    </>
  );
}
