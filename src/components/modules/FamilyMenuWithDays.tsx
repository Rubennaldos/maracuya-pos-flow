import { useEffect, useMemo, useRef, useState } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
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
  const categoriesScrollRef = useRef<HTMLDivElement | null>(null);

  // Control del carrusel de categorías
  const scrollCategories = (direction: "left" | "right") => {
    if (!categoriesScrollRef.current) return;
    const scrollAmount = 150;
    const newScrollLeft =
      categoriesScrollRef.current.scrollLeft +
      (direction === "right" ? scrollAmount : -scrollAmount);
    categoriesScrollRef.current.scrollTo({
      left: newScrollLeft,
      behavior: "smooth",
    });
  };

  // Centrar categoría activa
  useEffect(() => {
    if (!categoriesScrollRef.current || !activeCat) return;
    const activeButton = categoriesScrollRef.current.querySelector(
      `[data-category="${activeCat}"]`
    ) as HTMLElement;
    if (activeButton) {
      const scrollContainer = categoriesScrollRef.current;
      const containerWidth = scrollContainer.offsetWidth;
      const buttonLeft = activeButton.offsetLeft;
      const buttonWidth = activeButton.offsetWidth;
      const scrollLeft = buttonLeft - containerWidth / 2 + buttonWidth / 2;
      scrollContainer.scrollTo({ left: scrollLeft, behavior: "smooth" });
    }
  }, [activeCat]);

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
      // Para promociones semanales, ocultar si todas las fechas ya pasaron
      if (p.type === "weekly_promotion" && p.weeklyPromotionDates) {
        const allPast = p.weeklyPromotionDates.every(dateStr => isDatePast(dateStr));
        if (allPast) return false;
      }
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

  /* ==== Weekly Promotion ==== */
  const addWeeklyPromotionToCart = (product: ProductT) => {
    if (!product.weeklyPromotionDates || product.weeklyPromotionDates.length !== 5) return;
    setCart((prev) => {
      const existing = prev[product.id];
      const newQty = (existing?.qty ?? 0) + 1;
      return {
        ...prev,
        [product.id]: {
          ...product,
          qty: newQty,
          selectedDays: product.weeklyPromotionDates, // Auto-select the 5 days
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
      let days = "";
      
      if (i.type === "weekly_promotion" && i.selectedDays && i.selectedDays.length) {
        days = ` – Promoción 5 días: ${i.selectedDays
          .map((d) =>
            new Date(d + "T12:00:00").toLocaleDateString("es-PE", {
              weekday: "short",
              day: "2-digit",
            })
          )
          .join(", ")}`;
      } else if (i.selectedDays && i.selectedDays.length) {
        days = ` – Días: ${i.selectedDays
          .map((d) =>
            new Date(d + "T12:00:00").toLocaleDateString("es-PE", {
              weekday: "short",
              day: "2-digit",
            })
          )
          .join(", ")}`;
      }
      
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
        ...(item.type === "varied" || item.type === "weekly_promotion" ? { selectedDays: item.selectedDays } : {}),
      }));

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
      else if (p.type === "weekly_promotion") addWeeklyPromotionToCart(p);
      else addLunchToCart(p);
    };

    return (
      <Card key={p.id} className="overflow-hidden hover:shadow-lg transition-all border-border/40">
        <div className="flex gap-3 p-3">
          {/* Imagen pequeña y cuadrada en móvil */}
          {p.image && (
            <div className="flex-shrink-0 w-20 h-20 sm:w-24 sm:h-24 rounded-lg overflow-hidden bg-muted">
              <img
                src={p.image}
                alt={p.name}
                className="w-full h-full object-cover"
                loading="lazy"
                decoding="async"
              />
            </div>
          )}

          {/* Contenido */}
          <div className="flex-1 min-w-0 flex flex-col justify-between">
            <div className="space-y-1">
              <h3 className="font-semibold text-sm leading-tight line-clamp-1">{p.name}</h3>
              
              {/* Precio y fecha */}
              <div className="flex items-baseline gap-2">
                {p.type === "weekly_promotion" && p.weeklyPromotionRegularPrice && (
                  <span className="text-xs text-muted-foreground line-through">{PEN(p.weeklyPromotionRegularPrice)}</span>
                )}
                <span className="font-bold text-primary text-base">{PEN(p.price)}</span>
                {p.type === "varied" && (
                  <span className="text-[10px] text-muted-foreground">/ día</span>
                )}
                {p.type === "weekly_promotion" && (
                  <Badge variant="secondary" className="text-[9px] h-4 px-1.5">5 días</Badge>
                )}
              </div>

              {p.type === "lunch" && p.specificDate && (
                <p className="text-[10px] text-muted-foreground">
                  {new Date(p.specificDate + "T12:00:00").toLocaleDateString("es-PE", {
                    weekday: "short",
                    day: "numeric",
                    month: "short",
                  })}
                </p>
              )}

              {p.type === "weekly_promotion" && p.weeklyPromotionDates && (
                <div className="flex flex-wrap gap-1 mt-1">
                  {p.weeklyPromotionDates.slice(0, 3).map((dateStr, idx) => (
                    <span key={idx} className="text-[9px] text-muted-foreground bg-muted/50 px-1.5 py-0.5 rounded">
                      {new Date(dateStr + "T12:00:00").toLocaleDateString("es-PE", {
                        weekday: "short",
                        day: "numeric",
                      })}
                    </span>
                  ))}
                  {p.weeklyPromotionDates.length > 3 && (
                    <span className="text-[9px] text-muted-foreground">+{p.weeklyPromotionDates.length - 3}</span>
                  )}
                </div>
              )}

              {/* Descripción breve solo en desktop */}
              {p.description && (
                <p className="hidden sm:block text-xs text-muted-foreground line-clamp-1">
                  {p.description}
                </p>
              )}
            </div>

            {/* Botón de acción */}
            <Button 
              onClick={handleAddToCart} 
              size="sm" 
              className="mt-2 w-full sm:w-auto rounded-full text-xs h-8"
            >
              + Agregar
            </Button>
          </div>
        </div>

        {/* Detalles expandibles del almuerzo */}
        {p.type === "lunch" && (
          <div className="px-3 pb-3 pt-0 space-y-1 text-[11px] text-muted-foreground">
            {(p as any).entrada && (
              <div className="flex gap-1.5">
                <span className="text-[10px]">🥗</span>
                <span className="line-clamp-1">{(p as any).entrada}</span>
              </div>
            )}
            {(p as any).segundo && (
              <div className="flex gap-1.5">
                <span className="text-[10px]">🍽️</span>
                <span className="line-clamp-1">{(p as any).segundo}</span>
              </div>
            )}
            {(p as any).postre && (
              <div className="flex gap-1.5">
                <span className="text-[10px]">🍰</span>
                <span className="line-clamp-1">{(p as any).postre}</span>
              </div>
            )}
            {(p as any).refresco && (
              <div className="flex gap-1.5">
                <span className="text-[10px]">🥤</span>
                <span className="line-clamp-1">{(p as any).refresco}</span>
              </div>
            )}
          </div>
        )}

        {/* Agregados disponibles */}
        {p.addons && p.addons.length > 0 && (
          <div className="px-3 pb-3 pt-0">
            <div className="flex flex-wrap gap-1">
              {p.addons
                .filter((a) => a && a.active !== false)
                .map((a, idx) => (
                  <Badge
                    key={`${a.id || idx}`}
                    variant="secondary"
                    className="text-[9px] h-5 px-2 rounded-full"
                  >
                    +{a.name}
                  </Badge>
                ))}
            </div>
          </div>
        )}
      </Card>
    );
  };

  return (
    <div className="min-h-screen bg-background pb-20 lg:pb-0 overflow-x-hidden">
      {/* Header compacto */}
      <div className="sticky top-0 z-10 border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
        <div className="w-full max-w-7xl mx-auto px-3 py-3 sm:px-4 sm:py-4">
          <div className="flex items-center justify-between gap-2">
            <div className="min-w-0 flex-1">
              <h1 className="text-lg sm:text-xl font-bold">
                ¡Hola, {resolvedName}!
              </h1>
              <p className="text-xs sm:text-sm text-muted-foreground">
                Código: {client.code}
              </p>
            </div>
            {onLogout && (
              <Button 
                variant="ghost" 
                size="sm" 
                className="h-9 px-3 sm:px-4 text-xs sm:text-sm flex-shrink-0" 
                onClick={onLogout}
              >
                Salir
              </Button>
            )}
          </div>
        </div>
      </div>

      <div className="w-full max-w-7xl mx-auto px-0 py-3 sm:px-4 sm:py-4">
        {/* Anuncios */}
        {announcements.length > 0 && (
          <div className="mb-4 md:mb-6">
            <AnnouncementBanner announcements={announcements} />
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

        <div className="grid lg:grid-cols-4 gap-3 lg:gap-6 px-3 sm:px-0">
          {/* Menú */}
          <div className="lg:col-span-3 w-full overflow-hidden">
            {/* Carrusel de categorías mejorado */}
            <div className="relative mb-4 sm:mb-5 -mx-3 sm:mx-0">
              <div className="bg-muted/30 rounded-none sm:rounded-2xl p-2 overflow-hidden">
                {/* Botón scroll izquierda */}
                <button
                  onClick={() => scrollCategories("left")}
                  className="hidden sm:flex absolute left-1 top-1/2 -translate-y-1/2 z-20 h-9 w-9 items-center justify-center rounded-full bg-background border-2 border-primary/20 shadow-lg hover:bg-primary hover:text-primary-foreground transition-all"
                  aria-label="Scroll izquierda"
                >
                  <ChevronLeft className="h-5 w-5" />
                </button>

                {/* Contenedor de categorías con overflow controlado */}
                <div
                  ref={categoriesScrollRef}
                  className="flex gap-2 overflow-x-auto scrollbar-hide scroll-smooth px-2 sm:px-12 py-1"
                  style={{
                    scrollbarWidth: "none",
                    msOverflowStyle: "none",
                  }}
                >
                  {categories.map((cat) => (
                    <Button
                      key={cat.id}
                      data-category={cat.id}
                      size="sm"
                      variant={activeCat === cat.id ? "default" : "outline"}
                      onClick={() => setActiveCat(cat.id)}
                      className={`
                        rounded-full px-4 h-10 text-xs sm:text-sm font-semibold whitespace-nowrap flex-shrink-0
                        transition-all duration-300 ease-out
                        ${
                          activeCat === cat.id
                            ? "shadow-lg scale-105 sm:scale-110 bg-gradient-to-r from-primary to-primary-light"
                            : "hover:scale-105 hover:shadow-md hover:border-primary/40"
                        }
                      `}
                    >
                      {cat.name}
                    </Button>
                  ))}
                </div>

                {/* Botón scroll derecha */}
                <button
                  onClick={() => scrollCategories("right")}
                  className="hidden sm:flex absolute right-1 top-1/2 -translate-y-1/2 z-20 h-9 w-9 items-center justify-center rounded-full bg-background border-2 border-primary/20 shadow-lg hover:bg-primary hover:text-primary-foreground transition-all"
                  aria-label="Scroll derecha"
                >
                  <ChevronRight className="h-5 w-5" />
                </button>

                {/* Indicador de scroll (móvil) - más pequeño */}
                <div className="sm:hidden flex justify-center gap-1.5 mt-2 pb-1">
                  {categories.map((cat) => (
                    <button
                      key={cat.id}
                      onClick={() => setActiveCat(cat.id)}
                      className={`h-1 rounded-full transition-all duration-300 ${
                        activeCat === cat.id
                          ? "w-6 bg-primary shadow-sm"
                          : "w-1 bg-muted-foreground/30 hover:bg-muted-foreground/50"
                      }`}
                      aria-label={`Ir a ${cat.name}`}
                    />
                  ))}
                </div>
              </div>
            </div>

            {/* Productos en lista compacta */}
            {activeCat && (
              <div className="space-y-2 sm:space-y-3">
                {(productsByCategory[activeCat] || []).map((product) => (
                  <ProductCard key={product.id} p={product} />
                ))}
              </div>
            )}
          </div>

          {/* Carrito lateral (desktop) */}
          <div className="hidden lg:block lg:col-span-1" ref={cartRef}>
            <Card className="sticky top-20">
              <CardHeader className="pb-3">
                <CardTitle className="text-base">Tu pedido</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {Object.keys(cart).length === 0 ? (
                  <p className="text-muted-foreground text-center py-8 text-sm">
                    Carrito vacío
                  </p>
                ) : (
                  <>
                    <div className="space-y-2 max-h-[400px] overflow-y-auto">
                      {Object.entries(cart).map(([key, item]) => (
                        <div key={key} className="flex gap-2 items-start p-2 rounded-lg bg-muted/30">
                          <div className="flex-1 min-w-0">
                            <p className="font-medium text-sm truncate">{item.name}</p>
                            <p className="text-[11px] text-muted-foreground">
                              {item.qty} × {PEN(item.price)}
                              {item.type === "varied" && item.selectedDays?.length ? (
                                <span> × {item.selectedDays.length}d</span>
                              ) : item.type === "weekly_promotion" ? (
                                <Badge variant="secondary" className="ml-1 h-4 text-[9px] px-1">5 días</Badge>
                              ) : null}
                            </p>
                            {item.type === "weekly_promotion" && item.selectedDays && (
                              <p className="text-[10px] text-muted-foreground mt-0.5">
                                {item.selectedDays.map(d => 
                                  new Date(d + "T12:00:00").toLocaleDateString("es-PE", { 
                                    weekday: "short", 
                                    day: "numeric" 
                                  })
                                ).join(", ")}
                              </p>
                            )}
                          </div>
                          <div className="flex items-center gap-1.5">
                            <span className="font-medium text-sm whitespace-nowrap">
                              {PEN(item.subtotal)}
                            </span>
                            <Button 
                              variant="ghost" 
                              size="sm" 
                              onClick={() => removeFromCart(key)}
                              className="h-7 w-7 p-0 rounded-full"
                            >
                              -
                            </Button>
                          </div>
                        </div>
                      ))}
                    </div>

                    <div className="border-t pt-3">
                      <div className="flex justify-between items-center font-bold">
                        <span>Total:</span>
                        <span className="text-primary">{PEN(total)}</span>
                      </div>
                    </div>

                    <div className="space-y-2">
                      <Button className="w-full" onClick={openConfirm} disabled={posting}>
                        {posting ? "Enviando..." : "Confirmar pedido"}
                      </Button>
                      <Button variant="outline" className="w-full" onClick={clearCart}>
                        Limpiar
                      </Button>
                    </div>
                  </>
                )}
              </CardContent>
            </Card>
          </div>
        </div>
      </div>

      {/* Barra inferior fija (móvil) */}
      {Object.keys(cart).length > 0 && (
        <div className="lg:hidden fixed bottom-0 inset-x-0 bg-background/95 backdrop-blur border-t shadow-lg z-50">
          <div className="px-3 py-3">
            <div className="flex items-center justify-between gap-3 mb-2">
              <div className="flex-1 min-w-0">
                <p className="text-xs text-muted-foreground">
                  {Object.keys(cart).length} producto{Object.keys(cart).length > 1 ? "s" : ""}
                </p>
                <p className="font-bold text-lg text-primary">{PEN(total)}</p>
              </div>
              <Button 
                size="sm" 
                className="rounded-full px-6 h-10 shadow-md" 
                onClick={openConfirm} 
                disabled={posting}
              >
                {posting ? "Enviando..." : "Confirmar"}
              </Button>
            </div>
            <Button 
              variant="ghost" 
              size="sm" 
              onClick={clearCart}
              className="w-full h-8 text-xs"
            >
              Limpiar carrito
            </Button>
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
