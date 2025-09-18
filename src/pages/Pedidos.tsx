import { useEffect, useState } from "react";
import { RTDBHelper } from "@/lib/rt";
import { RTDB_PATHS } from "@/lib/rtdb";

type Pedido = {
  id?: string;
  cliente?: string;
  estado?: string;
  createdAt?: string;
  [k: string]: any;
};

export default function Pedidos() {
  const [cargando, setCargando] = useState(true);
  const [pedidos, setPedidos] = useState<Record<string, Pedido> | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    try {
      // 🔁 CAMBIA ESTA RUTA si tus pedidos están en otro nodo (p.ej. "orders")
      const path = RTDB_PATHS.lunches;
      const off = RTDBHelper.listenToData<Record<string, Pedido>>(path, (data) => {
        setPedidos(data);
        setCargando(false);
      });
      return () => off();
    } catch (e: any) {
      setError(e?.message ?? "Error cargando pedidos");
      setCargando(false);
    }
  }, []);

  if (cargando) return <div style={{ padding: 24 }}>Cargando pedidos…</div>;
  if (error) return <div style={{ padding: 24, color: "red" }}>Error: {error}</div>;

  const items = pedidos ? Object.entries(pedidos) : [];

  return (
    <div style={{ padding: 24 }}>
      <h1>Pedidos</h1>
      {items.length === 0 ? (
        <p>Sin pedidos.</p>
      ) : (
        <ul style={{ marginTop: 12 }}>
          {items.map(([id, p]) => (
            <li key={id} style={{ padding: 8, borderBottom: "1px solid #eee" }}>
              <div><strong>ID:</strong> {id}</div>
              <div><strong>Cliente:</strong> {p.cliente ?? "—"}</div>
              <div><strong>Estado:</strong> {p.estado ?? "—"}</div>
              <div><strong>Fecha:</strong> {p.createdAt ?? "—"}</div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
