import { useEffect, useMemo, useState } from "react";
import { RTDBHelper } from "@/lib/rt";
import { RTDB_PATHS } from "@/lib/rtdb";
import FamilyOrderHistory from "@/components/modules/lunch/FamilyOrderHistory";

/* ===== Tipos ===== */
type Client = { code: string; name?: string };

type Category = { id: string; name: string; order?: number };
type Product = {
  id: string;
  name: string;
  description?: string;
  price: number;
  image?: string;
  categoryId: string;
  active?: boolean;
  isCombo?: boolean;
};

type MenuData = {
  categories?: Record<string, Category>;
  products?: Record<string, Product>;
};

type Settings = {
  isOpen?: boolean;
  orderWindow?: { start?: string; end?: string };
  allowSameDay?: boolean;
};

type CartItem = Product & { qty: number; subtotal: number };

type Props = {
  client: Client;
  onLogout?: () => void;
};

const PEN = (n: number) =>
  new Intl.NumberFormat("es-PE", { style: "currency", currency: "PEN" }).format(n ?? 0);

function inWindow(win?: { start?: string; end?: string }) {
  if (!win?.start || !win?.end) return true;
  const now = new Date();
  const pad = (x: number) => String(x).padStart(2, "0");
  const hhmm = `${pad(now.getHours())}:${pad(now.getMinutes())}`;
  return hhmm >= win.start && hhmm <= win.end;
}

/** Unifica nombre desde diferentes esquemas (incluye names + lastNames) */
function deriveName(row: any): string | null {
  if (!row) return null;

  // campos directos frecuentes
  const direct = row.name || row.fullName || row.fullname;
  if (typeof direct === "string" && direct.trim()) return direct.trim();

  // tu esquema: names + lastNames
  const names = typeof row.names === "string" ? row.names.trim() : "";
  const last = typeof row.lastNames === "string" ? row.lastNames.trim() : "";
  const composed = `${names} ${last}`.trim();
  if (composed) return composed;

  // otros alias por si acaso
  const n = (row.firstName || row.givenName || "").toString().trim();
  const l = (row.lastName || row.surname || "").toString().trim();
  const alt = `${n} ${l}`.trim();
  return alt || null;
}

