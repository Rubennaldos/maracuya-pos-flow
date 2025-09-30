import React, { useEffect, useMemo, useState } from "react";
import { RTDBHelper } from "@/lib/rt";
import { RTDB_PATHS } from "@/lib/rtdb";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import {
  ShoppingCart,
  Plus,
  Minus,
  Trash2,
  Eye,
  MessageCircle,
  X,
} from "lucide-react";
import { toast } from "@/hooks/use-toast";
import type {
  SettingsT,
  MenuT,
  ProductT,
} from "@/components/modules/lunch/types";

// Animaciones
import { motion } from "framer-motion";

// utils flexibles (con fallbacks)
import * as DateUtils from "@/components/modules/lunch/utils/dateUtils";
import SelectDaysDialog from "@/components/modules/lunch/preview/SelectDaysDialog";
import AddonsSelectorDialog from "@/components/modules/lunch/preview/AddonsSelectorDialog";
import { OrderLoadingAnimation } from "@/components/ui/OrderLoadingAnimation";

type Mode = "preview" | "live";

export interface FamilyPortalAppProps {
  /** "preview" = modo demo (no guarda), "live" = portal real (sí guarda) */
  mode: Mode;
  /** Datos del cliente (en preview puedes pasar un demo) */
  client?: { id: string; name: string };
  /** Teléfono para WhatsApp; si no se pasa, usa settings.whatsapp.phone (si existe) */
  whatsappPhoneOverride?: string;
  /** Persistencia (solo se usa en modo live). Debe lanzar error si falla */
  onPlaceOrder?: (payload: any) => Promise<void>;
}

/* ===== Helpers WhatsApp (locales) ===== */
const normalizePhone = (raw: string) => (raw || "").replace(/\D/g, "");
const buildWaUrl = (digits: string, msg: string) =>
  `https://wa.me/${digits}?text=${encodeURIComponent(msg)}`;
const openWhatsAppNow = (url: string) => {
  // Abrir en la MISMA pestaña minimiza el bloqueo de popups
  window.location.href = url;
};

// Helpers de fecha (fallbacks)
const _formatDateForPeru =
  (DateUtils as any)?.formatDateForPeru ??
  function (d: Date): string {
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, "0");
    const day = String(d.getDate()).padStart(2, "0");
    return `${y}-${m}-${day}`;
  };

const getNextDaysPeru: (horizon?: number, includeToday?: boolean) => string[] =
  (DateUtils as any)?.getNextDaysPeru ??
  function (horizon = 14, includeToday = false): string[] {
    const out: string[] = [];
    const base = new Date();
    const start = new Date(
      base.getFullYear(),
      base.getMonth(),
      base.getDate() + (includeToday ? 0 : 1)
    );
    for (let i = 0; i < horizon; i++) {
      const d = new Date(
        start.getFullYear(),
        start.getMonth(),
        start.getDate() + i
      );
      out.push(_formatDateForPeru(d));
    }
    return out;
  };

const prettyDayEs: (
  yyyy_mm_dd: string
) => { dayName: string; ddmm: string; label: string } =
  (DateUtils as any)?.prettyDayEs ??
  function (yyyy_mm_dd: string) {
    const [y, m, d] = (yyyy_mm_dd || "").split("-").map(Number);
    const date = new Date(y, m - 1, d);
    const dayName = new Intl.DateTimeFormat("es-PE", { weekday: "long" })
      .format(date)
      .toLowerCase();
    const ddmm = new Intl.DateTimeFormat("es-PE", {
      day: "2-digit",
      month: "2-digit",
    }).format(date);
    return { dayName, ddmm, label: `${dayName} ${ddmm}` };
  };

type CartItem = ProductT & {
  quantity: number;
  subtotal: number;
  selectedDays?: string[];
  selectedAddons?: { [addonId: string]: number };
  addonsPrice?: number;
};

const PEN = (n: number) =>
  new Intl.NumberFormat("es-PE", {
    style: "currency",
    currency: "PEN",
  }).format(n || 0);

const WEEKDAY_KEY: Record<
  number,
  keyof NonNullable<SettingsT["disabledDays"]>
> = {
  0: "sunday",
  1: "monday",
  2: "tuesday",
  3: "wednesday",
  4: "thursday",
  5: "friday",
  6: "saturday",
};

// UX helpers
const haptics = (ms = 10) => {
  try {
    if (typeof navigator !== "undefined" && "vibrate" in navigator) {
      (navigator as any).vibrate(ms);
    }
  } catch {}
};

