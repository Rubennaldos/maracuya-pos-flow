import { Routes, Route, NavLink } from "react-router-dom";
import Index from "./pages/Index";
import Pedidos from "./pages/Pedidos";
import NotFound from "./pages/NotFound";

export default function App() {
  return (
    <>
      <nav style={{ padding: 12, borderBottom: "1px solid #ddd", display: "flex", gap: 12 }}>
        <NavLink to="/" end>Inicio</NavLink>
        <NavLink to="/pedidos">Pedidos</NavLink>
      </nav>

      <Routes>
        <Route path="/" element={<Index />} />
        <Route path="/pedidos" element={<Pedidos />} />
        <Route path="*" element={<NotFound />} />
      </Routes>
    </>
  );
}
