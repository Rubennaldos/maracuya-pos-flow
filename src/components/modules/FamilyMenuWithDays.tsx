import { useEffect, useMemo, useRef, useState } from "react";
import { motion } from "framer-motion";
import { RTDBHelper } from "@/lib/rt";
import { RTDB_PATHS } from "@/lib/rtdb";
import FamilyOrderHistory from "@/components/modules/lunch/FamilyOrderHistory";
import { useActiveAnnouncements } from "@/hooks/useActiveAnnouncements";
import { AnnouncementBanner } from "@/components/ui/AnnouncementBanner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";

import type {
  ProductT,
  CategoryT,
  MenuT,
  SettingsT as Settings,
  OrderItem,
  AddonT,
} from "./lunch/types";
import { getNextWeekDays, getEnabledDays, isDatePast } from "./lunch/utils/dateUtils";

import SelectDaysDialog from "@/components/modules/lunch/preview/SelectDaysDialog";
import AddonsSelectorDialog from "@/components/modules/lunch/preview/AddonsSelectorDialog";

/* ===== Tipos ===== */
type Client = { code: string; name?: string };

type CartItem = ProductT & {
  qty: number;
  subtotal: number;
  selectedDays?: string[];
  selectedAddons?: { [addonId: string]: number };
  addonsPrice?: number;
};

/* ===== Helpers ===== */
const PEN = (n: number) =>
  new Intl.NumberFormat("es-PE", { style: "currency", currency: "PEN" }).format(n ?? 0);

function inWindow(win?: { start?: string; end?: string }) {
  if (!win?.start || !win?.end) return true;
  const now = new Date();
  const pad = (x: number) => String(x).padStart(2, "0");
  const hhmm = `${pad(now.getHours())}:${pad(now.getMinutes())}`;
  return hhmm >= win.start && hhmm <= win.end;
}

function cmpByPositionThenName(a: ProductT, b: ProductT) {
  const toNum = (v: unknown): number =>
    isFinite(Number(v)) ? Number(v) : Number.POSITIVE_INFINITY;
  const pa = toNum(a.position ?? a.order);
  const pb = toNum(b.position ?? b.order);
  if (pa !== pb) return pa - pb;
  return (a.name || "").localeCompare(b.name || "");
}

// WhatsApp helpers
const normalizePhone = (raw: string) => (raw || "").replace(/\D/g, "");
const buildWaUrl = (digits: string, msg: string) =>
  `https://wa.me/${digits}?text=${encodeURIComponent(msg)}`;
const openWhatsAppNow = (url: string) => {
  // abrir en la misma pestaña para evitar bloqueos de popups
  window.location.href = url;
};

