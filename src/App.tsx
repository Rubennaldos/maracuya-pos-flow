// src/App.tsx
import { Routes, Route, Link } from "react-router-dom";

function Home() {
  console.log("[Home] render");
  return (
    <div style={{ padding: 24 }}>
      <h1>Hola desde Vite + React</h1>
      <p>
        Ir a <Link to="/pedidos">Pedidos</Link>
      </p>
    </div>
  );
}

function Pedidos() {
  console.log("[Pedidos] render");
  return (
    <div style={{ padding: 24 }}>
      <h1>Página de Pedidos</h1>
      <p>Ruta funcionando con HashRouter.</p>
      <p>
        Volver a <Link to="/">Inicio</Link>
      </p>
    </div>
  );
}

export default function App() {
  console.log("[App] render");
  return (
    <>
      {/* Mini navegación para probar rutas */}
      <nav style={{ padding: 12, borderBottom: "1px solid #ddd" }}>
        <Link to="/" style={{ marginRight: 12 }}>Inicio</Link>
        <Link to="/pedidos">Pedidos</Link>
      </nav>

      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/pedidos" element={<Pedidos />} />
        <Route path="*" element={<Home />} />
      </Routes>
    </>
  );
}