export default function FamilyPortalApp({
  mode,
  client,
  whatsappPhoneOverride,
  onPlaceOrder,
}: FamilyPortalAppProps) {
  const isPreview = mode === "preview";
  const clientName = client?.name ?? "Usuario de Prueba";
  const clientId = client?.id ?? "DEMO001";

  const [settings, setSettings] = useState<SettingsT | null>(null);
  const [menu, setMenu] = useState<MenuT>({});
  const [cart, setCart] = useState<CartItem[]>([]);
  const [activeCat, setActiveCat] = useState<string>("");
  const [loading, setLoading] = useState(true);

  // Modales
  const [showDaySelection, setShowDaySelection] = useState(false);
  const [showAddonsSelection, setShowAddonsSelection] = useState(false);
  const [selectedProduct, setSelectedProduct] = useState<ProductT | null>(null);
  const [selectedDays, setSelectedDays] = useState<string[]>([]);
  const [selectedAddons, setSelectedAddons] = useState<{
    [addonId: string]: number;
  }>({});
  const [showConfirm, setShowConfirm] = useState(false);
  const [confirmRecess, setConfirmRecess] =
    useState<"primero" | "segundo">("primero");
  const [confirmNote, setConfirmNote] = useState("");
  const [posting, setPosting] = useState(false);
  const [showLoadingAnimation, setShowLoadingAnimation] = useState(false);
  const [message, setMessage] = useState("");

  // Sheet carrito móvil
  const [showCartSheet, setShowCartSheet] = useState(false);

  // Carga inicial
  useEffect(() => {
    const loadData = async () => {
      try {
        const [settingsData, menuData] = await Promise.all([
          RTDBHelper.getData<SettingsT>(RTDB_PATHS.lunch_settings),
          RTDBHelper.getData<MenuT>(RTDB_PATHS.lunch_menu),
        ]);
        setSettings(settingsData || {});
        setMenu(menuData || {});
        if (menuData?.categories) {
          const firstCat = (
            Object.values(menuData.categories) as any[]
          ).sort((a, b) => (a.order ?? 0) - (b.order ?? 0))[0];
          if (firstCat?.id) setActiveCat(firstCat.id);
        }
      } catch (e) {
        console.error(e);
      } finally {
        setLoading(false);
      }
    };
    loadData();
  }, []);

  // Categorías
  const categories = useMemo(
    () =>
      (Object.values(menu.categories || {}) as any[])
        .filter((c) => c && typeof c === "object")
        .sort((a, b) => (a.order ?? 0) - (b.order ?? 0)),
    [menu]
  ) as Array<{ id: string; name: string }>;

  // Productos por categoría
  const productsByCategory = useMemo(() => {
    return categories.reduce((acc, cat) => {
      const products = (Object.values(menu.products || {}) as any[])
        .filter((p) => p && p.categoryId === cat.id && p.active !== false)
        .sort((a, b) => {
          const pa =
            typeof a.position === "number"
              ? a.position
              : typeof a.position === "string"
              ? parseInt(a.position)
              : Number.POSITIVE_INFINITY;
          const pb =
            typeof b.position === "number"
              ? b.position
              : typeof b.position === "string"
              ? parseInt(b.position)
              : Number.POSITIVE_INFINITY;
          if (pa !== pb) return pa - pb;
          return a.name.localeCompare(b.name);
        }) as ProductT[];
      (acc as any)[cat.id] = products;
      return acc;
    }, {} as Record<string, ProductT[]>);
  }, [categories, menu]);

  // Días disponibles
  const availableDays = useMemo(() => {
    const all = getNextDaysPeru(14, true);
    const disabled = settings?.disabledDays;
    if (!disabled) return all;
    return all.filter((ymd) => {
      const [y, m, d] = ymd.split("-").map(Number);
      const dt = new Date(y, m - 1, d);
      const key = WEEKDAY_KEY[dt.getDay()];
      return !disabled[key];
    });
  }, [settings]);

  const availableDayOptions = useMemo(
    () =>
      availableDays.map((day) => {
        const { dayName, ddmm } = prettyDayEs(day);
        return { date: day, label: `${dayName} ${ddmm}` };
      }),
    [availableDays]
  );

  // —— carrito
  const handleVariedProduct = (product: ProductT) => {
    setSelectedProduct(product);
    setSelectedDays([]);
    setSelectedAddons({});
    if (product.addons?.length) setShowAddonsSelection(true);
    else setShowDaySelection(true);
  };

  const proceedToDaySelection = () => {
    setShowAddonsSelection(false);
    setShowDaySelection(true);
  };

  const addVariedToCart = () => {
    if (!selectedProduct || selectedDays.length === 0) return;
    const addonsPrice = Object.entries(selectedAddons).reduce(
      (t, [id, qty]) => {
        const addon = selectedProduct.addons?.find((a) => a.id === id);
        return t + (addon?.price || 0) * qty;
      },
      0
    );
    const base = selectedProduct.price ?? 0;
    const perDay = base + addonsPrice;
    const subtotal = perDay * selectedDays.length;

    const item: CartItem = {
      ...selectedProduct,
      quantity: selectedDays.length,
      subtotal,
      selectedDays: [...selectedDays],
      selectedAddons: Object.keys(selectedAddons).length
        ? { ...selectedAddons }
        : undefined,
      addonsPrice,
    };

    setCart((p) => [...p, item]);
    setShowDaySelection(false);
    setShowAddonsSelection(false);
    setSelectedProduct(null);
    setSelectedDays([]);
    setSelectedAddons({});
    toast({ title: `${selectedProduct.name} agregado al carrito` });
    haptics();
  };

  const addToCart = (product: ProductT) => {
    // Abrimos selector si es "varied" o si tiene agregados
    if (product.type === "varied" || (product.addons && product.addons.length > 0)) {
      handleVariedProduct(product);
      return;
    }
    setCart((prev) => {
      const existing = prev.find((i) => i.id === product.id);
      if (existing) {
        return prev.map((i) =>
          i.id === product.id
            ? {
                ...i,
                quantity: i.quantity + 1,
                subtotal: (i.quantity + 1) * (i.price ?? 0),
              }
            : i
        );
      }
      return [...prev, { ...product, quantity: 1, subtotal: product.price ?? 0 }];
    });
    toast({ title: `${product.name} agregado al carrito` });
    haptics();
  };

  const removeFromCart = (productId: string) => {
    setCart((prev) => {
      const ex = prev.find((i) => i.id === productId);
      if (ex && ex.quantity > 1) {
        return prev.map((i) =>
          i.id === productId
            ? {
                ...i,
                quantity: i.quantity - 1,
                subtotal: (i.quantity - 1) * (i.price ?? 0),
              }
            : i
        );
      }
      return prev.filter((i) => i.id !== productId);
    });
  };

  const clearCart = () => {
    setCart([]);
    toast({ title: "Carrito limpiado" });
  };

  const openConfirm = () => {
    if (!cart.length)
      return toast({ title: "Tu carrito está vacío", variant: "destructive" });
    setShowConfirm(true);
  };

  const total = useMemo(
    () => cart.reduce((s, i) => s + i.subtotal, 0),
    [cart]
  );

  const buildOrderPayload = () => ({
    clientCode: clientId,
    clientName,
    note: confirmNote || "",
    recess: confirmRecess,
    status: "pending",
    total,
    createdAt: Date.now(),
    items: cart.map((i) => ({
      id: i.id,
      name: i.name,
      qty: i.quantity,
      price: i.price ?? 0,
      selectedDays: i.selectedDays,
      specificDate: i.specificDate,
      addons: i.selectedAddons,
    })),
  });

  /** Mensaje de WA */
  const makeWaMessage = () => {
    const lines = cart.map(
      (i) =>
        `• ${i.name} (${i.quantity}x)` +
        (i.selectedDays?.length ? ` - Días: ${i.selectedDays.join(", ")}` : "")
    );
    const rec = confirmRecess === "primero" ? "Primer" : "Segundo";
    return (
      `🍽️ *PEDIDO DE ALMUERZO*${isPreview ? " (DEMO)" : ""}\n\n` +
      `👤 ${clientName} (${clientId})\n` +
      `⏰ Recreo: ${rec} recreo\n\n` +
      `📦 *Productos:*\n${lines.join("\n")}\n\n` +
      `💰 *Total:* ${PEN(total)}\n` +
      `📝 Nota: ${confirmNote || "Sin observaciones"}`
    );
  };

  /** Confirmar y abrir WhatsApp en la misma pestaña (evita bloqueos) */
  const confirmNow = async () => {
    if (cart.length === 0) {
      toast({ title: "Tu carrito está vacío", variant: "destructive" });
      return;
    }

    setPosting(true);
    setShowConfirm(false);

    const rawPhone =
      whatsappPhoneOverride ??
      (settings?.whatsapp?.enabled ? settings?.whatsapp?.phone : "");
    const phoneDigits = normalizePhone(rawPhone || "");
    if (!phoneDigits) {
      setPosting(false);
      toast({
        title: "Teléfono de WhatsApp inválido",
        description: "Configura un número con código de país.",
        variant: "destructive",
      });
      return;
    }

    haptics(15);
    const url = buildWaUrl(phoneDigits, makeWaMessage());
    openWhatsAppNow(url); // Navega a WhatsApp

    try {
      const payload = buildOrderPayload();
      if (!isPreview) {
        if (!onPlaceOrder) throw new Error("onPlaceOrder no proporcionado en modo live");
        await onPlaceOrder(payload);
        setMessage("✅ Pedido enviado correctamente.");
      } else {
        setMessage("✅ Pedido DEMO simulado (no se guardó en la base de datos).");
      }
      setCart([]);
    } catch (e) {
      console.error(e);
      toast({ title: "No se pudo guardar el pedido", variant: "destructive" });
    } finally {
      setPosting(false);
    }
  };

  // Compat si quieres usar animación antes de abrir WA (no recomendado por bloqueos)
  const confirmAndPlace = async () => {
    setShowConfirm(false);
    setShowLoadingAnimation(true);
  };
  const handleAnimationComplete = async () => {
    setShowLoadingAnimation(false);
    await confirmNow();
  };

  if (loading) {
    return (
      <Card>
        <CardContent className="p-4">
          {/* Skeletons de carga */}
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
            {Array.from({ length: 6 }).map((_, i) => (
              <div
                key={i}
                className="animate-pulse rounded-2xl border bg-muted/30 h-44"
              />
            ))}
          </div>
        </CardContent>
      </Card>
    );
  }

  const activeList: ProductT[] = activeCat
    ? productsByCategory[activeCat] || []
    : [];

  return (
    <Card>
      <CardHeader className="py-3">
        <CardTitle className="flex items-center gap-2 text-base sm:text-lg">
          <Eye className="h-4 w-4 sm:h-5 sm:w-5" />
          {isPreview ? "Vista Previa del Portal de Familias" : "Portal de Familias"}
        </CardTitle>
        <div className="text-xs sm:text-sm text-muted-foreground">
          {isPreview
            ? "Simulación completa. Puedes agregar productos, confirmar y enviar por WhatsApp (no guarda datos)."
            : `Sesión de ${clientName} (${clientId}).`}
        </div>
      </CardHeader>

      <CardContent>
        {message && (
          <div className="mb-4 p-3 bg-green-50 border border-green-200 rounded-lg text-green-800">
            {message}
          </div>
        )}

        {/* FAB Carrito (móvil) */}
        <motion.button
          whileTap={{ scale: 0.95 }}
          onClick={() => setShowCartSheet(true)}
          className="fixed bottom-4 right-4 z-30 h-14 w-14 rounded-full bg-primary text-primary-foreground shadow-strong md:hidden grid place-items-center"
          aria-label="Abrir carrito"
        >
          <div className="relative">
            <ShoppingCart className="h-6 w-6" />
            {cart.length > 0 && (
              <span
                className="absolute -top-2 -right-2 min-w-[20px] h-5 px-1.5 rounded-full bg-secondary text-secondary-foreground text-[11px] grid place-items-center"
                aria-live="polite"
              >
                {cart.length}
              </span>
            )}
          </div>
        </motion.button>

        <div className="rounded-lg p-4 border bg-white">
          {/* Encabezado compacto (móvil) */}
          <div className="bg-green-50 border border-green-200 px-3 py-2 rounded-md mb-4 flex items-center justify-between h-12 md:h-auto">
            <div className="flex items-center gap-2">
              <div className="text-sm font-medium">Hola, {clientName}</div>
              <div className="text-xs text-muted-foreground">• {clientId}</div>
            </div>
            {isPreview && (
              <Badge variant="secondary" className="text-xs">
                Preview
              </Badge>
            )}
          </div>

          <div className="grid lg:grid-cols-3 gap-6">
            {/* Productos */}
            <div className="lg:col-span-2">
              {categories.length > 0 && (
                <div className="mb-4 -mx-2 md:mx-0">
                  <div className="flex gap-2 px-2 md:px-0 overflow-x-auto scroll-x-snap pb-1">
                    {categories.map((cat) => (
                      <motion.button
                        key={cat.id}
                        whileTap={{ scale: 0.95 }}
                        onClick={() => setActiveCat(cat.id)}
                        className={`chip snap-child ${
                          activeCat === cat.id ? "chip--active" : ""
                        } whitespace-nowrap`}
                        aria-pressed={activeCat === cat.id}
                        aria-label={`Categoría ${cat.name}`}
                      >
                        {cat.name}
                      </motion.button>
                    ))}
                  </div>
                </div>
              )}

              {activeCat && activeList.length ? (
                <div className="grid grid-cols-2 md:grid-cols-2 lg:grid-cols-3 gap-3 md:gap-4">
                  {activeList.map((product) => (
                    <motion.div
                      key={product.id}
                      initial={{ opacity: 0, y: 6 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ duration: 0.25 }}
                      className="card-compact anim-soft"
                    >
                      {/* imagen 16:9 */}
                      <div className="ratio-16-9 relative bg-muted/40 overflow-hidden rounded-t-2xl">
                        {product.image ? (
                          <img
                            src={product.image}
                            alt={product.name}
                            className="absolute inset-0 w-full h-full object-cover"
                            loading="lazy"
                            decoding="async"
                            sizes="(max-width: 768px) 50vw, (max-width: 1024px) 33vw, 25vw"
                          />
                        ) : (
                          <div className="absolute inset-0 flex items-center justify-center text-xs text-muted-foreground">
                            Sin imagen
                          </div>
                        )}

                        {/* Botón + circular dentro de la imagen */}
                        <motion.button
                          whileTap={{ scale: 0.92 }}
                          onClick={() => {
                            haptics();
                            addToCart(product);
                          }}
                          className="card-add-fab tap-40"
                          aria-label={`Agregar ${product.name}`}
                        >
                          <Plus className="h-4 w-4" />
                        </motion.button>
                      </div>

                      <div className="p-3 md:p-4">
                        <div className="text-2lines text-[15px] font-semibold leading-tight min-h-[2.5rem]">
                          {product.name}
                        </div>

                        {settings?.showPrices &&
                          typeof product.price === "number" && (
                            <div className="mt-1.5 text-sm font-bold text-primary">
                              {PEN(product.price)}
                              {product.type === "varied" && (
                                <span className="ml-1 text-[11px] text-muted-foreground font-normal">
                                  /día
                                </span>
                              )}
                            </div>
                          )}

                        {/* Agregados compactos */}
                        {!!product.addons?.length && (
                          <div className="mt-2 flex items-center gap-1 text-[11px]">
                            {product.addons.slice(0, 3).map((a, idx) => (
                              <span
                                key={`${a.id || idx}`}
                                className="px-2 py-0.5 rounded-full bg-muted text-muted-foreground"
                              >
                                {a.name}
                              </span>
                            ))}
                            {product.addons.length > 3 && (
                              <span className="px-2 py-0.5 rounded-full bg-muted text-muted-foreground">
                                +{product.addons.length - 3}
                              </span>
                            )}
                          </div>
                        )}
                      </div>
                    </motion.div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-10 text-muted-foreground">
                  {categories.length
                    ? "No hay productos en esta categoría"
                    : "No hay categorías configuradas"}
                </div>
              )}
            </div>

            {/* Carrito (panel desktop permanece) */}
            <div className="lg:col-span-1 hidden lg:block">
              <Card className="sticky top-4">
                <CardHeader className="pb-3">
                  <CardTitle className="flex items-center gap-2 text-base">
                    <ShoppingCart className="h-4 w-4" />
                    Tu pedido
                    <span className="text-muted-foreground font-normal">
                      ({cart.length})
                    </span>
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  {cart.length === 0 ? (
                    <div className="text-center py-6 text-sm text-muted-foreground">
                      Tu carrito está vacío
                    </div>
                  ) : (
                    <>
                      {/* Grupos por fecha (si aplica) */}
                      {(() => {
                        const groups = cart.reduce((acc, item) => {
                          if (item.selectedDays?.length) {
                            item.selectedDays.forEach((d) => {
                              (acc[d] ||= []).push({ ...item, _d: d });
                            });
                          } else {
                            const k = item.specificDate || "Sin fecha";
                            (acc[k] ||= []).push(item);
                          }
                          return acc;
                        }, {} as Record<string, any[]>);

                        return Object.entries(groups).map(([date, items]) => (
                          <div key={date} className="border rounded p-2 space-y-2">
                            <div className="text-xs font-medium text-primary border-b pb-1">
                              📅{" "}
                              {date === "Sin fecha"
                                ? "Fecha por definir"
                                : (() => {
                                    const [y, m, d] = date
                                      .split("-")
                                      .map(Number);
                                    const dt = new Date(y, m - 1, d);
                                    const day = new Intl.DateTimeFormat("es-PE", {
                                      weekday: "long",
                                    }).format(dt);
                                    const ddmm = new Intl.DateTimeFormat("es-PE", {
                                      day: "2-digit",
                                      month: "2-digit",
                                    }).format(dt);
                                    return `${day} ${ddmm}`;
                                  })()}
                            </div>
                            {items.map((it, idx) => (
                              <div
                                key={`${it.id}-${date}-${idx}`}
                                className="flex items-center justify-between gap-2 text-sm"
                              >
                                <div className="min-w-0">
                                  <div className="font-medium truncate">{it.name}</div>
                                  <div className="text-xs text-muted-foreground">
                                    {PEN(it.price ?? 0)} × {it.quantity}
                                  </div>
                                </div>
                                <div className="flex items-center gap-1">
                                  <Button
                                    variant="outline"
                                    size="icon"
                                    className="h-6 w-6"
                                    onClick={() => removeFromCart(it.id)}
                                  >
                                    <Minus className="h-3 w-3" />
                                  </Button>
                                  <span className="w-6 text-center">{it.quantity}</span>
                                  <Button
                                    variant="outline"
                                    size="icon"
                                    className="h-6 w-6"
                                    onClick={() => addToCart(it as ProductT)}
                                  >
                                    <Plus className="h-3 w-3" />
                                  </Button>
                                </div>
                              </div>
                            ))}
                          </div>
                        ));
                      })()}

                      <div className="border-t pt-3 mt-3 flex items-center justify-between font-semibold">
                        <span>Total</span>
                        <span>{PEN(total)}</span>
                      </div>

                      <div className="space-y-2">
                        {/* Datos de entrega */}
                        <div className="bg-green-50 border border-green-200 p-3 rounded-lg">
                          <div className="text-sm">
                            <strong>Cliente:</strong> {clientName} ({clientId})
                          </div>
                          <div className="mt-2 flex gap-4">
                            <div className="flex items-center space-x-2">
                              <Switch
                                checked={confirmRecess === "primero"}
                                onCheckedChange={(c) => c && setConfirmRecess("primero")}
                              />
                              <Label>Primer recreo</Label>
                            </div>
                            <div className="flex items-center space-x-2">
                              <Switch
                                checked={confirmRecess === "segundo"}
                                onCheckedChange={(c) => c && setConfirmRecess("segundo")}
                              />
                              <Label>Segundo recreo</Label>
                            </div>
                          </div>

                          <div className="mt-3">
                            <Label htmlFor="note">Observaciones (opcional)</Label>
                            <Textarea
                              id="note"
                              placeholder="Alguna indicación especial..."
                              value={confirmNote}
                              onChange={(e) => setConfirmNote(e.target.value)}
                              rows={2}
                            />
                          </div>

                          {(whatsappPhoneOverride || settings?.whatsapp?.enabled) && (
                            <div className="mt-2 flex items-center gap-2 text-green-800 text-sm">
                              <MessageCircle className="h-4 w-4" />
                              Se enviará confirmación por WhatsApp
                            </div>
                          )}
                        </div>

                        {/* Abrimos WA sin bloqueo */}
                        <Button
                          className="w-full"
                          onClick={confirmNow}
                          disabled={!cart.length || posting}
                        >
                          {isPreview ? "Confirmar Pedido (Demo)" : "Confirmar Pedido"}
                        </Button>

                        <Button variant="outline" className="w-full" onClick={clearCart}>
                          <Trash2 className="h-4 w-4 mr-2" />
                          Limpiar
                        </Button>
                      </div>
                    </>
                  )}
                </CardContent>
              </Card>
            </div>
          </div>

          <div className="text-center mt-6 pt-4 border-t text-xs text-muted-foreground">
            Maracuyá • Portal de Almuerzos {isPreview && "• Vista Previa de Administrador"}
          </div>
        </div>

        {/* Modales */}
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

        <SelectDaysDialog
          open={showDaySelection}
          onOpenChange={setShowDaySelection}
          productName={selectedProduct?.name}
          pricePerDay={selectedProduct?.price}
          days={availableDayOptions}
          selectedDays={selectedDays}
          onToggleDay={(date, checked) =>
            setSelectedDays((prev) =>
              checked ? [...prev, date] : prev.filter((d) => d !== date)
            )
          }
          onConfirm={addVariedToCart}
          confirmDisabled={selectedDays.length === 0}
          disabledDays={settings?.disabledDays}
        />

        {/* Confirmación */}
        <Dialog open={showConfirm} onOpenChange={setShowConfirm}>
          <DialogContent className="sm:max-w-lg">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <ShoppingCart className="h-5 w-5" />
                Confirmar pedido
              </DialogTitle>
              <DialogDescription>
                Revisa los detalles de tu pedido antes de enviarlo
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-4">
              <div className="bg-muted/50 p-4 rounded-lg space-y-2">
                <h4 className="font-medium">Resumen del pedido</h4>
                {cart.map((item, idx) => (
                  <div key={idx} className="text-sm">
                    <div className="flex justify-between">
                      <span>
                        {item.name} (×{item.quantity})
                      </span>
                      <span>{PEN(item.subtotal)}</span>
                    </div>
                    {item.selectedDays?.length ? (
                      <div className="text-xs text-muted-foreground ml-2">
                        Días: {item.selectedDays.join(", ")}
                      </div>
                    ) : null}
                  </div>
                ))}
                <div className="border-t pt-2 font-bold flex justify-between">
                  <span>Total:</span>
                  <span>{PEN(total)}</span>
                </div>
              </div>

              <div className="space-y-3">
                <div className="bg-green-50 border border-green-200 p-3 rounded-lg">
                  <div className="text-sm">
                    <strong>Cliente:</strong> {clientName} ({clientId})
                  </div>
                </div>

                <div>
                  <Label>Recreo de entrega</Label>
                  <div className="flex gap-4 mt-2">
                    <div className="flex items-center space-x-2">
                      <Switch
                        checked={confirmRecess === "primero"}
                        onCheckedChange={(c) => c && setConfirmRecess("primero")}
                      />
                      <Label>Primer recreo</Label>
                    </div>
                    <div className="flex items-center space-x-2">
                      <Switch
                        checked={confirmRecess === "segundo"}
                        onCheckedChange={(c) => c && setConfirmRecess("segundo")}
                      />
                      <Label>Segundo recreo</Label>
                    </div>
                  </div>
                </div>

                <div>
                  <Label htmlFor="note">Observaciones (opcional)</Label>
                  <Textarea
                    id="note"
                    placeholder="Alguna indicación especial..."
                    value={confirmNote}
                    onChange={(e) => setConfirmNote(e.target.value)}
                    rows={3}
                  />
                </div>
              </div>

              {(whatsappPhoneOverride || settings?.whatsapp?.enabled) && (
                <div className="bg-green-50 border border-green-200 p-3 rounded-lg">
                  <div className="flex items-center gap-2 text-green-800">
                    <MessageCircle className="h-4 w-4" />
                    <span className="text-sm font-medium">
                      Se enviará confirmación por WhatsApp
                    </span>
                  </div>
                </div>
              )}
            </div>

            <DialogFooter className="sticky bottom-0 bg-white pt-3">
              <Button variant="outline" onClick={() => setShowConfirm(false)}>
                Cancelar
              </Button>
              <Button
                onClick={confirmNow}
                disabled={posting}
                className="bg-green-600 hover:bg-green-700"
              >
                {posting ? "Enviando pedido..." : "Enviar pedido"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Animación opcional */}
        <OrderLoadingAnimation
          open={showLoadingAnimation}
          onComplete={handleAnimationComplete}
        />

        {/* Bottom Sheet Carrito (móvil) */}
        <Dialog open={showCartSheet} onOpenChange={setShowCartSheet}>
          <DialogContent className="mobile-sheet sm:max-w-lg sm:rounded-lg sm:translate-y-0 sm:bottom-auto">
            {/* header sheet */}
            <div className="sticky top-0 z-10 flex items-center justify-between px-4 py-3 border-b bg-white">
              <div className="flex items-center gap-2 text-sm font-medium">
                <ShoppingCart className="h-4 w-4" />
                Tu pedido ({cart.length})
              </div>
              <button
                aria-label="Cerrar"
                onClick={() => setShowCartSheet(false)}
                className="p-2 rounded-md hover:bg-muted"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="max-h-[50vh] overflow-y-auto p-4 space-y-3">
              {cart.length === 0 ? (
                <div className="text-center text-muted-foreground py-8 text-sm">
                  Tu carrito está vacío
                </div>
              ) : (
                <>
                  {/* Agrupación por fecha */}
                  {(() => {
                    const groups = cart.reduce((acc, item) => {
                      if (item.selectedDays?.length) {
                        item.selectedDays.forEach((d) => {
                          (acc[d] ||= []).push({ ...item, _d: d });
                        });
                      } else {
                        const k = item.specificDate || "general";
                        (acc[k] ||= []).push(item);
                      }
                      return acc;
                    }, {} as Record<string, any[]>);

                    return Object.entries(groups).map(([date, items]) => (
                      <div key={date} className="space-y-2">
                        {Object.keys(groups).length > 1 && (
                          <div className="cart-date-title">
                            📅{" "}
                            {date === "general"
                              ? "General"
                              : (() => {
                                  const [y, m, d] = date.split("-").map(Number);
                                  const dt = new Date(y, m - 1, d);
                                  const day = new Intl.DateTimeFormat("es-PE", {
                                    weekday: "short",
                                  }).format(dt);
                                  const ddmm = new Intl.DateTimeFormat("es-PE", {
                                    day: "2-digit",
                                    month: "2-digit",
                                  }).format(dt);
                                  return `${day} ${ddmm}`;
                                })()}
                          </div>
                        )}
                        {items.map((it, idx) => (
                          <div
                            key={`${it.id}-${date}-${idx}`}
                            className="flex items-center justify-between gap-3 text-xs"
                          >
                            <div className="min-w-0 flex-1">
                              <div className="font-medium text-sm">{it.name}</div>
                              <div className="text-muted-foreground">
                                {PEN(it.price ?? 0)} × {it.quantity}
                              </div>
                            </div>
                            <div className="flex items-center gap-1">
                              <Button
                                variant="outline"
                                size="icon"
                                className="h-7 w-7"
                                onClick={() => removeFromCart(it.id)}
                                aria-label="Quitar uno"
                              >
                                <Minus className="h-3 w-3" />
                              </Button>
                              <span className="w-8 text-center text-xs font-medium">
                                {it.quantity}
                              </span>
                              <Button
                                variant="outline"
                                size="icon"
                                className="h-7 w-7"
                                onClick={() => addToCart(it as ProductT)}
                                aria-label="Agregar uno"
                              >
                                <Plus className="h-3 w-3" />
                              </Button>
                            </div>
                          </div>
                        ))}
                      </div>
                    ));
                  })()}
                </>
              )}
            </div>

            <div className="modal-sticky-footer space-y-3">
              <div className="flex justify-between items-center text-sm font-bold">
                <span>Total</span>
                <span className="text-primary">{PEN(total)}</span>
              </div>
              <div className="flex gap-3 items-center">
                <Button
                  className="flex-1"
                  onClick={() => {
                    setShowCartSheet(false);
                    if (cart.length > 0) openConfirm();
                  }}
                  disabled={!cart.length}
                >
                  Confirmar
                </Button>
                <motion.button
                  whileTap={{ scale: 0.9 }}
                  onClick={() => {
                    haptics(10);
                    const rawPhone =
                      whatsappPhoneOverride ??
                      (settings?.whatsapp?.enabled ? settings?.whatsapp?.phone : "");
                    const phoneDigits = normalizePhone(rawPhone || "");
                    if (phoneDigits && cart.length > 0) {
                      const url = buildWaUrl(phoneDigits, makeWaMessage());
                      openWhatsAppNow(url);
                    }
                  }}
                  className="h-10 w-10 rounded-full bg-green-500 text-white grid place-items-center shadow-md tap-44 disabled:opacity-50"
                  aria-label="Enviar por WhatsApp"
                  disabled={!cart.length}
                >
                  <MessageCircle className="h-5 w-5" />
                </motion.button>
              </div>
              <p className="text-[11px] text-muted-foreground text-center">
                Se enviará por WhatsApp
              </p>
            </div>
          </DialogContent>
        </Dialog>
      </CardContent>
    </Card>
  );
}
