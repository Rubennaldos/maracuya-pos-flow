import { useEffect, useMemo, useState } from "react";
import { RTDBHelper } from "@/lib/rt";
import { RTDB_PATHS } from "@/lib/rtdb";

type Order = {
  id: string;
  code?: string;
  clientCode?: string;
  clientName?: string;
  items?: { name: string; qty: number; price?: number }[];
  total?: number;
  status?: string;
  createdAt?: number | string;
  note?: string;
};

const PEN = (n: number | undefined) =>
  new Intl.NumberFormat("es-PE", { style: "currency", currency: "PEN" }).format(n || 0);

function normalizeTS(x: number | string | undefined) {
  const n = typeof x === "number" ? x : Date.parse(String(x || ""));
  return Number.isFinite(n) ? n : Date.now();
}

export default function FamilyOrderHistory({ clientCode }: { clientCode: string }) {
  const [ids, setIds] = useState<string[]>([]);
  const [orders, setOrders] = useState<Order[]>([]);
  const [q, setQ] = useState("");
  const [date, setDate] = useState<string>(""); // yyyy-mm-dd

  // Escuchar índice por cliente
  useEffect(() => {
    const off = RTDBHelper.listenToData<Record<string, true>>(
      `lunch_orders_by_client/${clientCode}`,
      (d) => setIds(d ? Object.keys(d) : [])
    );
    return () => off?.();
  }, [clientCode]);

  // Traer pedidos por id
  useEffect(() => {
    let mounted = true;
    (async () => {
      if (!ids.length) {
        if (mounted) setOrders([]);
        return;
      }
      const list = await Promise.all(
        ids.map(async (id) => {
          const o = await RTDBHelper.getData<Order>(`${RTDB_PATHS.lunch_orders}/${id}`);
          return o ? { ...o, id } : null;
        })
      );
      if (mounted) setOrders(list.filter(Boolean) as Order[]);
    })();
    return () => {
      mounted = false;
    };
  }, [ids]);

  // Filtros (texto + fecha)
  const filtered = useMemo(() => {
    const needle = q.trim().toLowerCase();
    const dayMillis = date ? Date.parse(`${date}T00:00:00`) : null;
    const next = dayMillis ? dayMillis + 24 * 60 * 60 * 1000 - 1 : null;

    return orders
      .filter((o) => {
        if (dayMillis && next) {
          const t = normalizeTS(o.createdAt);
          if (t < dayMillis || t > next) return false;
        }
        if (!needle) return true;
        const haystack = [
          o.code,
          o.clientName,
          o.clientCode,
          o.note,
          ...(o.items || []).map((i) => `${i.qty}x ${i.name}`),
        ]
          .filter(Boolean)
          .join(" ")
          .toLowerCase();
        return haystack.includes(needle);
      })
      .sort((a, b) => normalizeTS(b.createdAt) - normalizeTS(a.createdAt));
  }, [orders, q, date]);

  return (
    <div
      style={{
        border: "1px solid #e5e7eb",
        padding: 12,
        borderRadius: 10,
        background: "#fff",
      }}
    >
      {/* Filtros */}
      <div style={{ display: "flex", gap: 8, alignItems: "center", marginBottom: 10 }}>
        <input
          placeholder="Buscar (producto, código, cliente...)"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          style={{ flex: 1, border: "1px solid #ddd", borderRadius: 8, padding: "8px 10px" }}
        />
        <input
          type="date"
          value={date}
          onChange={(e) => setDate(e.target.value)}
          style={{ border: "1px solid #ddd", borderRadius: 8, padding: "8px 10px" }}
        />
      </div>

      {filtered.length === 0 ? (
        <div style={{ color: "#6b7280" }}>No hay pedidos.</div>
      ) : (
        <div style={{ display: "grid", gap: 10 }}>
          {filtered.map((o) => {
            const created = new Date(normalizeTS(o.createdAt));
            return (
              <div
                key={o.id}
                style={{
                  border: "1px solid #e5e7eb",
                  borderRadius: 10,
                  padding: 14,
                  background: "#fafafa",
                }}
              >
                {/* Encabezado más grande */}
                <div
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                    marginBottom: 10,
                  }}
                >
                  <div style={{ fontWeight: 1000, fontSize: 30 }}>
                    Pedido: {o.code || o.id.slice(-6).toUpperCase()}
                  </div>
                  <div style={{ fontSize: 15, fontWeight: 600, color: "#374151" }}>
                    {created.toLocaleDateString("es-PE")} — {created.toLocaleTimeString("es-PE")}
                  </div>
                </div>

                {/* Productos */}
                <div style={{ fontSize: 20, marginBottom: 10 }}>
                  {(o.items || []).map((i, idx) => (
                    <div key={idx}>• {i.qty} × {i.name}</div>
                  ))}
                </div>

                {/* Observación (solo si existe) */}
                {o.note ? (
                  <div
                    style={{
                      fontSize: 13,
                      padding: "6px 8px",
                      borderRadius: 6,
                      background: "#f3f4f6",
                      border: "1px solid #e5e7eb",
                      marginTop: 6,
                    }}
                  >
                    <strong>Observación:</strong> {o.note}
                  </div>
                ) : null}

                {/* Total */}
                <div
                  style={{
                    display: "flex",
                    justifyContent: "flex-end",
                    marginTop: 8,
                    fontWeight: 700,
                    fontSize: 15,
                  }}
                >
                  Total: {PEN(o.total)}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
