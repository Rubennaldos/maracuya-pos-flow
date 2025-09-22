// src/components/modules/lunch/FamilyMenu.tsx
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
  /** NUEVO: orden persistido desde el panel (preferente) */
  position?: number | string;
  /** Compatibilidad si tenías 'order' antes */
  order?: number | string;
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

/** Comparador: primero por 'position' (o 'order'), luego por nombre.
 *  Robusto si vienen como string desde Firebase.
 */
function cmpByPositionThenName(a: Product, b: Product) {
  const toNum = (v: unknown): number =>
    isFinite(Number(v)) ? Number(v) : Number.POSITIVE_INFINITY;

  const pa = toNum(a.position ?? a.order);
  const pb = toNum(b.position ?? b.order);

  if (pa !== pb) return pa - pb;
  return (a.name || "").localeCompare(b.name || "");
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

  // Confirm modal state
  const [showConfirm, setShowConfirm] = useState(false);
  const [confirmStudent, setConfirmStudent] = useState<string>("");
  const [confirmRecess, setConfirmRecess] = useState<"primero" | "segundo">("segundo");
  const [confirmNote, setConfirmNote] = useState<string>("");

  /* ==== Resolver nombre del cliente ==== */
  useEffect(() => {
    let mounted = true;

    async function tryGet(path: string) {
      try {
        const snap = await RTDBHelper.getData<any>(path);
        return snap && typeof snap === "object" ? snap : null;
      } catch {
        return null;
      }
    }

    (async () => {
      // 1) Si vino en props, úsalo
      if (client.name && client.name.trim()) {
        if (mounted) setResolvedName(client.name.trim());
        return;
      }

      // 2) Intentar varios paths posibles en RTDB
      const candidates: string[] = [];
      if ((RTDB_PATHS as any)?.clients) {
        candidates.push(`${(RTDB_PATHS as any).clients}/${client.code}`);
      }
      candidates.push(
        `/clients/${client.code}`,
        `/students/${client.code}`,
        `/alumnos/${client.code}`,
        `/people/${client.code}`
      );

      for (const p of candidates) {
        const row = await tryGet(p);
        // tu estructura muestra names + lastNames, intentamos componer
        const name = row?.name || row?.fullName || row?.fullname;
        if (mounted && name) {
          setResolvedName(String(name));
          return;
        }
        // algunos nodos usan 'names' + 'lastNames'
        if (row?.names || row?.lastNames) {
          const n = (row.names || "").toString().trim();
          const ln = (row.lastNames || "").toString().trim();
          const composed = `${n}${n && ln ? " " : ""}${ln}`.trim();
          if (mounted && composed) {
            setResolvedName(composed);
            return;
          }
        }
      }

      // 3) Último intento: índice plano opcional
      const idx = await tryGet(`clients_by_code/${client.code}`);
      if (mounted && idx?.name) {
        setResolvedName(String(idx.name));
        return;
      }

      // 4) Fallback
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
    // ORDEN CORREGIDO: dentro de cada categoría por position/order y luego nombre
    for (const key of Object.keys(out)) {
      out[key].sort(cmpByPositionThenName);
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

  /* ===== Mostrar modal de confirmación ===== */
  const openConfirm = () => {
    setMessage(null);

    if (settings?.isOpen === false) {
      setMessage("El pedido no está disponible en este momento.");
      return;
    }
    if (!inWindow(settings?.orderWindow)) {
      setMessage("Fuera del horario permitido para pedidos.");
      return;
    }
    if (!Object.keys(cart).length) {
      setMessage("Agregue al menos un producto.");
      return;
    }

    // prefills
    setConfirmStudent(resolvedName || client.name || "Estudiante");
    setConfirmRecess("segundo");
    setConfirmNote("");
    setShowConfirm(true);
  };

  /* ===== Confirmar y guardar en RTDB ===== */
  const confirmAndPlace = async () => {
    setMessage(null);

    // Validaciones modal
    const alumno = (confirmStudent || "").trim();
    if (!alumno) {
      setMessage("Debe indicar el nombre del alumno.");
      return;
    }

    const hasCombo = Object.values(cart).some((it) => !!it.isCombo);
    if (hasCombo && confirmRecess === "primero") {
      setMessage("El almuerzo no puede entregarse en el 1er recreo. Elige segundo recreo.");
      return;
    }

    setPosting(true);
    try {
      const orderCode = await RTDBHelper.getNextCorrelative("lunch");

      const items = Object.values(cart).map((it) => ({
        id: it.id,
        name: it.name,
        qty: it.qty,
        price: it.price,
        ...(it.isCombo ? { isCombo: true } : {}),
      }));

      const payload = {
        id: "",
        code: orderCode,
        clientCode: client.code,
        clientName: resolvedName || client.name || "Estudiante",
        items,
        note: confirmNote || null,
        total,
        status: "pending",
        createdAt: Date.now(),
        channel: "familias",
        recess: confirmRecess,
        studentName: alumno,
      };

      const orderId = await RTDBHelper.pushData(RTDB_PATHS.lunch_orders, payload);
      await RTDBHelper.updateData({
        [`${RTDB_PATHS.lunch_orders}/${orderId}/id`]: orderId,
        [`lunch_orders_by_client/${client.code}/${orderId}`]: true,
      });

      clearCart();
      setShowConfirm(false);
      setMessage(`¡Pedido enviado! N° ${orderCode}`);
    } catch (err) {
      console.error("Error pushing order:", err);
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
          ¡Bienvenido(a), <strong>{resolvedName || "Estudiante"}</strong>{" "}
          — <span style={{ opacity: 0.85 }}>{client.code}</span>!
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
                onClick={openConfirm}
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

      {/* ===== Modal de confirmación ===== */}
      {showConfirm && (
        <div
          role="dialog"
          aria-modal="true"
          style={{
            position: "fixed",
            inset: 0,
            display: "grid",
            placeItems: "center",
            background: "rgba(0,0,0,0.35)",
            zIndex: 2000,
            padding: 16,
          }}
          onClick={() => {
            // clic fuera = cerrar
            setShowConfirm(false);
          }}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{
              width: "min(720px, 96%)",
              background: "white",
              borderRadius: 12,
              boxShadow: "0 10px 30px rgba(0,0,0,0.2)",
              padding: 18,
            }}
          >
            <h3 style={{ marginTop: 0, marginBottom: 8 }}>Confirmar pedido</h3>
            <div style={{ color: "#374151", marginBottom: 12 }}>
              Estás a punto de solicitar <strong>{Object.values(cart).length}</strong> producto(s)
              por un total de <strong>{PEN(total)}</strong> para el alumno{" "}
              <strong>{confirmStudent}</strong>.
            </div>

            <div style={{ display: "grid", gap: 8, marginBottom: 12 }}>
              <div>
                <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 6 }}>Productos</div>
                <div style={{ maxHeight: 140, overflow: "auto", paddingRight: 6 }}>
                  {Object.values(cart).map((it) => (
                    <div key={it.id} style={{ display: "flex", justifyContent: "space-between", padding: "4px 0", borderBottom: "1px dashed #eee" }}>
                      <div style={{ color: "#374151" }}>
                        {it.qty} × {it.name}
                      </div>
                      <div style={{ fontWeight: 600 }}>{PEN(it.subtotal)}</div>
                    </div>
                  ))}
                </div>
              </div>

              <div>
                <div style={{ marginBottom: 6, fontWeight: 600 }}>Recreo</div>
                <div style={{ display: "flex", gap: 12, alignItems: "center" }}>
                  <label style={{ display: "flex", gap: 6, alignItems: "center", cursor: "pointer" }}>
                    <input
                      type="radio"
                      name="recess"
                      checked={confirmRecess === "primero"}
                      onChange={() => setConfirmRecess("primero")}
                      disabled={Object.values(cart).some((it) => !!it.isCombo)}
                    />
                    Primero
                  </label>
                  <label style={{ display: "flex", gap: 6, alignItems: "center", cursor: "pointer" }}>
                    <input
                      type="radio"
                      name="recess"
                      checked={confirmRecess === "segundo"}
                      onChange={() => setConfirmRecess("segundo")}
                    />
                    Segundo
                  </label>
                  {Object.values(cart).some((it) => !!it.isCombo) && (
                    <div style={{ color: "#b91c1c", fontSize: 12 }}>
                      (Almuerzo detectado — no permitido en primer recreo)
                    </div>
                  )}
                </div>
              </div>

              <div>
                <div style={{ marginBottom: 6, fontWeight: 600 }}>Observación (opcional)</div>
                <textarea
                  rows={3}
                  value={confirmNote}
                  onChange={(e) => setConfirmNote(e.target.value)}
                  style={{ width: "100%", padding: 8, borderRadius: 8, border: "1px solid #e5e7eb" }}
                />
              </div>
            </div>

            <div style={{ display: "flex", justifyContent: "flex-end", gap: 8 }}>
              <button
                onClick={() => setShowConfirm(false)}
                style={{
                  border: "1px solid #ddd",
                  background: "white",
                  padding: "8px 12px",
                  borderRadius: 8,
                  cursor: "pointer",
                }}
                disabled={posting}
              >
                Cancelar
              </button>
              <button
                onClick={confirmAndPlace}
                style={{
                  border: "1px solid #10b981",
                  background: "#10b981",
                  color: "white",
                  padding: "8px 12px",
                  borderRadius: 8,
                  cursor: "pointer",
                  minWidth: 140,
                }}
                disabled={posting}
              >
                {posting ? "Enviando…" : `Confirmar — ${PEN(total)}`}
              </button>
            </div>
            {message && <div style={{ color: "#065f46", marginTop: 12 }}>{message}</div>}
          </div>
        </div>
      )}
    </section>
  );
}
