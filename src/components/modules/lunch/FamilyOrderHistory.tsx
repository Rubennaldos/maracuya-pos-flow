import { useEffect, useMemo, useState } from "react";
import { RTDBHelper } from "@/lib/rt";
import { RTDB_PATHS } from "@/lib/rtdb";

type Order = {
  id: string;
  code?: string;          // correlativo legible
  clientCode?: string;
  clientName?: string;
  items?: { name: string; qty: number; price?: number }[];
  total?: number;
  status?: string;
  createdAt?: number | string;
  note?: string;
  recess?: "primero" | "segundo";
  studentName?: string;
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
  const [editing, setEditing] = useState<Record<string, Partial<Order>>>({});
  const [savingId, setSavingId] = useState<string | null>(null);

  // Escuchar índice
  useEffect(() => {
    const off = RTDBHelper.listenToData<Record<string, true>>(
      `lunch_orders_by_client/${clientCode}`,
      (d) => setIds(d ? Object.keys(d) : [])
    );
    return () => off?.();
  }, [clientCode]);

  // Traer pedidos
  useEffect(() => {
    let mounted = true;
    (async () => {
      if (!ids.length) {
        if (mounted) setOrders([]);
        return;
      }
      const chunk = await Promise.all(
        ids.map(async (id) => {
          const o = await RTDBHelper.getData<Order>(`${RTDB_PATHS.lunch_orders}/${id}`);
          return o ? { ...o, id } : null;
        })
      );
      if (mounted) setOrders(chunk.filter(Boolean) as Order[]);
    })();
    return () => {
      mounted = false;
    };
  }, [ids]);

  // Filtro
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
          o.clientName,
          o.clientCode,
          o.code,
          o.studentName,
          o.recess,
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

  const onEdit = (id: string, patch: Partial<Order>) =>
    setEditing((e) => ({ ...e, [id]: { ...e[id], ...patch } }));

  const save = async (o: Order) => {
    const patch = editing[o.id];
    if (!patch) return;
    setSavingId(o.id);
    try {
      const updates: Record<string, any> = {};
      if (typeof patch.note !== "undefined")
        updates[`${RTDB_PATHS.lunch_orders}/${o.id}/note`] = patch.note || null;
      if (typeof patch.recess !== "undefined")
        updates[`${RTDB_PATHS.lunch_orders}/${o.id}/recess`] = patch.recess || "segundo";
      if (typeof patch.studentName !== "undefined")
        updates[`${RTDB_PATHS.lunch_orders}/${o.id}/studentName`] =
          patch.studentName?.trim() || null;

      await RTDBHelper.updateData(updates);
      setEditing((e) => {
        const { [o.id]: _, ...rest } = e;
        return rest;
      });
    } catch {
      // noop: podrías mostrar un toast si ya usas shadcn en esta vista
      alert("No se pudo guardar el cambio");
    } finally {
      setSavingId(null);
    }
  };

  return (
    <div
      style={{
        border: "1px solid #e5e7eb",
        padding: 12,
        borderRadius: 10,
        background: "#fff",
      }}
    >
      <div style={{ display: "flex", gap: 8, alignItems: "center", marginBottom: 10 }}>
        <input
          placeholder="Buscar en historial (producto, alumno, código…) "
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
            const e = editing[o.id] || {};
            return (
              <div
                key={o.id}
                style={{
                  border: "1px solid #e5e7eb",
                  borderRadius: 10,
                  padding: 10,
                  background: "#fafafa",
                }}
              >
                <div
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                    marginBottom: 6,
                  }}
                >
                  <div style={{ fontWeight: 600 }}>
                    {o.clientName} — {o.clientCode} &nbsp;|&nbsp; {o.code}
                  </div>
                  <div style={{ fontSize: 12, color: "#6b7280" }}>
                    {new Date(normalizeTS(o.createdAt)).toLocaleString("es-PE")}
                  </div>
                </div>

                <div style={{ fontSize: 13, marginBottom: 6 }}>
                  {(o.items || []).map((i, idx) => (
                    <div key={idx}>• {i.qty} × {i.name}</div>
                  ))}
                </div>

                <div style={{ display: "grid", gap: 6, marginTop: 6 }}>
                  <div style={{ display: "flex", gap: 8 }}>
                    <label style={{ width: 120, color: "#6b7280" }}>Alumno</label>
                    <input
                      value={e.studentName ?? o.studentName ?? ""}
                      onChange={(ev) => onEdit(o.id, { studentName: ev.target.value })}
                      style={{ flex: 1, border: "1px solid #ddd", borderRadius: 6, padding: "6px 8px" }}
                    />
                  </div>
                  <div style={{ display: "flex", gap: 8 }}>
                    <label style={{ width: 120, color: "#6b7280" }}>Recreo</label>
                    <select
                      value={e.recess ?? o.recess ?? "segundo"}
                      onChange={(ev) => onEdit(o.id, { recess: ev.target.value as any })}
                      style={{ border: "1px solid #ddd", borderRadius: 6, padding: "6px 8px" }}
                    >
                      <option value="primero">primero</option>
                      <option value="segundo">segundo</option>
                    </select>
                  </div>
                  <div style={{ display: "flex", gap: 8 }}>
                    <label style={{ width: 120, color: "#6b7280" }}>Observación</label>
                    <input
                      value={e.note ?? o.note ?? ""}
                      onChange={(ev) => onEdit(o.id, { note: ev.target.value })}
                      style={{ flex: 1, border: "1px solid #ddd", borderRadius: 6, padding: "6px 8px" }}
                    />
                  </div>
                </div>

                <div
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                    marginTop: 8,
                  }}
                >
                  <div style={{ fontWeight: 700 }}>Total: {PEN(o.total)}</div>
                  <button
                    onClick={() => save(o)}
                    disabled={savingId === o.id}
                    style={{
                      border: "1px solid #10b981",
                      background: savingId === o.id ? "#a7f3d0" : "#10b981",
                      color: "white",
                      borderRadius: 8,
                      padding: "6px 10px",
                      cursor: "pointer",
                    }}
                  >
                    {savingId === o.id ? "Guardando…" : "Guardar cambios"}
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
