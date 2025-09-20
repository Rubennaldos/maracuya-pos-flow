import { useEffect, useMemo, useState } from "react";
import { RTDBHelper } from "@/lib/rt";
import { RTDB_PATHS } from "@/lib/rtdb";

type Client = { code: string; name: string };

type Category = { id: string; name: string; order?: number };
type Product = {
  id: string;
  name: string;
  description?: string;
  price: number;
  image?: string;
  categoryId: string;
  active?: boolean;
};

type MenuData = {
  categories?: Record<string, Category>;
  products?: Record<string, Product>;
};

type Settings = {
  isOpen?: boolean;
  orderWindow?: { start?: string; end?: string }; // ej. "08:00" - "11:00"
  allowSameDay?: boolean;
};

type CartItem = Product & { qty: number; subtotal: number };

type Props = {
  client: Client;
  onLogout?: () => void; // ← ahora opcional
};

const formatPrice = (n: number) =>
  new Intl.NumberFormat("es-PE", { style: "currency", currency: "PEN" }).format(n ?? 0);

function inWindow(win?: { start?: string; end?: string }) {
  if (!win?.start || !win?.end) return true; // si no hay ventana, no limitamos
  const now = new Date();
  const pad = (x: number) => String(x).padStart(2, "0");
  const hhmm = `${pad(now.getHours())}:${pad(now.getMinutes())}`;
  return hhmm >= win.start && hhmm <= win.end;
}

export default function FamilyMenu({ client, onLogout }: Props) {
  const [settings, setSettings] = useState<Settings | null>(null);
  const [menu, setMenu] = useState<MenuData | null>(null);
  const [activeCat, setActiveCat] = useState<string | null>(null);
  const [cart, setCart] = useState<Record<string, CartItem>>({});
  const [posting, setPosting] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  // Escuchar configuración y menú en vivo
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

  // Derivados
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

  const addToCart = (p: Product) => {
    setCart((prev) => {
      const curr = prev[p.id];
      const qty = (curr?.qty ?? 0) + 1;
      const subtotal = qty * (p.price ?? 0);
      return { ...prev, [p.id]: { ...p, qty, subtotal } };
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

  // Crear pedido en /lunch_orders (+ índice opcional /lunch_orders_by_client/{code})
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

    setPosting(true);
    try {
      const items = Object.values(cart).map((it) => ({
        productId: it.id,
        name: it.name,
        qty: it.qty,
        price: it.price,
        subtotal: it.subtotal,
      }));

      const payload = {
        clientCode: client.code,
        clientName: client.name,
        items,
        total,
        status: "pending",
        createdAt: Date.now(), // número (compatible con reglas)
        channel: "familias",
      };

      // push devuelve id generado (lo guardamos en el mismo nodo)
      const orderId = await RTDBHelper.pushData(RTDB_PATHS.lunch_orders, payload);
      await RTDBHelper.updateData({
        [`${RTDB_PATHS.lunch_orders}/${orderId}/id`]: orderId,
        // Índice opcional por cliente (útil para historial)
        [`lunch_orders_by_client/${client.code}/${orderId}`]: true,
      });

      clearCart();
      setMessage(`¡Pedido enviado! N° ${orderId.slice(-6).toUpperCase()}`);
    } catch {
      setMessage("No se pudo enviar el pedido. Intente nuevamente.");
    } finally {
      setPosting(false);
    }
  };

  return (
    <section>
      {/* Barra de saludo / Salir (si el padre lo quiere desde aquí) */}
      {onLogout && (
        <div
          style={{
            display: "flex",
            justifyContent: "flex-end",
            marginBottom: 8,
          }}
        >
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
        </div>
      )}

      {/* Avisos / ventana */}
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
          gridTemplateColumns: "repeat(auto-fill, minmax(220px, 1fr))",
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
                style={{ width: "100%", height: 140, objectFit: "cover" }}
                loading="lazy"
              />
            ) : (
              <div
                style={{
                  height: 140,
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
                <span style={{ fontWeight: 600 }}>{formatPrice(p.price)}</span>
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
                    {it.qty} × {formatPrice(it.price)}
                  </div>
                </div>
                <div style={{ fontWeight: 600 }}>{formatPrice(it.subtotal)}</div>
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
              <strong>{formatPrice(total)}</strong>
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
