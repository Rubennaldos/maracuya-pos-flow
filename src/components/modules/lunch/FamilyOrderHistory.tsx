// src/components/modules/lunch/FamilyOrderHistory.tsx
import { useEffect, useMemo, useState } from "react";
import { RTDBHelper } from "@/lib/rt";
import { RTDB_PATHS } from "@/lib/rtdb";
import type { OrderT } from "@/components/modules/lunch/types";

type Props = {
  clientCode: string;     // código del padre (antes: clientId)
};

const PEN = (n: number) =>
  new Intl.NumberFormat("es-PE", { style: "currency", currency: "PEN" }).format(n || 0);

export default function FamilyOrderHistory({ clientCode }: Props) {
  const [orders, setOrders] = useState<OrderT[]>([]);
  const [q, setQ] = useState("");

  useEffect(() => {
    if (!clientCode) return;

    // Opción 1: usar el índice /lunch_orders_by_client/{code} (si lo estás guardando)
    const off = RTDBHelper.listenToData<Record<string, true>>(
      `lunch_orders_by_client/${clientCode}`,
      async (idx) => {
        if (!idx) {
          setOrders([]);
          return;
        }
        // cargar cada pedido por id
        const all: OrderT[] = [];
        await Promise.all(
          Object.keys(idx).map(async (id) => {
            const o = await RTDBHelper.getData<OrderT>(`${RTDB_PATHS.lunch_orders}/${id}`);
            if (o) all.push(o);
          })
        );
        setOrders(all);
      }
    );

    return () => off && off();
  }, [clientCode]);

  // Filtro simple por texto (busca en código, alumno y nombres de producto)
  const filtered = useMemo(() => {
    const needle = q.trim().toLowerCase();
    const list = orders.slice().sort((a, b) => {
      // ⬇ ahora createdAt es number, así que ordenamos por resta numérica
      return (b.createdAt || 0) - (a.createdAt || 0);
    });
    if (!needle) return list;
    return list.filter((o) => {
      const hay =
        (o.code || "").toLowerCase().includes(needle) ||
        (o.studentName || "").toLowerCase().includes(needle) ||
        (o.items || []).some((it) => (it.name || "").toLowerCase().includes(needle));
      return hay;
    });
  }, [orders, q]);

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between gap-2">
        <h3 className="text-lg font-semibold">Historial de pedidos</h3>
        <input
          className="border rounded h-9 px-3 w-64"
          placeholder="Buscar por código, alumno o producto…"
          value={q}
          onChange={(e) => setQ(e.target.value)}
        />
      </div>

      {filtered.length === 0 && (
        <p className="text-muted-foreground">No hay pedidos para mostrar.</p>
      )}

      {filtered.map((o) => (
        <div key={o.id} className="border rounded p-3">
          <div className="flex items-center justify-between">
            <div className="font-medium">
              Pedido <span className="font-semibold">{o.code}</span>{" "}
              <span className="text-xs text-muted-foreground ml-2">
                {new Date(o.createdAt).toLocaleString("es-PE")}
              </span>
            </div>
            <div className="text-sm">
              <span className="px-2 py-0.5 rounded bg-gray-100">{o.status}</span>
            </div>
          </div>

          {o.studentName && (
            <div className="text-sm mt-1">
              <span className="text-muted-foreground">Alumno:</span> {o.studentName}
              {o.recess ? (
                <>
                  {" "}
                  <span className="text-muted-foreground">• Recreo:</span> {o.recess}
                </>
              ) : null}
            </div>
          )}

          <div className="text-sm mt-2">
            <div className="font-medium">Productos:</div>
            {(o.items || []).map((it, idx) => (
              <div key={idx} className="ml-4 text-muted-foreground">
                • {it.qty} × {it.name}
              </div>
            ))}
          </div>

          {o.note && (
            <div className="text-sm mt-1">
              <span className="font-medium">Observaciones:</span>{" "}
              <span className="text-muted-foreground">{o.note}</span>
            </div>
          )}

          <div className="flex justify-end mt-2 font-semibold">Total: {PEN(o.total)}</div>
        </div>
      ))}
    </div>
  );
}
