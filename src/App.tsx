// src/App.tsx
import { useMemo, useEffect } from "react";
import { Routes, Route, NavLink, useLocation, useNavigate } from "react-router-dom";

import Index from "./pages/Index";
import HistorialPedidos from "./pages/HistorialPedidos";
import Familias from "./pages/Familias";
import NotFound from "./pages/NotFound";

import { useSession } from "@/state/session";
import EmailLogin from "@/components/modules/EmailLogin";
import LunchAdminPage from "./pages/LunchAdmin"; // 👈 asegúrate que exista

/* ============== Pantalla de bloqueo ============== */
function LockedScreen({ onBackToFamilies }: { onBackToFamilies: () => void }) {
  return (
    <div className="min-h-screen bg-gradient-to-br from-background to-muted flex items-center">
      <div className="w-full max-w-5xl mx-auto px-4">
        <div className="grid gap-6 md:grid-cols-2 items-stretch">
          <div className="bg-white border rounded-2xl shadow-sm p-6 flex flex-col">
            <div className="space-y-2">
              <h1 className="text-2xl font-bold">Acceso restringido</h1>
              <p className="text-muted-foreground">
                Esta sección es solo para administradores. Si eres padre de familia,
                por favor vuelve al portal de almuerzos.
              </p>
            </div>
            <div className="mt-8">
              <button
                type="button"
                onClick={onBackToFamilies}
                className="inline-flex items-center justify-center rounded-md border px-4 py-2 text-sm font-medium hover:bg-accent"
              >
                ← Volver al módulo de almuerzos
              </button>
            </div>
          </div>

          <div className="bg-white border rounded-2xl shadow-sm p-4">
            <div className="max-w-md mx-auto">
              <EmailLogin />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ============== Ruta protegida ============== */
function Protected({ element }: { element: JSX.Element }) {
  const navigate = useNavigate();
  const { user, loading } = useSession();

  if (loading) {
    return (
      <div className="min-h-screen grid place-items-center text-sm text-muted-foreground">
        Cargando…
      </div>
    );
  }

  const isAdmin = user?.role === "admin";
  if (isAdmin) return element;

  return <LockedScreen onBackToFamilies={() => navigate("/familias", { replace: true })} />;
}

/* ===================== App ===================== */
export default function App() {
  const location = useLocation();
  const isFamilies = location.pathname.startsWith("/familias");

  const { user, bindAuth } = useSession();
  // 👇 Activa el listener de Firebase Auth (importante para login por correo)
  useEffect(() => {
    bindAuth?.();
  }, [bindAuth]);

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
          <NavLink to="/" end>Inicio</NavLink>
          <NavLink to="/historial-pedidos">Historial de Pedidos</NavLink>
          <NavLink to="/familias">Familias</NavLink>
          <NavLink to="/lunch-admin">Administrar Almuerzos</NavLink> {/* 👈 acceso directo */}
        </nav>
      )}

      <Routes>
        {/* Público */}
        <Route path="/familias" element={<Familias />} />

        {/* Protegidas */}
        <Route path="/" element={<Protected element={<Index />} />} />
        <Route path="/historial-pedidos" element={<Protected element={<HistorialPedidos />} />} />
        <Route path="/lunch-admin" element={<Protected element={<LunchAdminPage />} />} /> {/* 👈 NUEVA */}
        <Route path="*" element={<Protected element={<NotFound />} />} />
      </Routes>
    </>
  );
}
