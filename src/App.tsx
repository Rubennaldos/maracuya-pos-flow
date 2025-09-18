import { Routes, Route, NavLink, useLocation } from "react-router-dom";
import Index from "./pages/Index";
import Pedidos from "./pages/Pedidos";
import NotFound from "./pages/NotFound";
import Familias from "./pages/Familias";

export default function App() {
  // En HashRouter, la ruta vive en location.hash (ej: "#/familias")
  const { hash } = useLocation();
  const isPublicFamilies = hash.startsWith("#/familias");

  return (
    <>
      {/* Ocultamos el menú interno en la página pública */}
      {!isPublicFamilies && (
        <nav style={{ padding: 12, borderBottom: "1px solid #ddd", display: "flex", gap: 12 }}>
          <NavLink to="/" end>Inicio</NavLink>
          <NavLink to="/pedidos">Pedidos</NavLink>
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
