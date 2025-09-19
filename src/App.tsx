// src/App.tsx
import { Routes, Route, NavLink, useLocation } from "react-router-dom";
import Index from "./pages/Index";
import Pedidos from "./pages/Pedidos";
import Familias from "./pages/Familias";
import NotFound from "./pages/NotFound";

export default function App() {
  const { hash } = useLocation();
  const isFamilies = hash.startsWith("#/familias");

  // Ocultamos menú si es la pública
  return (
    <>
      {!isFamilies && (
        <nav style={{ padding: 12, borderBottom: "1px solid #ddd", display: "flex", gap: 12 }}>
          <NavLink to="/" end>Inicio</NavLink>
          <NavLink to="/pedidos">Pedidos</NavLink>
          {/* opcional: NavLink a familias dentro del sistema */}
          <NavLink to="/familias">Familias</NavLink>
        </nav>
      )}

      <Routes>
        <Route path="/" element={<Index />} />
        <Route path="/pedidos" element={<Pedidos />} />
        {/* 👇 Esta ruta renderiza SOLO el módulo de padres */}
        <Route path="/familias" element={<Familias />} />
        <Route path="*" element={<NotFound />} />
      </Routes>
    </>
  );
}
