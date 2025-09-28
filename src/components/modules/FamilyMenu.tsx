import { useEffect, useMemo, useState } from "react";
import { RTDBHelper } from "@/lib/rt";
import { RTDB_PATHS } from "@/lib/rtdb";
import FamilyOrderHistory from "@/components/modules/lunch/FamilyOrderHistory";
import { useActiveAnnouncements } from "@/hooks/useActiveAnnouncements";
import { AnnouncementBanner } from "@/components/ui/AnnouncementBanner";

/* ===== Tipos ===== */
type Client = { code: string; name?: string };

type Category = { id: string; name: string; order?: number };
type Addon = { id: string; name: string; price: number; active?: boolean };
type Product = {
  id: string;
  name: string;
  description?: string;
  price: number;
  image?: string;
  categoryId: string;
  active?: boolean;
  isCombo?: boolean;
  position?: number | string;
  order?: number | string;
  addons?: Addon[];
};

type MenuData = {
  categories?: Record<string, Category>;
  products?: Record<string, Product>;
};

type Settings = {
  isOpen?: boolean;
  orderWindow?: { start?: string; end?: string };
  allowSameDay?: boolean;

  /** metadatos de versión/actualización */
  version?: string;
  updateSeq?: number;
  updatedAt?: number;

  /** WhatsApp */
  whatsapp?: {
    enabled?: boolean;
    phone?: string;
  };
};

type CartItem = Product & {
  qty: number;
  subtotal: number;
  selectedAddons?: Addon[];
};

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

function cmpByPositionThenName(a: Product, b: Product) {
  const toNum = (v: unknown): number =>
    isFinite(Number(v)) ? Number(v) : Number.POSITIVE_INFINITY;
  const pa = toNum(a.position ?? a.order);
  const pb = toNum(b.position ?? b.order);
  if (pa !== pb) return pa - pb;
  return (a.name || "").localeCompare(b.name || "");
}

/* WhatsApp helpers */
function buildWhatsAppText(params: {
  orderCode: number | string;
  studentName: string;
  clientCode: string;
  recess: "primero" | "segundo";
  items: { name: string; qty: number; price: number; addons?: Addon[] }[];
  total: number;
  note?: string | null;
}) {
  const lines: string[] = [
    `*Nuevo pedido de almuerzo*`,
    `N°: *${params.orderCode}*`,
    `Alumno: ${params.studentName} — Código: ${params.clientCode}`,
    `Recreo: ${params.recess === "primero" ? "Primero" : "Segundo"}`,
    ``,
    `*Productos:*`,
    ...params.items.map((it) => {
      const base = `• ${it.qty} × ${it.name} — S/ ${Number(it.price).toFixed(2)}`;
      const ad = (it.addons || [])
        .map((a) => `    ◦ + ${a.name}  S/ ${Number(a.price).toFixed(2)}`)
        .join("\n");
      return ad ? `${base}\n${ad}` : base;
    }),
    ``,
    `*Total:* S/ ${Number(params.total).toFixed(2)}`,
  ];
  if ((params.note || "").trim()) lines.push("", `*Observación:* ${params.note!.trim()}`);
  return lines.join("\n");
}
function sendWhatsAppIfEnabled(settings: Settings | null | undefined, text: string) {
  const enabled = !!settings?.whatsapp?.enabled;
  let phone = (settings?.whatsapp?.phone || "").replace(/\D+/g, "");
  if (!enabled || !phone) return;
  const url = `https://wa.me/${phone}?text=${encodeURIComponent(text)}`;
  window.open(url, "_blank", "noopener,noreferrer");
}

