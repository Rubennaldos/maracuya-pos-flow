// src/App.tsx
import { Routes, Route, NavLink, useLocation, useNavigate } from "react-router-dom";
import { useEffect } from "react";
import Index from "./pages/Index";
import Pedidos from "./pages/Pedidos";
import Familias from "./pages/Familias";
import NotFound from "./pages/NotFound";

function isAdminSession() {
  return localStorage.getItem("admin_auth") === "1";
}
function hasAuthQuery(search: string) {
  const qs = new URLSearchParams(search);
  return qs.get("auth") === "true";
}

export default function App() {
  const { hash, search, hostname } = window.location;
  const location = useLocation();
  const navigate = useNavigate();

  const isFamilies = hash.startsWith("#/familias");
  const isProdPublic = hostname.endsWith("github.io"); // tu Pages público
  const allowAdminHere = isAdminSession() || hasAuthQuery(search);

  // 🔒 Guard: en github.io, si NO es /familias y no hay sesión admin → forzar /familias
  useEffect(() => {
    if (isProdPublic && !isFamilies && !allowAdminHere) {
      navigate("/familias", { replace: true });
    }
  }, [isProdPublic, isFamilies, allowAdminHere, navigate, location.key]);

  // Ocultamos menú si estamos en familias o si no hay sesión admin
  const showNav = allowAdminHere && !isFamilies;

  return (
    <>
      {showNav && (
        <nav style={{ padding: 12, borderBottom: "1px solid #ddd", display: "flex", gap: 12 }}>
          <NavLink to="/" end>Inicio</NavLink>
          <NavLink to="/pedidos">Pedidos</NavLink>
          <NavLink to="/familias">Familias</NavLink>
        </nav>
      )}

      <Routes>
        <Route path="/" element={<Index />} />
        <Route path="/pedidos" element={<Pedidos />} />
        <Route path="/familias" element={<Familias />} />
        <Route path="*" element={<NotFound />} />
      </Routes>
    </>
  );
}