export default function FamilyMenuWithDays({
  client,
  onLogout,
}: {
  client: Client;
  onLogout?: () => void;
}) {
  const [settings, setSettings] = useState<Settings | null>(null);
  const [menu, setMenu] = useState<MenuT | null>(null);
  const [activeCat, setActiveCat] = useState<string | null>(null);
  const [cart, setCart] = useState<Record<string, CartItem>>({});
  const [posting, setPosting] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  const [resolvedName, setResolvedName] = useState<string>("");
  const [showHistory, setShowHistory] = useState(false);

  // confirmación
  const [showConfirm, setShowConfirm] = useState(false);
  const [confirmStudent, setConfirmStudent] = useState<string>("");
  const [confirmNote, setConfirmNote] = useState<string>("");

  // variados + agregados
  const [showDaySelection, setShowDaySelection] = useState(false);
  const [showAddonsSelection, setShowAddonsSelection] = useState(false);
  const [selectedProduct, setSelectedProduct] = useState<ProductT | null>(null);
  const [selectedDays, setSelectedDays] = useState<string[]>([]);
  const [selectedAddons, setSelectedAddons] = useState<{ [addonId: string]: number }>({});

  // anuncios
  const { announcements } = useActiveAnnouncements();

  // refs para UX móvil
  const cartRef = useRef<HTMLDivElement | null>(null);

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
      candidates.push(
        `/clients/${client.code}`,
        `/students/${client.code}`,
        `/alumnos/${client.code}`,
        `/people/${client.code}`
      );
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
    return () => {
      mounted = false;
    };
  }, [client.code, client.name]);

  /* ==== Escuchar configuración y menú ==== */
  useEffect(() => {
    const off1 = RTDBHelper.listenToData<Settings>(
      RTDB_PATHS.lunch_settings,
      (d) => setSettings(d || null)
    );
    const off2 = RTDBHelper.listenToData<MenuT>(
      RTDB_PATHS.lunch_menu,
      (d) => setMenu(d || null)
    );
    return () => {
      off1?.();
      off2?.();
    };
  }, []);

  /* ==== Derivados ==== */
  const categories = useMemo<CategoryT[]>(() => {
    const m = menu?.categories || {};
    return Object.values(m).filter(Boolean).sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
  }, [menu]);

  const productsByCategory = useMemo<Record<string, ProductT[]>>(() => {
    const out: Record<string, ProductT[]> = {};
    const all = Object.values(menu?.products || {}).filter((p) => {
      if (!p || p.active === false) return false;
      if (p.type === "lunch" && p.specificDate && isDatePast(p.specificDate)) return false;
      return true;
    });
    for (const p of all) {
      const key = p.categoryId || "otros";
      (out[key] ||= []).push(p as ProductT);
    }
    Object.keys(out).forEach((k) => out[k].sort(cmpByPositionThenName));
    return out;
  }, [menu]);

  useEffect(() => {
    if (!activeCat && categories[0]) setActiveCat(categories[0].id);
  }, [categories, activeCat]);

  // días disponibles (para varied)
  const availableDays = useMemo(() => {
    const enabledDayNames = getEnabledDays(settings?.disabledDays);
    const weekDays = getNextWeekDays();
    return weekDays.filter((day) => enabledDayNames.includes(day.day));
  }, [settings]);

  // total (incluye agregados en varied)
  const total = useMemo(() => {
    return Object.values(cart).reduce((acc, item) => {
      if (item.type === "varied" && item.selectedDays?.length) {
        const perDay = (item.price || 0) + (item.addonsPrice || 0);
        return acc + perDay * item.qty * item.selectedDays.length;
      }
      return acc + (item.subtotal || 0);
    }, 0);
  }, [cart]);

  /* ==== Varied + Addons ==== */
  const handleVariedProduct = (product: ProductT) => {
    setSelectedProduct(product);
    setSelectedDays([]);
    setSelectedAddons({});
    if (product.addons && product.addons.length > 0) setShowAddonsSelection(true);
    else setShowDaySelection(true);
  };

  const proceedToDaySelection = () => {
    setShowAddonsSelection(false);
    setShowDaySelection(true);
  };

  const computeAddonsPrice = (
    addons: AddonT[] | undefined,
    map: { [id: string]: number }
  ) => {
    if (!addons || !map) return 0;
    return Object.entries(map).reduce((tot, [id, qty]) => {
      const a = addons.find((x) => x.id === id);
      return tot + (a?.price || 0) * (qty || 0);
    }, 0);
  };

  const addVariedToCart = () => {
    if (!selectedProduct || selectedDays.length === 0) {
      setMessage("Debe seleccionar al menos un día.");
      return;
    }

    const addonsPrice = computeAddonsPrice(selectedProduct.addons, selectedAddons);
    const cartKey = `${selectedProduct.id}_varied`;

    setCart((prev) => {
      const existing = prev[cartKey];
      const newQty = (existing?.qty ?? 0) + 1;
      const perDay = (selectedProduct.price || 0) + (addonsPrice || 0);
      return {
        ...prev,
        [cartKey]: {
          ...selectedProduct,
          qty: newQty,
          selectedDays: selectedDays.slice(),
          selectedAddons:
            Object.keys(selectedAddons).length ? { ...selectedAddons } : undefined,
          addonsPrice,
          subtotal: perDay * newQty * selectedDays.length,
        },
      };
    });

    setShowDaySelection(false);
    setShowAddonsSelection(false);
    setSelectedProduct(null);
    setSelectedDays([]);
    setSelectedAddons({});
  };

  /* ==== Lunch ==== */
  const addLunchToCart = (product: ProductT) => {
    if (!product.specificDate) return;
    setCart((prev) => {
      const existing = prev[product.id];
      const newQty = (existing?.qty ?? 0) + 1;
      return {
        ...prev,
        [product.id]: {
          ...product,
          qty: newQty,
          subtotal: (product.price || 0) * newQty,
        },
      };
    });
  };

  const removeFromCart = (key: string) => {
    setCart((prev) => {
      const existing = prev[key];
      if (!existing) return prev;
      const newQty = existing.qty - 1;
      if (newQty <= 0) {
        const { [key]: _remove, ...rest } = prev;
        return rest;
      }
      let newSubtotal = 0;
      if (existing.type === "varied" && existing.selectedDays?.length) {
        const perDay = (existing.price || 0) + (existing.addonsPrice || 0);
        newSubtotal = perDay * newQty * existing.selectedDays.length;
      } else {
        newSubtotal = (existing.price || 0) * newQty;
      }
      return {
        ...prev,
        [key]: { ...existing, qty: newQty, subtotal: newSubtotal },
      };
    });
  };

  const clearCart = () => setCart({});

  /* ===== WhatsApp message ===== */
  const makeWaMessage = () => {
    const lines = Object.values(cart).map((i) => {
      const base = `• ${i.name} (x${i.qty})`;
      const days =
        i.selectedDays && i.selectedDays.length
          ? ` – Días: ${i.selectedDays
              .map((d) =>
                new Date(d + "T12:00:00").toLocaleDateString("es-PE", {
                  weekday: "short",
                  day: "2-digit",
                })
              )
              .join(", ")}`
          : "";
      return base + days;
    });

    return (
      `🍽️ *Pedido de almuerzo*\n\n` +
      `👤 ${resolvedName || client.name || "Estudiante"} (${client.code})\n\n` +
      `📦 *Detalle:*\n${lines.join("\n")}\n\n` +
      `💰 *Total:* ${PEN(total)}\n` +
      `📝 ${confirmNote ? `Nota: ${confirmNote}` : "Sin observaciones"}`
    );
  };

  /* ===== Confirmar pedido ===== */
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
    setConfirmStudent(resolvedName || client.name || "Estudiante");
    setConfirmNote("");
    setShowConfirm(true);
  };

  const confirmAndPlace = async () => {
    setMessage(null);
    const alumno = (confirmStudent || "").trim();
    if (!alumno) {
      setMessage("Debe indicar el nombre del alumno.");
      return;
    }

    setPosting(true);
    setShowConfirm(false);

    // 1) abrir WhatsApp YA (mismo gesto de click)
    const phoneDigits = normalizePhone(settings?.whatsapp?.phone || "");
    if (!phoneDigits) {
      setPosting(false);
      setMessage("No se pudo enviar a WhatsApp: configure un número en ajustes.");
      return;
    }
    const url = buildWaUrl(phoneDigits, makeWaMessage());
    openWhatsAppNow(url);

    // 2) guardar pedido en RTDB
    try {
      const orderCode = await RTDBHelper.getNextCorrelative("lunch");

      const items: OrderItem[] = Object.values(cart).map((item) => ({
        id: item.id,
        name: item.name,
        qty: item.qty,
        price: item.price,
        ...(item.type === "lunch" ? { specificDate: item.specificDate } : {}),
        ...(item.type === "varied" ? { selectedDays: item.selectedDays } : {}),
      }));

      const orderDate = new Intl.DateTimeFormat("en-CA", {
        timeZone: "America/Lima",
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
      }).format(new Date());

      const payload = {
        id: "",
        code: orderCode,
        clientCode: client.code,
        clientName: alumno,
        items,
        note: confirmNote || null,
        total,
        status: "pending",
        createdAt: Date.now(),
        channel: "familias",
        studentName: alumno,
        orderDate,
      };

      const orderId = await RTDBHelper.pushData(RTDB_PATHS.lunch_orders, payload);
      await RTDBHelper.updateData({
        [`${RTDB_PATHS.lunch_orders}/${orderId}/id`]: orderId,
        [`lunch_orders_by_client/${client.code}/${orderId}`]: true,
      });

      clearCart();
      setMessage(`¡Pedido enviado! N° ${orderCode}`);
    } catch (err) {
      console.error("Error pushing order:", err);
      setMessage("No se pudo guardar el pedido. Intente nuevamente.");
    } finally {
      setPosting(false);
    }
  };

  /* ===== Tarjeta de producto ===== */
  const ProductCard: React.FC<{ p: ProductT }> = ({ p }) => {
    const handleAddToCart = () => {
      if (p.type === "varied") handleVariedProduct(p);
      else addLunchToCart(p);
    };

    return (
      <motion.div
        initial={{ opacity: 0, y: 6 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.25 }}
      >
        <Card key={p.id} className="relative overflow-hidden md:h-full shadow-md hover:shadow-lg transition-shadow duration-200 rounded-2xl">
        {/* Imagen BCP-style 16:9 */}
        {p.image && (
          <div className="relative w-full overflow-hidden aspect-video">
            <img
              src={p.image}
              alt={p.name}
              className="h-full w-full object-cover"
              loading="lazy"
              decoding="async"
            />
            {/* Botón circular "+" dentro de la imagen (mobile) */}
            <motion.div whileTap={{ scale: 0.95 }}>
              <Button
                onClick={handleAddToCart}
                size="icon"
                className="md:hidden absolute bottom-2 right-2 h-10 w-10 rounded-full shadow-md hover:shadow-lg transition-shadow"
                aria-label={`Agregar ${p.name} al carrito`}
              >
                +
              </Button>
            </motion.div>
          </div>
        )}

        <CardContent className="p-3 md:p-4 space-y-2 md:space-y-3">
          <div>
            <h3 className="font-semibold text-[15px] md:text-base line-clamp-2 leading-tight">{p.name}</h3>
            {p.description && (
              <p className="text-xs md:text-sm text-muted-foreground mt-1 line-clamp-2">
                {p.description}
              </p>
            )}
          </div>

          <div className="flex items-end justify-between gap-2">
            <div className="min-w-0 flex-1">
              <div className="font-bold text-sm md:text-lg text-primary">{PEN(p.price)}</div>
              {p.type === "varied" && (
                <p className="text-[11px] md:text-xs text-muted-foreground">por día</p>
              )}
              {p.type === "lunch" && p.specificDate && (
                <p className="text-[11px] md:text-xs text-muted-foreground">
                  {new Date(p.specificDate + "T12:00:00").toLocaleDateString("es-PE", {
                    weekday: "long",
                    day: "numeric",
                    month: "short",
                  })}
                </p>
              )}

              {/* Detalle de almuerzo */}
              {p.type === "lunch" && (
                <ul className="mt-2 text-[12px] md:text-sm text-muted-foreground space-y-0.5">
                  {(p as any).entrada && (
                    <li>🥗 <span className="font-medium">Entrada:</span> {(p as any).entrada}</li>
                  )}
                  {(p as any).segundo && (
                    <li>🍽️ <span className="font-medium">Segundo:</span> {(p as any).segundo}</li>
                  )}
                  {(p as any).postre && (
                    <li>🍰 <span className="font-medium">Postre:</span> {(p as any).postre}</li>
                  )}
                  {(p as any).refresco && (
                    <li>🥤 <span className="font-medium">Refresco:</span> {(p as any).refresco}</li>
                  )}
                </ul>
              )}

              {/* Agregados como chips compactos */}
              {p.addons && p.addons.length > 0 && (
                <div className="mt-2">
                  <div className="flex flex-wrap gap-1">
                    {p.addons
                      .filter((a) => a && a.active !== false)
                      .slice(0, 3)
                      .map((a, idx) => (
                        <Badge
                          key={`${a.id || idx}`}
                          variant="outline"
                          className="text-[10px] md:text-[11px] rounded-full px-2 py-0.5"
                        >
                          {a.name}
                        </Badge>
                      ))}
                    {p.addons.filter((a) => a && a.active !== false).length > 3 && (
                      <Badge
                        variant="outline"
                        className="text-[10px] md:text-[11px] rounded-full px-2 py-0.5"
                      >
                        +{p.addons.filter((a) => a && a.active !== false).length - 3}
                      </Badge>
                    )}
                  </div>
                </div>
              )}
            </div>

            {/* Botón desktop */}
            <Button onClick={handleAddToCart} size="sm" className="hidden md:inline-flex rounded-full px-4">
              Agregar
            </Button>
          </div>
        </CardContent>
        </Card>
      </motion.div>
    );
  };

  return (
    <div className="min-h-screen bg-background">
      {/* Header compacto BCP-style */}
      <div className="border-b bg-white">
        <div className="max-w-7xl mx-auto px-4 py-2 md:py-4">
          <div className="flex items-center justify-between gap-3">
            <div className="min-w-0 flex-1">
              {/* Mobile: una línea compacta */}
              <div className="md:hidden">
                <h1 className="text-sm font-semibold truncate">
                  Hola, {resolvedName} – Código {client.code}
                </h1>
              </div>
              {/* Desktop: layout original */}
              <div className="hidden md:block">
                <h1 className="text-lg md:text-xl font-bold">¡Hola, {resolvedName}!</h1>
                <p className="text-xs md:text-sm text-muted-foreground">Código: {client.code}</p>
              </div>
            </div>
            <div className="flex gap-2">
              <Button
                variant="outline"
                size="sm"
                className="rounded-full text-xs md:text-sm px-2 md:px-3"
                onClick={() => setShowHistory(!showHistory)}
              >
                {showHistory ? "Ocultar" : "Historial"}
              </Button>
              {onLogout && (
                <Button 
                  variant="outline" 
                  size="sm" 
                  className="rounded-full text-xs md:text-sm px-2 md:px-3" 
                  onClick={onLogout}
                >
                  Salir
                </Button>
              )}
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 py-5 md:py-6">
        {/* Anuncios */}
        {announcements.length > 0 && (
          <div className="mb-4 md:mb-6">
            <AnnouncementBanner announcements={announcements} />
          </div>
        )}

        {/* Historial */}
        {showHistory && (
          <div className="mb-6">
            <FamilyOrderHistory clientCode={client.code} />
          </div>
        )}

        {/* Mensaje */}
        {message && (
          <div className="mb-4 md:mb-6">
            <Card
              className={
                message.includes("Error") || message.includes("No se")
                  ? "border-destructive"
                  : "border-green-500"
              }
            >
              <CardContent className="p-3 md:p-4">
                <p
                  className={
                    message.includes("Error") || message.includes("No se")
                      ? "text-destructive"
                      : "text-green-700"
                  }
                >
                  {message}
                </p>
              </CardContent>
            </Card>
          </div>
        )}

        <div className="grid lg:grid-cols-4 gap-4 md:gap-6">
          {/* Menú */}
          <div className="lg:col-span-3">
            {/* Categorías BCP-style – chips redondos, scroll horizontal */}
            <div className="flex gap-2 mb-4 md:mb-6 overflow-x-auto px-2 md:px-0 -mx-2 md:mx-0 snap-x snap-mandatory">
              {categories.map((cat) => (
                <Button
                  key={cat.id}
                  size="chip"
                  variant={activeCat === cat.id ? "default" : "outline"}
                  onClick={() => setActiveCat(cat.id)}
                  className="rounded-full text-xs px-3 whitespace-nowrap snap-start flex-shrink-0 hover:bg-muted transition-colors"
                >
                  {cat.name}
                </Button>
              ))}
            </div>

            {/* Productos con grid responsive */}
            {activeCat && (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 md:gap-4">
                {(productsByCategory[activeCat] || []).map((product) => (
                  <ProductCard key={product.id} p={product} />
                ))}
              </div>
            )}
          </div>

          {/* Carrito desktop */}
          <div className="hidden lg:block lg:col-span-1" ref={cartRef}>
            <Card className="sticky top-4">
              <CardHeader className="pb-2 md:pb-3">
                <CardTitle className="text-base md:text-lg">Tu pedido</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {Object.keys(cart).length === 0 ? (
                  <p className="text-muted-foreground text-center py-4">
                    Tu carrito está vacío
                  </p>
                ) : (
                  <>
                    <div className="space-y-3">
                      {Object.entries(cart).map(([key, item]) => (
                        <div key={key} className="flex justify-between items-start">
                          <div className="flex-1 min-w-0">
                            <p className="font-medium text-sm truncate">{item.name}</p>
                            <p className="text-xs text-muted-foreground">
                              {item.qty} × {PEN(item.price)}
                              {item.type === "varied" && item.selectedDays?.length ? (
                                <>
                                  <span> × {item.selectedDays.length} días</span>
                                  {item.addonsPrice ? (
                                    <span> + agregados ({PEN(item.addonsPrice)}/día)</span>
                                  ) : null}
                                </>
                              ) : null}
                            </p>
                            {item.selectedDays && (
                              <p className="text-xs text-muted-foreground">
                                Días:{" "}
                                {item.selectedDays
                                  .map((date) =>
                                    new Date(date + "T12:00:00").toLocaleDateString("es-PE", {
                                      weekday: "short",
                                      day: "numeric",
                                    })
                                  )
                                  .join(", ")}
                              </p>
                            )}
                          </div>
                          <div className="flex items-center gap-2">
                            <span className="font-medium text-sm">{PEN(item.subtotal)}</span>
                            <Button variant="outline" size="sm" onClick={() => removeFromCart(key)}>
                              -
                            </Button>
                          </div>
                        </div>
                      ))}
                    </div>

                    <div className="border-t pt-3">
                      <div className="flex justify-between items-center font-bold">
                        <span>Total:</span>
                        <span>{PEN(total)}</span>
                      </div>
                    </div>

                    <div className="space-y-2">
                      <Button className="w-full" onClick={openConfirm} disabled={posting}>
                        {posting ? "Enviando..." : "Confirmar pedido"}
                      </Button>
                      <Button variant="outline" className="w-full" onClick={clearCart}>
                        Limpiar carrito
                      </Button>
                    </div>
                  </>
                )}
              </CardContent>
            </Card>
          </div>
        </div>
      </div>

      {/* FAB carrito móvil BCP-style */}
      {Object.keys(cart).length > 0 && (
        <motion.div whileTap={{ scale: 0.95 }}>
          <Button
            variant="fab"
            className="lg:hidden fixed bottom-4 right-4 rounded-full shadow-lg h-14 px-4 font-semibold text-sm"
            onClick={openConfirm}
            disabled={posting}
            aria-label="Abrir carrito"
          >
            <div className="flex items-center gap-2">
              <div className="bg-white/20 rounded-full h-6 w-6 flex items-center justify-center text-xs font-bold">
                {Object.keys(cart).length}
              </div>
              <span>Ver carrito</span>
            </div>
          </Button>
        </motion.div>
      )}

      {/* Bottom sheet móvil para carrito */}
      {Object.keys(cart).length > 0 && (
        <div className="lg:hidden fixed bottom-0 inset-x-0 bg-white border-t p-3 safe-bottom">
          <div className="flex items-center justify-between gap-3">
            <div className="flex-1">
              <div className="text-xs text-muted-foreground">
                {Object.values(cart).reduce((sum, item) => sum + item.qty, 0)} productos
              </div>
              <div className="font-semibold">Total: {PEN(total)}</div>
            </div>
            <div className="flex items-center gap-2">
              <Button 
                size="sm" 
                className="rounded-full px-5" 
                onClick={openConfirm} 
                disabled={posting}
              >
                {posting ? "Enviando..." : "Confirmar"}
              </Button>
              <div className="flex items-center text-xs text-muted-foreground">
                📱 WhatsApp
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Modal de Agregados */}
      <AddonsSelectorDialog
        open={showAddonsSelection}
        onOpenChange={setShowAddonsSelection}
        productName={selectedProduct?.name}
        addons={selectedProduct?.addons || []}
        selectedAddons={selectedAddons}
        onAddonsChange={setSelectedAddons}
        onConfirm={proceedToDaySelection}
        confirmDisabled={false}
      />

      {/* Modal de selección de días */}
      <SelectDaysDialog
        open={showDaySelection}
        onOpenChange={setShowDaySelection}
        productName={selectedProduct?.name}
        pricePerDay={selectedProduct?.price}
        days={availableDays.map((d) => ({ date: d.date, label: d.label }))}
        selectedDays={selectedDays}
        onToggleDay={(date, checked) =>
          setSelectedDays((prev) => (checked ? [...prev, date] : prev.filter((x) => x !== date)))
        }
        onConfirm={addVariedToCart}
        confirmDisabled={selectedDays.length === 0}
        disabledDays={settings?.disabledDays}
      />

      {/* Modal de confirmación (simple) */}
      <Dialog open={showConfirm} onOpenChange={setShowConfirm}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Confirmar pedido</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label htmlFor="studentName">Nombre del estudiante</Label>
              <Input
                id="studentName"
                value={confirmStudent}
                onChange={(e) => setConfirmStudent(e.target.value)}
              />
            </div>

            <div>
              <Label htmlFor="note">Observaciones (opcional)</Label>
              <Textarea
                id="note"
                value={confirmNote}
                onChange={(e) => setConfirmNote(e.target.value)}
                placeholder="Alguna observación especial..."
              />
            </div>

            <div className="border-t pt-4">
              <div className="flex justify-between items-center font-bold">
                <span>Total:</span>
                <span>{PEN(total)}</span>
              </div>
            </div>

            <div className="flex gap-2 justify-end">
              <Button variant="outline" onClick={() => setShowConfirm(false)}>
                Cancelar
              </Button>
              <Button onClick={confirmAndPlace} disabled={posting}>
                {posting ? "Enviando..." : "Confirmar pedido"}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