export default function FamilyMenu({ client, onLogout }: Props) {
  const [settings, setSettings] = useState<Settings | null>(null);
  const [menu, setMenu] = useState<MenuData | null>(null);
  const [activeCat, setActiveCat] = useState<string | null>(null);
  const [cart, setCart] = useState<Record<string, CartItem>>({});
  const [posting, setPosting] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  const [resolvedName, setResolvedName] = useState<string>("");
  const [showHistory, setShowHistory] = useState(false);

  // Hook para obtener anuncios activos
  const { announcements } = useActiveAnnouncements();

  const [showConfirm, setShowConfirm] = useState(false);
  const [confirmStudent, setConfirmStudent] = useState<string>("");
  const [confirmRecess, setConfirmRecess] = useState<"primero" | "segundo">("segundo");
  const [confirmNote, setConfirmNote] = useState<string>("");

  /* ==== Resolver nombre ==== */
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
      if (client.name && client.name.trim()) {
        if (mounted) setResolvedName(client.name.trim());
        return;
      }
      const candidates: string[] = [];
      if ((RTDB_PATHS as any)?.clients) {
        candidates.push(`${(RTDB_PATHS as any).clients}/${client.code}`);
      }
      candidates.push(`/clients/${client.code}`, `/students/${client.code}`, `/alumnos/${client.code}`, `/people/${client.code}`);
      for (const p of candidates) {
        const row = await tryGet(p);
        const name = row?.name || row?.fullName || row?.fullname;
        if (mounted && name) {
          setResolvedName(String(name));
          return;
        }
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
      const idx = await tryGet(`clients_by_code/${client.code}`);
      if (mounted && idx?.name) {
        setResolvedName(String(idx.name));
        return;
      }
      if (mounted) setResolvedName("Estudiante");
    })();
    return () => { mounted = false; };
  }, [client.code, client.name]);

  /* ==== Escuchar configuración y menú ==== */
  useEffect(() => {
    const off1 = RTDBHelper.listenToData<Settings>(RTDB_PATHS.lunch_settings, (d) => setSettings(d || null));
    const off2 = RTDBHelper.listenToData<MenuData>(RTDB_PATHS.lunch_menu, (d) => setMenu(d || null));
    return () => { off1?.(); off2?.(); };
  }, []);

  /* ==== Derivados ==== */
  const categories = useMemo<Category[]>(() => {
    const m = menu?.categories || {};
    return Object.values(m).filter(Boolean).sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
  }, [menu]);

  const productsByCat = useMemo<Record<string, Product[]>>(() => {
    const out: Record<string, Product[]> = {};
    const all = Object.values(menu?.products || {}).filter((p) => p?.active !== false);
    for (const p of all) {
      const key = p.categoryId || "otros";
      (out[key] ||= []).push(p as Product);
    }
    for (const key of Object.keys(out)) out[key].sort(cmpByPositionThenName);
    return out;
  }, [menu]);

  useEffect(() => {
    if (!activeCat && categories[0]) setActiveCat(categories[0].id);
  }, [categories, activeCat]);

  const total = useMemo(
    () => Object.values(cart).reduce((acc, it) => acc + (it.subtotal || 0), 0),
    [cart]
  );

  /* ==== Agregar con agregados ==== */
  const addToCart = (base: Product, selectedAddons?: Addon[]) => {
    const addSum = (selectedAddons || []).reduce((acc, a) => acc + (Number(a.price) || 0), 0);
    const unit = (base.price || 0) + addSum;
    setCart((prev) => {
      const curr = prev[base.id];
      const qty = (curr?.qty ?? 0) + 1;
      const subtotal = qty * unit;
      return {
        ...prev,
        [base.id]: {
          ...(base as Product),
          qty,
          subtotal,
          selectedAddons: (curr?.selectedAddons || selectedAddons || []).slice(),
        },
      };
    });
  };

  const decItem = (id: string) =>
    setCart((prev) => {
      const curr = prev[id];
      if (!curr) return prev;
      const unit =
        (curr.price || 0) +
        (curr.selectedAddons || []).reduce((s, a) => s + (Number(a.price) || 0), 0);
      const qty = curr.qty - 1;
      if (qty <= 0) {
        const { [id]: _, ...rest } = prev;
        return rest;
      }
      return { ...prev, [id]: { ...curr, qty, subtotal: qty * unit } };
    });

  const clearCart = () => setCart({});

  /* ===== Mostrar modal de confirmación ===== */
  const openConfirm = () => {
    setMessage(null);
    if (settings?.isOpen === false) { setMessage("El pedido no está disponible en este momento."); return; }
    if (!inWindow(settings?.orderWindow)) { setMessage("Fuera del horario permitido para pedidos."); return; }
    if (!Object.keys(cart).length) { setMessage("Agregue al menos un producto."); return; }
    setConfirmStudent(resolvedName || client.name || "Estudiante");
    setConfirmRecess("segundo");
    setConfirmNote("");
    setShowConfirm(true);
  };

  /* ===== Confirmar y guardar en RTDB ===== */
  const confirmAndPlace = async () => {
    setMessage(null);
    const alumno = (confirmStudent || "").trim();
    if (!alumno) { setMessage("Debe indicar el nombre del alumno."); return; }
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
        ...(it.selectedAddons?.length ? { addons: it.selectedAddons } : {}),
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

      const waText = buildWhatsAppText({
        orderCode,
        studentName: alumno,
        clientCode: client.code,
        recess: confirmRecess,
        items,
        total,
        note: confirmNote || null,
      });
      sendWhatsAppIfEnabled(settings, waText);

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

  /* ===== Tarjeta de producto con agregados ===== */
  const ProductCard: React.FC<{ p: Product }> = ({ p }) => {
    const [checked, setChecked] = useState<Record<string, boolean>>({});
    const selectable = (p.addons || []).filter((a) => a.active !== false);

    const selected = selectable.filter((a) => checked[a.id]);
    const addSum = selected.reduce((acc, a) => acc + (Number(a.price) || 0), 0);
    const displayTotal = (p.price || 0) + addSum;

    return (
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

          {!!selectable.length && (
            <div style={{ borderTop: "1px dashed #e5e7eb", paddingTop: 6 }}>
              <div style={{ fontSize: 12, fontWeight: 600, marginBottom: 4 }}>Agregados</div>
              <div style={{ display: "grid", gap: 4 }}>
                {selectable.map((a) => (
                  <label key={a.id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8, fontSize: 12 }}>
                    <span style={{ display: "flex", alignItems: "center", gap: 6 }}>
                      <input
                        type="checkbox"
                        checked={!!checked[a.id]}
                        onChange={(e) =>
                          setChecked((m) => ({ ...m, [a.id]: e.target.checked }))
                        }
                      />
                      {a.name}
                    </span>
                    <span style={{ color: "#065f46", fontWeight: 600 }}>
                      {PEN(Number(a.price) || 0)}
                    </span>
                  </label>
                ))}
              </div>
            </div>
          )}

          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "end" }}>
            <span style={{ fontWeight: 600 }}>
              {addSum ? (
                <>
                  <span style={{ textDecoration: "line-through", color: "#6b7280", marginRight: 6 }}>
                    {PEN(p.price)}
                  </span>
                  {PEN(displayTotal)}
                </>
              ) : (
                PEN(p.price)
              )}
            </span>
            <button
              onClick={() => addToCart(p, selected)}
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

          {/* Detalle de almuerzo debajo del precio */}
          {(
            (p as any).entrada ||
            (p as any).segundo ||
            (p as any).postre ||
            (p as any).refresco ||
            p.description
          ) && (
            <ul style={{ marginTop: 8, paddingLeft: 0, listStyle: "none", color: "#6b7280", fontSize: 13 }}>
              {(p as any).entrada && (
                <li>🥗 <span style={{ fontWeight: 600, color: "#111827" }}>Entrada:</span> {(p as any).entrada}</li>
              )}
              {(p as any).segundo && (
                <li>🍽️ <span style={{ fontWeight: 600, color: "#111827" }}>Segundo:</span> {(p as any).segundo}</li>
              )}
              {(p as any).postre && (
                <li>🍰 <span style={{ fontWeight: 600, color: "#111827" }}>Postre:</span> {(p as any).postre}</li>
              )}
              {(p as any).refresco && (
                <li>🥤 <span style={{ fontWeight: 600, color: "#111827" }}>Refresco:</span> {(p as any).refresco}</li>
              )}
              {p.description && (
                <li>📝 <span style={{ fontWeight: 600, color: "#111827" }}>Observación:</span> {p.description}</li>
              )}
            </ul>
          )}
        </div>
      </article>
    );
  };

  return (
    <section>
      {/* Saludo */}
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

      {/* Anuncios activos */}
      {announcements.length > 0 && (
        <div style={{ marginBottom: 16 }}>
          <AnnouncementBanner announcements={announcements} />
        </div>
      )}

      {/* Versión */}
      {settings?.version && (
        <div style={{ fontSize: 12, color: "#6b7280", marginBottom: 8 }}>
          Menú versión <strong>{settings.version}</strong> • Act# {settings.updateSeq ?? 0}
          {typeof settings.updatedAt === "number"
            ? ` • ${new Date(settings.updatedAt).toLocaleString("es-PE")}`
            : ""}
        </div>
      )}

      {/* Historial */}
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
          <ProductCard key={p.id} p={p} />
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
                  {!!it.selectedAddons?.length && (
                    <div style={{ fontSize: 12, color: "#6b7280" }}>
                      {it.selectedAddons.map((a) => `+ ${a.name} (${PEN(a.price)})`).join(" · ")}
                    </div>
                  )}
                  <div style={{ fontSize: 12, color: "#6b7280" }}>
                    {it.qty} × {PEN(it.price + (it.selectedAddons || []).reduce((s, a) => s + (a.price || 0), 0))}
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
                    onClick={() => addToCart(it, it.selectedAddons)}
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

      {/* Modal confirmación */}
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
          onClick={() => setShowConfirm(false)}
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
                    <div key={it.id} style={{ padding: "4px 0", borderBottom: "1px dashed #eee" }}>
                      <div style={{ display: "flex", justifyContent: "space-between" }}>
                        <div style={{ color: "#374151" }}>
                          {it.qty} × {it.name}
                        </div>
                        <div style={{ fontWeight: 600 }}>{PEN(it.subtotal)}</div>
                      </div>
                      {!!it.selectedAddons?.length && (
                        <div style={{ marginTop: 2, paddingLeft: 8, fontSize: 12, color: "#6b7280" }}>
                          {it.selectedAddons.map((a) => `+ ${a.name} (${PEN(a.price)})`).join(" · ")}
                        </div>
                      )}
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