export default function FamilyMenu({ client, onLogout }: Props) {
  const [settings, setSettings] = useState<Settings | null>(null);
  const [menu, setMenu] = useState<MenuData | null>(null);
  const [activeCat, setActiveCat] = useState<string | null>(null);
  const [cart, setCart] = useState<Record<string, CartItem>>({});
  const [posting, setPosting] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  // Nombre resuelto (desde props o RTDB)
  const [resolvedName, setResolvedName] = useState<string>("");

  // Historial
  const [showHistory, setShowHistory] = useState(false);

  /* ==== Resolver nombre del cliente ==== */
  useEffect(() => {
    let mounted = true;

    async function get(path: string) {
      try {
        const v = await RTDBHelper.getData<any>(path);
        return v ?? null;
      } catch {
        return null;
      }
    }

    (async () => {
      // 1) si vino por props
      if (client.name && client.name.trim()) {
        if (mounted) setResolvedName(client.name.trim());
        return;
      }

      // 2) intenta varios paths posibles
      const candidates: string[] = [];
      if ((RTDB_PATHS as any)?.clients) {
        candidates.push(`${RTDB_PATHS.clients}/${client.code}`);
      }
      // fallbacks genéricos
      candidates.push(
        `/clients/${client.code}`,
        `/students/${client.code}`,
        `/alumnos/${client.code}`,
        `/people/${client.code}`
      );

      for (const p of candidates) {
        const row = await get(p);
        const name = deriveName(row);
        if (mounted && name) {
          setResolvedName(name);
          return;
        }
      }

      // 3) índice plano opcional
      const idx = await get(`clients_by_code/${client.code}`);
      const idxName = deriveName(idx) || (idx?.name ?? "").toString().trim();
      if (mounted && idxName) {
        setResolvedName(idxName);
        return;
      }

      // 4) fallback
      if (mounted) setResolvedName("Estudiante");
    })();

    return () => {
      mounted = false;
    };
  }, [client.code, client.name]);

  /* ==== Escuchar configuración y menú ==== */
  useEffect(() => {
    const off1 = RTDBHelper.listenToData<Settings>(RTDB_PATHS.lunch_settings, (d) =>
      setSettings(d || null)
    );
    const off2 = RTDBHelper.listenToData<MenuData>(RTDB_PATHS.lunch_menu, (d) => {
      setMenu(d || null);
    });
    return () => {
      off1?.();
      off2?.();
    };
  }, []);

  /* ==== Derivados de menú ==== */
  const categories = useMemo<Category[]>(() => {
    const m = menu?.categories || {};
    return Object.values(m)
      .filter(Boolean)
      .sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
  }, [menu]);

  const productsByCat = useMemo<Record<string, Product[]>>(() => {
    const out: Record<string, Product[]> = {};
    const all = Object.values(menu?.products || {}).filter((p) => p?.active !== false);
    for (const p of all) {
      const key = p.categoryId || "otros";
      (out[key] ||= []).push(p);
    }
    for (const key of Object.keys(out)) {
      out[key].sort((a, b) => a.name.localeCompare(b.name));
    }
    return out;
  }, [menu]);

  useEffect(() => {
    if (!activeCat && categories[0]) setActiveCat(categories[0].id);
  }, [categories, activeCat]);

  const total = useMemo(
    () => Object.values(cart).reduce((acc, it) => acc + (it.subtotal || 0), 0),
    [cart]
  );

  const addToCart = (p: Product | CartItem) => {
    setCart((prev) => {
      const curr = prev[p.id];
      const qty = (curr?.qty ?? 0) + 1;
      const subtotal = qty * (p.price ?? 0);
      return { ...prev, [p.id]: { ...(p as Product), qty, subtotal } };
    });
  };

  const decItem = (id: string) =>
    setCart((prev) => {
      const curr = prev[id];
      if (!curr) return prev;
      const qty = curr.qty - 1;
      if (qty <= 0) {
        const { [id]: _, ...rest } = prev;
        return rest;
      }
      return { ...prev, [id]: { ...curr, qty, subtotal: qty * curr.price } };
    });

  const clearCart = () => setCart({});

  /* ==== Confirmación + guardar ==== */
  const placeOrder = async () => {
    setMessage(null);

    if (settings?.isOpen === false) {
      return setMessage("El pedido no está disponible en este momento.");
    }
    if (!inWindow(settings?.orderWindow)) {
      return setMessage("Fuera del horario permitido para pedidos.");
    }
    if (!Object.keys(cart).length) {
      return setMessage("Agregue al menos un producto.");
    }

    const alumno = window.prompt("Nombre del alumno (obligatorio):", resolvedName) || "";
    if (!alumno.trim()) {
      return setMessage("Debes indicar el nombre del alumno.");
    }

    let recreo =
      (window.prompt('¿Recreo? Escribe "primero" o "segundo" (segundo por defecto):', "segundo") ||
        "segundo"
      ).toLowerCase();
    if (recreo !== "primero" && recreo !== "segundo") recreo = "segundo";

    const hasCombo = Object.values(cart).some((it) => it.isCombo);
    if (hasCombo && recreo === "primero") {
      return setMessage("El almuerzo no puede entregarse en el 1er recreo. Elige segundo recreo.");
    }

    const nota = window.prompt("Observación (opcional):", "") || undefined;

    setPosting(true);
    try {
      const orderCode = await RTDBHelper.getNextCorrelative("lunch");

      const items = Object.values(cart).map((it) => ({
        id: it.id,
        name: it.name,
        qty: it.qty,
        price: it.price,
        isCombo: !!it.isCombo,
      }));

      const payload = {
        id: "",
        code: orderCode,
        clientCode: client.code,
        clientName: resolvedName || client.name || "Estudiante",
        items,
        note: nota || null,
        total,
        status: "pending" as const,
        createdAt: Date.now(),
        channel: "familias",
        recess: recreo as "primero" | "segundo",
        studentName: alumno.trim(),
      };

      const orderId = await RTDBHelper.pushData(RTDB_PATHS.lunch_orders, payload);
      await RTDBHelper.updateData({
        [`${RTDB_PATHS.lunch_orders}/${orderId}/id`]: orderId,
        [`lunch_orders_by_client/${client.code}/${orderId}`]: true,
      });

      clearCart();
      setMessage(`¡Pedido enviado! N° ${orderCode}`);
    } catch {
      setMessage("No se pudo enviar el pedido. Intente nuevamente.");
    } finally {
      setPosting(false);
    }
  };

  return (
    <section>
      {/* ====== Saludo ÚNICO ====== */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          marginBottom: 8,
          background: "#EAF7EF",
          border: "1px solid #CBEBD6",
          color: "#0F5132",
          padding: "10px 14px",
          borderRadius: 12,
        }}
      >
        <div>
          ¡Bienvenido(a), <strong>{resolvedName || "Estudiante"}</strong> —{" "}
          <span style={{ opacity: 0.85 }}>{client.code}</span>!
        </div>

        <div style={{ display: "flex", gap: 8 }}>
          <button
            type="button"
            onClick={() => setShowHistory((v) => !v)}
            style={{
              border: "1px solid #ddd",
              background: "white",
              padding: "6px 10px",
              borderRadius: 10,
              cursor: "pointer",
            }}
          >
            {showHistory ? "Ocultar historial" : "Ver historial"}
          </button>

          {onLogout && (
            <button
              type="button"
              onClick={onLogout}
              style={{
                border: "1px solid #ddd",
                background: "white",
                padding: "6px 10px",
                borderRadius: 10,
                cursor: "pointer",
              }}
            >
              Salir
            </button>
          )}
        </div>
      </div>

      {/* Historial del cliente */}
      {showHistory && (
        <div style={{ marginBottom: 14 }}>
          <FamilyOrderHistory clientCode={client.code} />
        </div>
      )}

      {/* Aviso cerrado */}
      {settings?.isOpen === false && (
        <div
          style={{
            background: "#fff7ed",
            border: "1px solid #fed7aa",
            color: "#9a3412",
            padding: "10px 12px",
            borderRadius: 10,
            marginBottom: 12,
          }}
        >
          El portal de pedidos está cerrado temporalmente.
        </div>
      )}

      {/* Tabs de categorías */}
      <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginBottom: 14 }}>
        {categories.map((c) => (
          <button
            key={c.id}
            onClick={() => setActiveCat(c.id)}
            style={{
              padding: "8px 12px",
              borderRadius: 999,
              border: "1px solid #ddd",
              background: activeCat === c.id ? "#10b981" : "white",
              color: activeCat === c.id ? "white" : "#111827",
              cursor: "pointer",
            }}
          >
            {c.name}
          </button>
        ))}
      </div>

      {/* Grid de productos */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fill, minmax(260px, 1fr))",
          gap: 12,
        }}
      >
        {(productsByCat[activeCat || ""] || []).map((p) => (
          <article
            key={p.id}
            style={{
              border: "1px solid #e5e7eb",
              borderRadius: 12,
              overflow: "hidden",
              background: "white",
              display: "flex",
              flexDirection: "column",
            }}
          >
            {p.image ? (
              <img
                src={p.image}
                alt={p.name}
                style={{ width: "100%", height: 180, objectFit: "cover" }}
                loading="lazy"
              />
            ) : (
              <div
                style={{
                  height: 180,
                  background: "#f3f4f6",
                  display: "grid",
                  placeItems: "center",
                  color: "#6b7280",
                  fontSize: 12,
                }}
              >
                Sin imagen
              </div>
            )}
            <div style={{ padding: 12, display: "grid", gap: 6 }}>
              <strong>{p.name}</strong>
              {p.description && (
                <p style={{ margin: 0, color: "#6b7280", fontSize: 12 }}>{p.description}</p>
              )}
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "end" }}>
                <span style={{ fontWeight: 600 }}>{PEN(p.price)}</span>
                <button
                  onClick={() => addToCart(p)}
                  style={{
                    border: "1px solid #10b981",
                    background: "#10b981",
                    color: "white",
                    borderRadius: 10,
                    padding: "6px 10px",
                    cursor: "pointer",
                  }}
                >
                  Agregar
                </button>
              </div>
            </div>
          </article>
        ))}
      </div>

      {/* Carrito */}
      <div
        style={{
          position: "sticky",
          bottom: 0,
          marginTop: 18,
          background: "white",
          borderTop: "1px solid #e5e7eb",
          padding: 12,
        }}
      >
        <h3 style={{ margin: "4px 0 10px 0" }}>Carrito</h3>
        {Object.keys(cart).length === 0 ? (
          <p style={{ margin: 0, color: "#6b7280" }}>Sin productos en el carrito.</p>
        ) : (
          <div style={{ display: "grid", gap: 8 }}>
            {Object.values(cart).map((it) => (
              <div
                key={it.id}
                style={{
                  display: "grid",
                  gridTemplateColumns: "1fr auto auto",
                  gap: 8,
                  alignItems: "center",
                }}
              >
                <div>
                  <div style={{ fontWeight: 600 }}>{it.name}</div>
                  <div style={{ fontSize: 12, color: "#6b7280" }}>
                    {it.qty} × {PEN(it.price)}
                  </div>
                </div>
                <div style={{ fontWeight: 600 }}>{PEN(it.subtotal)}</div>
                <div style={{ display: "flex", gap: 6 }}>
                  <button
                    onClick={() => decItem(it.id)}
                    title="Quitar uno"
                    style={{
                      border: "1px solid #ddd",
                      background: "white",
                      borderRadius: 8,
                      padding: "4px 8px",
                      cursor: "pointer",
                    }}
                  >
                    −
                  </button>
                  <button
                    onClick={() => addToCart(it)}
                    title="Agregar uno"
                    style={{
                      border: "1px solid #ddd",
                      background: "white",
                      borderRadius: 8,
                      padding: "4px 8px",
                      cursor: "pointer",
                    }}
                  >
                    +
                  </button>
                </div>
              </div>
            ))}

            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                borderTop: "1px dashed #e5e7eb",
                paddingTop: 8,
                marginTop: 4,
                alignItems: "center",
              }}
            >
              <strong>Total</strong>
              <strong>{PEN(total)}</strong>
            </div>

            <div style={{ display: "flex", gap: 8 }}>
              <button
                onClick={clearCart}
                disabled={posting}
                style={{
                  border: "1px solid #ddd",
                  background: "white",
                  borderRadius: 10,
                  padding: "8px 12px",
                  cursor: "pointer",
                }}
              >
                Vaciar
              </button>
              <button
                onClick={placeOrder}
                disabled={posting || total <= 0}
                style={{
                  border: "1px solid #10b981",
                  background: posting ? "#a7f3d0" : "#10b981",
                  color: "white",
                  borderRadius: 10,
                  padding: "8px 12px",
                  cursor: "pointer",
                  minWidth: 160,
                }}
              >
                {posting ? "Enviando…" : "Confirmar pedido"}
              </button>
            </div>
            {message && <div style={{ color: "#065f46" }}>{message}</div>}
          </div>
        )}
      </div>
    </section>
  );
}
